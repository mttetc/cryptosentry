'use server';

import { WebSocket } from 'ws';
import { createServerSupabaseClient } from '@/lib/supabase';
import { monitorPrice, monitorSocial } from '@/actions/alerts';
import { startPriceMonitoring, stopPriceMonitoring } from '@/actions/exchanges';
import { startSocialMonitoring } from '@/actions/social';
import { logError } from '@/lib/logger';
import { cache } from 'react';
import { experimental_taintObjectReference } from 'react';
import { config } from './config';
import 'server-only';

// Types
type ExchangeType = 'binance' | 'coinbase' | 'kraken' | 'dex';

interface PriceCache {
  price: number;
  timestamp: number;
  percentageChange?: number;
}

interface Asset {
  symbol: string;
  condition: 'above' | 'below' | 'between' | 'change';
  value: number;
  value2?: number;
  percentageChange?: number;
  isReference?: boolean;
}

interface ConditionGroup {
  assets: Asset[];
  logicOperator: 'AND' | 'OR';
}

interface Exchange {
  ws: WebSocket | null;
  manager: WebSocketManager | null;
  connect: () => Promise<void>;
  disconnect: () => void;
}

// Cache and coverage tracking
const priceCache = new Map<string, PriceCache>();
const exchangeCoverage: Record<ExchangeType, Set<string>> = {
  binance: new Set<string>(),
  coinbase: new Set<string>(),
  kraken: new Set<string>(),
  dex: new Set<string>(),
};

// Cache monitoring status checks
export const getMonitoringStatus = cache(async () => {
  const supabase = await createServerSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.user.id) {
    throw new Error('Unauthorized');
  }

  const { data: user } = await supabase
    .from('users')
    .select('role')
    .eq('id', session.user.id)
    .single();

  if (user?.role !== 'admin') {
    throw new Error('Forbidden');
  }

  const status = {
    success: true,
    status: isMonitoringActive ? 'active' : 'inactive',
    priceMonitoring: !!priceSocket,
    socialMonitoring: !!socialSocket
  };

  // Prevent sensitive monitoring data from being passed to client
  experimental_taintObjectReference(
    'Do not pass internal monitoring state to client',
    status
  );

  return status;
});

// Preload pattern for monitoring status
export const preloadMonitoringStatus = () => {
  void getMonitoringStatus();
};

// Cache active alerts query with proper typing
export const getActiveAlerts = cache(async () => {
  const supabase = await createServerSupabaseClient();
  
  const [priceAlertsResult, socialAlertsResult] = await Promise.all([
    supabase
      .from('price_alerts')
      .select('id, symbol, target_price, created_at')
      .eq('active', true),
    supabase
      .from('social_alerts')
      .select('id, account, keywords, created_at')
      .eq('active', true)
  ]);

  const alerts = {
    priceAlerts: priceAlertsResult.data || [],
    socialAlerts: socialAlertsResult.data || []
  };

  // Prevent sensitive alert data from being passed to client
  experimental_taintObjectReference(
    'Do not pass raw alert data to client',
    alerts
  );

  return alerts;
});

// Preload pattern for active alerts
export const preloadActiveAlerts = () => {
  void getActiveAlerts();
};

let isMonitoringActive = false;
let priceSocket: WebSocket | null = null;
let socialSocket: WebSocket | null = null;
let heartbeatInterval: NodeJS.Timeout | null = null;
let socialHeartbeatInterval: NodeJS.Timeout | null = null;

// Initialize monitoring on server start
if (!isMonitoringActive) {
  isMonitoringActive = true;
  startSocialMonitoring().catch(error => {
    logError('Failed to start monitoring:', { error });
    isMonitoringActive = false;
  });
}

// WebSocket connection management
class WebSocketManager {
  private ws: WebSocket | null = null;
  private pingInterval: NodeJS.Timeout | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private backoff = config.websocket.initialBackoff;
  private attempts = 0;
  private isReconnecting = false;
  private lastPingTime = 0;

  constructor(
    private url: string,
    private onMessage: (data: any) => void,
    private onConnect?: () => void,
    private onDisconnect?: () => void
  ) {}

