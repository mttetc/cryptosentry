'use server';

import { WebSocket } from 'ws';
import { createServerSupabaseClient } from '@/lib/supabase';
import { monitorPrice, monitorSocial } from '@/actions/alerts';
import { startPriceMonitoring, stopPriceMonitoring } from '@/actions/exchanges';
import { startSocialMonitoring } from '@/actions/social';
import { logError } from '@/lib/logger';
import { cache } from 'react';
import { experimental_taintObjectReference } from 'react';
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

// Constants
const CACHE_TTL = 60000; // 1 minute
const POLLING_INTERVAL = 5000; // 5 seconds for DEX polling
const SUBGRAPH_ENDPOINTS = {
  uniswap: 'https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v2',
  pancakeswap: 'https://api.thegraph.com/subgraphs/name/pancakeswap/exchange-v2',
};

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
const WS_CONFIG = {
  INITIAL_BACKOFF: 1000 as const,
  MAX_BACKOFF: 30000 as const,
  BACKOFF_MULTIPLIER: 1.5 as const,
  PING_INTERVAL: 30000 as const,
  PING_TIMEOUT: 5000 as const,
  RECONNECT_ATTEMPTS: 5 as const,
};

class WebSocketManager {
  private ws: WebSocket | null = null;
  private pingInterval: NodeJS.Timeout | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private backoff = WS_CONFIG.INITIAL_BACKOFF;
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
      this.backoff = WS_CONFIG.INITIAL_BACKOFF;
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
          if (Date.now() - this.lastPingTime >= WS_CONFIG.PING_TIMEOUT) {
            console.warn('Ping timeout, reconnecting...');
            this.handleDisconnect();
          }
        }, WS_CONFIG.PING_TIMEOUT);
      }
    }, WS_CONFIG.PING_INTERVAL);
  }

  private stopPingInterval() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private handleDisconnect() {
    this.stopPingInterval();
    this.onDisconnect?.();

    if (this.ws) {
      this.ws.removeAllListeners();
      try {
        this.ws.terminate();
      } catch (error) {
        console.error('Error terminating WebSocket:', error);
      }
      this.ws = null;
    }

    if (this.attempts < WS_CONFIG.RECONNECT_ATTEMPTS) {
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
      console.log(`Attempting to reconnect (${this.attempts}/${WS_CONFIG.RECONNECT_ATTEMPTS})`);
      this.connect();
      
      // Calculate next backoff with proper type handling
      const nextBackoff = Math.min(
        this.backoff * WS_CONFIG.BACKOFF_MULTIPLIER,
        WS_CONFIG.MAX_BACKOFF
      ) as typeof WS_CONFIG.INITIAL_BACKOFF;
      
      this.backoff = nextBackoff;
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
      try {
        this.ws.close();
      } catch (error) {
        console.error('Error closing WebSocket:', error);
      }
      this.ws = null;
    }
  }

  send(data: any) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(data));
      } catch (error) {
        console.error('Error sending WebSocket message:', error);
        this.handleDisconnect();
      }
    }
  }
}

// Price cache update function
async function updatePriceCache(symbol: string, price: number) {
  const now = Date.now();
  const oldData = priceCache.get(symbol);

  let percentageChange: number | undefined;
  if (oldData && now - oldData.timestamp <= CACHE_TTL) {
    percentageChange = ((price - oldData.price) / oldData.price) * 100;
  }

  priceCache.set(symbol, {
    price,
    timestamp: now,
    percentageChange: percentageChange,
  });

  // Monitor price for basic alerts
  await monitorPrice(symbol, price);

  // Check for combined conditions separately
  await checkCombinedConditions(symbol, price, percentageChange);
}

