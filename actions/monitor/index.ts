'use server';

import { WebSocket } from 'ws';
import { createServerSupabaseClient } from '@/lib/supabase';
import { monitorPrice, monitorSocial } from '@/actions/alerts';
import { startPriceMonitoring, stopPriceMonitoring } from '@/actions/exchanges';
import { startSocialMonitoring, stopSocialMonitoring } from '@/actions/social';
import { logError } from '@/lib/logger';
import { cache } from 'react';
import { experimental_taintObjectReference } from 'react';
import { config } from '@/config/monitoring';
import 'server-only';

// Types
interface MonitoringState {
  isActive: boolean;
  priceSocket: WebSocket | null;
  socialSocket: WebSocket | null;
  heartbeatInterval: NodeJS.Timeout | null;
  socialHeartbeatInterval: NodeJS.Timeout | null;
  lastError: Error | null;
  startTime: number | null;
}

interface PriceCache {
  price: number;
  timestamp: number;
  percentageChange?: number;
}

// Service state
let state: MonitoringState = {
  isActive: false,
  priceSocket: null,
  socialSocket: null,
  heartbeatInterval: null,
  socialHeartbeatInterval: null,
  lastError: null,
  startTime: null,
};

let initializationPromise: Promise<void> | null = null;

// Cache for price monitoring
const priceCache = new Map<string, PriceCache>();

// Initialize the monitoring service
export async function initialize(): Promise<void> {
  if (initializationPromise) {
    return initializationPromise;
  }

  initializationPromise = (async () => {
    try {
      // Initialize database connection
      const supabase = await createServerSupabaseClient();
      const { error } = await supabase.from('health_check').select('count');
      if (error) throw error;

      // Start price monitoring
      await startPriceMonitoring();
      const priceSocket = new WebSocket('wss://stream.binance.com:9443/ws');
      
      const heartbeatInterval = setInterval(() => {
        if (priceSocket.readyState === WebSocket.OPEN) {
          priceSocket.ping();
        }
      }, config.monitoring.websocket.pingInterval);

      // Set up price socket reconnection
      priceSocket.on('close', () => {
        const backoff = Math.min(
          config.monitoring.websocket.initialBackoff * 
          Math.pow(config.monitoring.websocket.backoffMultiplier, 1),
          config.monitoring.websocket.maxBackoff
        );
        setTimeout(async () => {
          try {
            await startPriceMonitoring();
          } catch (error) {
            logError('Failed to reconnect price monitoring:', error);
          }
        }, backoff);
      });

      // Start social monitoring
      await startSocialMonitoring();
      
      if (!process.env.SOCIAL_STREAM_ENDPOINT) {
        throw new Error('SOCIAL_STREAM_ENDPOINT not configured');
      }

      const socialSocket = new WebSocket(process.env.SOCIAL_STREAM_ENDPOINT);
      
      const socialHeartbeatInterval = setInterval(() => {
        if (socialSocket.readyState === WebSocket.OPEN) {
          socialSocket.ping();
        }
      }, config.monitoring.websocket.pingInterval);

      // Set up social socket reconnection
      socialSocket.on('close', () => {
        const backoff = Math.min(
          config.monitoring.websocket.initialBackoff * 
          Math.pow(config.monitoring.websocket.backoffMultiplier, 1),
          config.monitoring.websocket.maxBackoff
        );
        setTimeout(async () => {
          try {
            await startSocialMonitoring();
          } catch (error) {
            logError('Failed to reconnect social monitoring:', error);
          }
        }, backoff);
      });

      // Update state
      state = {
        isActive: true,
        priceSocket,
        socialSocket,
        heartbeatInterval,
        socialHeartbeatInterval,
        lastError: null,
        startTime: Date.now(),
      };

    } catch (error) {
      state = {
        ...state,
        isActive: false,
        lastError: error instanceof Error ? error : new Error('Unknown error'),
      };
      throw error;
    }
  })();

  return initializationPromise;
}

// Clean up all resources
export async function cleanup(): Promise<void> {
  try {
    // Stop monitoring services
    await Promise.all([
      stopPriceMonitoring(),
      stopSocialMonitoring(),
    ]);

    // Clean up WebSocket connections
    if (state.priceSocket) {
      state.priceSocket.close();
    }
    if (state.socialSocket) {
      state.socialSocket.close();
    }

    // Clear intervals
    if (state.heartbeatInterval) {
      clearInterval(state.heartbeatInterval);
    }
    if (state.socialHeartbeatInterval) {
      clearInterval(state.socialHeartbeatInterval);
    }

  } catch (error) {
    logError('Failed to cleanup monitoring service:', error);
  } finally {
    // Reset state
    state = {
      isActive: false,
      priceSocket: null,
      socialSocket: null,
      heartbeatInterval: null,
      socialHeartbeatInterval: null,
      lastError: null,
      startTime: null,
    };
    initializationPromise = null;
  }
}

// Restart the service
export async function restart(): Promise<void> {
  await cleanup();
  await initialize();
}

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
    status: state.isActive ? 'active' : 'inactive',
    startTime: state.startTime,
    lastError: state.lastError?.message,
    connections: {
      priceMonitoring: !!state.priceSocket && state.priceSocket.readyState === WebSocket.OPEN,
      socialMonitoring: !!state.socialSocket && state.socialSocket.readyState === WebSocket.OPEN,
    },
    uptime: state.startTime ? Date.now() - state.startTime : 0,
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

// Update price cache and check conditions
async function updatePriceCache(symbol: string, price: number) {
  const now = Date.now();
  const oldData = priceCache.get(symbol);

  let percentageChange: number | undefined;
  if (oldData && now - oldData.timestamp <= config.monitoring.cache.ttl) {
    percentageChange = ((price - oldData.price) / oldData.price) * 100;
  }

  priceCache.set(symbol, {
    price,
    timestamp: now,
    percentageChange,
  });

  // Clean up old cache entries
  if (priceCache.size > config.monitoring.cache.maxSize) {
    const oldestEntries = Array.from(priceCache.entries())
      .sort(([, a], [, b]) => a.timestamp - b.timestamp)
      .slice(0, config.monitoring.cache.cleanupThreshold);
    
    priceCache.clear();
    oldestEntries.forEach(([key, value]) => priceCache.set(key, value));
  }

  // Monitor price for alerts
  await monitorPrice(symbol, price);
}

// Initialize monitoring on server start
initialize().catch(error => {
  logError('Failed to start monitoring:', { error });
}); 