  connect() {
    if (this.ws?.readyState === WebSocket.OPEN) return;
    if (this.isReconnecting) return;

    try {
      this.ws = new WebSocket(this.url);
      this.setupEventHandlers();
      this.startPingInterval();
    } catch (error) {
      console.error(`WebSocket connection error: ${error}`);
      this.handleDisconnect();
    }
  }

  private setupEventHandlers() {
    if (!this.ws) return;

    this.ws.on('open', () => {
      console.log('WebSocket connected');
      this.backoff = config.websocket.initialBackoff;
      this.attempts = 0;
      this.isReconnecting = false;
      this.onConnect?.();
    });

    this.ws.on('message', (data) => {
      try {
        const parsed = JSON.parse(data.toString());
        this.onMessage(parsed);
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    });

    this.ws.on('pong', () => {
      this.lastPingTime = Date.now();
    });

    this.ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      this.handleDisconnect();
    });

    this.ws.on('close', () => {
      console.log('WebSocket closed');
      this.handleDisconnect();
    });
  }

  private startPingInterval() {
    this.stopPingInterval();
    
    this.pingInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.lastPingTime = Date.now();
        this.ws.ping();

        // Check if we received a pong
        setTimeout(() => {
          if (Date.now() - this.lastPingTime >= config.websocket.pingTimeout) {
            console.warn('Ping timeout, reconnecting...');
            this.handleDisconnect();
          }
        }, config.websocket.pingTimeout);
      }
    }, config.websocket.pingInterval);
  }

  private stopPingInterval() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private handleDisconnect() {
    this.stopPingInterval();
    
    if (this.ws) {
      this.ws.removeAllListeners();
      this.ws.terminate();
      this.ws = null;
    }

    this.onDisconnect?.();

    if (this.attempts < config.websocket.reconnectAttempts) {
      this.scheduleReconnect();
    } else {
      console.error('Max reconnection attempts reached');
      this.isReconnecting = false;
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    this.isReconnecting = true;
    this.attempts++;

    this.reconnectTimeout = setTimeout(() => {
      console.log(`Attempting to reconnect (${this.attempts}/${config.websocket.reconnectAttempts})`);
      this.connect();
      this.backoff = Math.min(
        this.backoff * config.websocket.backoffMultiplier,
        config.websocket.maxBackoff
      );
    }, this.backoff);
  }

  disconnect() {
    this.stopPingInterval();
    
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.ws) {
      this.ws.removeAllListeners();
      this.ws.terminate();
      this.ws = null;
    }

    this.isReconnecting = false;
    this.attempts = 0;
  }

  send(data: any) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    } else {
      console.warn('WebSocket not connected, cannot send data');
    }
  }
}

// Update price cache and check conditions
async function updatePriceCache(symbol: string, price: number) {
  const now = Date.now();
  const oldData = priceCache.get(symbol);

  let percentageChange: number | undefined;
  if (oldData && now - oldData.timestamp <= config.cache.ttl) {
    percentageChange = ((price - oldData.price) / oldData.price) * 100;
  }

  priceCache.set(symbol, {
    price,
    timestamp: now,
    percentageChange,
  });

  // Clean up old cache entries
  if (priceCache.size > config.cache.maxSize) {
    const oldestEntries = Array.from(priceCache.entries())
      .sort(([, a], [, b]) => a.timestamp - b.timestamp)
      .slice(0, config.cache.cleanupThreshold);
    
    priceCache.clear();
    oldestEntries.forEach(([key, value]) => priceCache.set(key, value));
  }

  // Monitor price for alerts
  await monitorPrice(symbol, price);
}

// Get active conditions from database
async function getActiveConditions(): Promise<ConditionGroup[] | null> {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: alerts } = await supabase
      .from('price_alerts')
      .select('*')
      .eq('active', true)
      .not('condition_type', 'is', null);

    if (!alerts?.length) return null;

    // Group alerts by their combined condition group
    const groupedAlerts = alerts.reduce((groups: Record<string, any[]>, alert) => {
      const groupId = alert.group_id || 'default';
      if (!groups[groupId]) groups[groupId] = [];
      groups[groupId].push(alert);
      return groups;
    }, {});

    // Convert each group to a condition group
    return Object.values(groupedAlerts).map((alerts) => ({
      assets: alerts.map((alert) => ({
        symbol: alert.symbol,
        condition: alert.condition_type,
        value: alert.target_price,
        value2: alert.target_price_2,
        percentageChange: alert.percentage_change,
        isReference: alert.is_reference,
      })),
      logicOperator: alerts[0].logic_operator,
    }));
  } catch (error) {
    console.error('Error fetching conditions:', error);
    return null;
  }
}