// Exchange connections
const exchangeConnections: Record<ExchangeType, Exchange> = {
  binance: {
    ws: null,
    manager: null,
    connect: async () => {
      try {
        // Get available symbols from Binance
        const response = await fetch('https://api.binance.com/api/v3/exchangeInfo');
        const data = await response.json();
        const symbols = data.symbols
          .filter((s: { quoteAsset: string }) => s.quoteAsset === 'USDT')
          .map((s: { baseAsset: string }) => s.baseAsset);
        exchangeCoverage.binance = new Set(symbols.map((s: string) => s.toUpperCase()));

        // Create WebSocket manager
        exchangeConnections.binance.manager = new WebSocketManager(
          'wss://stream.binance.com:9443/ws',
          async (data) => {
            if (data.c) {
              const symbol = data.s.replace('USDT', '');
              const price = parseFloat(data.c);
              await updatePriceCache(symbol, price);
            }
          },
          () => {
            // On connect
            exchangeConnections.binance.manager?.send(
              JSON.stringify({
                method: 'SUBSCRIBE',
                params: ['!ticker@arr'],
                id: 1,
              })
            );
          }
        );

        exchangeConnections.binance.manager.connect();
      } catch (error) {
        console.error('Error connecting to Binance:', error);
      }
    },
    disconnect: () => {
      if (exchangeConnections.binance.manager) {
        exchangeConnections.binance.manager.disconnect();
        exchangeConnections.binance.manager = null;
      }
    },
  },
  coinbase: {
    ws: null,
    manager: null,
    connect: async () => {
      try {
        // Get available symbols from Coinbase
        const response = await fetch('https://api.pro.coinbase.com/products');
        const products = await response.json();
        const symbols = products
          .filter((p: any) => p.quote_currency === 'USD')
          .map((p: any) => p.base_currency);
        exchangeCoverage.coinbase = new Set(symbols.map((s: string) => s.toUpperCase()));

        // Create WebSocket manager
        exchangeConnections.coinbase.manager = new WebSocketManager(
          'wss://ws-feed.pro.coinbase.com',
          async (data) => {
            if (data.type === 'ticker') {
              const symbol = data.product_id.split('-')[0];
              const price = parseFloat(data.price);
              await updatePriceCache(symbol, price);
            }
          },
          () => {
            // On connect
            exchangeConnections.coinbase.manager?.send(
              JSON.stringify({
                type: 'subscribe',
                channels: [{ name: 'ticker', product_ids: ['BTC-USD', 'ETH-USD'] }],
              })
            );
          }
        );

        exchangeConnections.coinbase.manager.connect();
      } catch (error) {
        console.error('Error connecting to Coinbase:', error);
      }
    },
    disconnect: () => {
      if (exchangeConnections.coinbase.manager) {
        exchangeConnections.coinbase.manager.disconnect();
        exchangeConnections.coinbase.manager = null;
      }
    },
  },
  kraken: {
    ws: null,
    manager: null,
    connect: async () => {
      try {
        // Get available symbols from Kraken
        const response = await fetch('https://api.kraken.com/0/public/AssetPairs');
        const data = await response.json();
        const result = data.result as Record<string, { base: string; quote: string }>;
        const symbols = Object.values(result)
          .filter((p) => p.quote === 'ZUSD' || p.quote === 'USD')
          .map((p) => p.base.replace('X', '').replace('Z', ''));
        exchangeCoverage.kraken = new Set(symbols.map((s: string) => s.toUpperCase()));

        // Create WebSocket manager
        exchangeConnections.kraken.manager = new WebSocketManager(
          'wss://ws.kraken.com',
          async (data) => {
            if (Array.isArray(data) && data[2] === 'ticker') {
              const symbol = data[3].split('/')[0].replace('XBT', 'BTC');
              const price = parseFloat(data[1].c[0]);
              await updatePriceCache(symbol, price);
            }
          },
          () => {
            // On connect
            exchangeConnections.kraken.manager?.send(
              JSON.stringify({
                event: 'subscribe',
                pair: ['XBT/USD', 'ETH/USD'],
                subscription: { name: 'ticker' },
              })
            );
          }
        );

        exchangeConnections.kraken.manager.connect();
      } catch (error) {
        console.error('Error connecting to Kraken:', error);
      }
    },
    disconnect: () => {
      if (exchangeConnections.kraken.manager) {
        exchangeConnections.kraken.manager.disconnect();
        exchangeConnections.kraken.manager = null;
      }
    },
  },
  dex: {
    ws: null,
    manager: null,
    connect: async () => {
      const supabase = await createServerSupabaseClient();

      const isSymbolOnMajorExchange = (symbol: string) => {
        return Object.values(exchangeCoverage).some((coverage) => coverage.has(symbol));
      };

      const fetchPrices = async () => {
        try {
          const { data: alerts } = await supabase
            .from('price_alerts')
            .select('symbol')
            .eq('active', true);

          if (!alerts?.length) return;

          const symbols = [...new Set(alerts.map((a) => a.symbol))];
          const symbolsToFetch = symbols.filter((symbol) => !isSymbolOnMajorExchange(symbol));

          if (!symbolsToFetch.length) return;

          // Process symbols in batches
          for (let i = 0; i < symbolsToFetch.length; i += 5) {
            const batch = symbolsToFetch.slice(i, i + 5);
            await Promise.all(
              batch.map(async (symbol) => {
                try {
                  // Try Uniswap first
                  const uniswapPrice = await queryUniswapPrice(symbol);
                  if (uniswapPrice) {
                    await updatePriceCache(symbol, uniswapPrice.price);
                    return;
                  }

                  // Fallback to PancakeSwap
                  const pancakePrice = await queryPancakeSwapPrice(symbol);
                  if (pancakePrice) {
                    await updatePriceCache(symbol, pancakePrice.price);
                  }
                } catch (error) {
                  console.error(`Error getting DEX price for ${symbol}:`, error);
                }
              })
            );
          }
        } catch (error) {
          console.error('DEX price fetch error:', error);
          // Shorter retry delay on error (10 seconds max)
          await new Promise((resolve) =>
            setTimeout(resolve, Math.min(POLLING_INTERVAL * 2, 10000))
          );
        }
      };

      // Initial fetch
      await fetchPrices();

      // Set up polling with dynamic adjustment
      let currentInterval = POLLING_INTERVAL;
      const intervalId = setInterval(async () => {
        const start = Date.now();
        await fetchPrices();
        const duration = Date.now() - start;

        // Dynamically adjust polling interval based on processing time
        // Never go slower than POLLING_INTERVAL, but can go faster if processing is quick
        currentInterval = Math.max(POLLING_INTERVAL, Math.min(duration * 2, 10000));
        if (intervalId) {
          clearInterval(intervalId);
        }
        (exchangeConnections.dex as any).intervalId = setInterval(fetchPrices, currentInterval);
      }, currentInterval);

      (exchangeConnections.dex as any).intervalId = intervalId;
    },
    disconnect: () => {
      if ((exchangeConnections.dex as any).intervalId) {
        clearInterval((exchangeConnections.dex as any).intervalId);
      }
    },
  },
};