// Check combined conditions
async function checkCombinedConditions(symbol: string, price: number, percentageChange?: number) {
  const now = Date.now();

  // Clean up old cache entries
  Array.from(priceCache.entries()).forEach(([key, value]) => {
    if (now - value.timestamp > config.cache.ttl) {
      priceCache.delete(key);
    }
  });

  // Update the cache for the current symbol
  if (percentageChange !== undefined) {
    const currentData = priceCache.get(symbol);
    if (currentData) {
      priceCache.set(symbol, {
        ...currentData,
        percentageChange,
      });
    }
  }

  // Get active conditions from database
  const conditionGroups = await getActiveConditions();
  if (!conditionGroups) return;

  for (const conditions of conditionGroups) {
    let groupConditionsMet = conditions.logicOperator === 'AND';

    for (const asset of conditions.assets) {
      const data = priceCache.get(asset.symbol);
      if (!data) continue;

      let conditionMet = false;

      switch (asset.condition) {
        case 'above':
          conditionMet = data.price > asset.value;
          break;
        case 'below':
          conditionMet = data.price < asset.value;
          break;
        case 'between':
          conditionMet =
            asset.value2 !== undefined && data.price >= asset.value && data.price <= asset.value2;
          break;
        case 'change':
          if (data.percentageChange !== undefined && asset.percentageChange !== undefined) {
            if (asset.isReference) {
              // For reference asset, check if change is WITHIN the range
              conditionMet = Math.abs(data.percentageChange) <= Math.abs(asset.percentageChange);
            } else {
              // For target assets, check if change meets the threshold
              conditionMet = data.percentageChange >= asset.percentageChange;
            }
          }
          break;
      }

      if (conditions.logicOperator === 'AND') {
        if (!conditionMet) {
          groupConditionsMet = false;
          break;
        }
      } else if (conditionMet) {
        groupConditionsMet = true;
        break;
      }
    }

    if (groupConditionsMet) {
      await monitorPrice(symbol, price, {
        type: 'combined',
        conditions,
        prices: Object.fromEntries(
          Array.from(priceCache.entries()).map(([key, value]) => [
            key,
            { price: value.price, change: value.percentageChange },
          ])
        ),
      });
    }
  }
}

export async function stopMonitoring() {
  try {
    isMonitoringActive = false;

    // Stop price monitoring
    await stopPriceMonitoring();

    // Clear intervals
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      heartbeatInterval = null;
    }

    if (socialHeartbeatInterval) {
      clearInterval(socialHeartbeatInterval);
      socialHeartbeatInterval = null;
    }

    // Close WebSocket connections
    if (priceSocket) {
      priceSocket.terminate();
      priceSocket = null;
    }

    if (socialSocket) {
      socialSocket.terminate();
      socialSocket = null;
    }

    return { success: true };
  } catch (error) {
    console.error('Error stopping monitoring:', error);
    return { error: 'Failed to stop monitoring' };
  }
}

export async function checkHealth() {
  try {
    const supabase = await createServerSupabaseClient();
    
    // Check database connection
    const { data, error } = await supabase
      .from('price_alerts')
      .select('count', { count: 'exact' })
      .limit(1);

    if (error) throw error;

    // Check WebSocket connections
    const wsStatus = {
      price: priceSocket?.readyState === WebSocket.OPEN,
      social: socialSocket?.readyState === WebSocket.OPEN,
    };

    // Check cache health
    const cacheStatus = {
      size: priceCache.size,
      utilization: (priceCache.size / config.cache.maxSize) * 100,
    };

    return {
      success: true,
      database: true,
      websockets: wsStatus,
      cache: cacheStatus,
    };
  } catch (error) {
    console.error('Health check failed:', error);
    return { success: false, error: 'Health check failed' };
  }
} 