// Query Uniswap price using TheGraph
async function queryUniswapPrice(symbol: string) {
  const query = `{
    token(id: "${symbol.toLowerCase()}") {
      derivedETH
      tradeVolumeUSD
      totalLiquidity
    }
    bundle(id: "1") {
      ethPrice
    }
  }`;

  const response = await fetch(SUBGRAPH_ENDPOINTS.uniswap, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });

  const data = await response.json();
  if (data.data.token && data.data.bundle) {
    const price = parseFloat(data.data.token.derivedETH) * parseFloat(data.data.bundle.ethPrice);
    return { price };
  }

  return null;
}

// Query PancakeSwap price
async function queryPancakeSwapPrice(symbol: string) {
  const query = `{
    token(id: "${symbol.toLowerCase()}") {
      derivedBNB
      tradeVolumeUSD
      totalLiquidity
    }
    bundle(id: "1") {
      bnbPrice
    }
  }`;

  const response = await fetch(SUBGRAPH_ENDPOINTS.pancakeswap, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });

  const data = await response.json();
  if (data.data.token && data.data.bundle) {
    const price = parseFloat(data.data.token.derivedBNB) * parseFloat(data.data.bundle.bnbPrice);
    return { price };
  }

  return null;
}

// Check combined conditions
async function checkCombinedConditions(symbol: string, price: number, percentageChange?: number) {
  const now = Date.now();

  // Clean up old cache entries
  Array.from(priceCache.entries()).forEach(([key, value]) => {
    if (now - value.timestamp > CACHE_TTL) {
      priceCache.delete(key);
    }
  });

  // Update the cache for the current symbol with the provided percentage change
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

// Get active conditions from database
async function getActiveConditions(): Promise<ConditionGroup[] | null> {
  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from('condition_groups')
      .select('*')
      .eq('active', true);

    if (error) {
      console.error('Error fetching active conditions:', error);
      return null;
    }

    return data as ConditionGroup[];
  } catch (error) {
    console.error('Error in getActiveConditions:', error);
    return null;
  }
}


export async function stopMonitoring() {
  // Clean up WebSocket connections
  if (priceSocket) {
    priceSocket.close();
    priceSocket = null;
  }

  if (socialSocket) {
    socialSocket.close();
    socialSocket = null;
  }

  // Clear heartbeat intervals
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }

  if (socialHeartbeatInterval) {
    clearInterval(socialHeartbeatInterval);
    socialHeartbeatInterval = null;
  }

  // Stop price monitoring on exchanges
  await stopPriceMonitoring();
  return { success: true };
}

export async function checkHealth() {
  return isMonitoringActive;
}
