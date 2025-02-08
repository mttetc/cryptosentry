'use server';

import { WebSocket } from 'ws';
import { monitorPrice } from '@/actions/alerts';
import { z } from 'zod';
import { createServerSupabaseClient } from '@/lib/supabase';

// Clean up unused types
type Exchange = 'binance' | 'coinbase' | 'kraken' | 'dex';
type ExchangeConnection = {
  ws: WebSocket | null;
  connect: () => Promise<void>;
  disconnect: () => void;
};

// Price cache for combined conditions
type PriceCache = {
  price: number;
  timestamp: number;
  percentageChange?: number;
};

const priceCache = new Map<string, PriceCache>();
const CACHE_TTL = 60000; // 1 minute cache TTL (reduced from 5 minutes)

// Track which symbols are covered by major exchanges
const exchangeCoverage: Record<string, Set<string>> = {
  binance: new Set(),
  coinbase: new Set(),
  kraken: new Set(),
};

// DEX Configuration
const POLLING_INTERVAL = 5000; // 5 seconds for DEX polling
const SUBGRAPH_ENDPOINTS = {
  uniswap: 'https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v2',
  pancakeswap: 'https://api.thegraph.com/subgraphs/name/pancakeswap/exchange-v2',
};
const MAX_CONCURRENT_REQUESTS = 5; // Limit concurrent DEX API calls

// Function to query DEX prices
async function getDexPrice(symbol: string): Promise<{ price: number; change24h?: number } | null> {
  try {
    // Try Uniswap first
    const uniswapPrice = await queryUniswapPrice(symbol);
    if (uniswapPrice) return uniswapPrice;

    // Fallback to PancakeSwap
    const pancakePrice = await queryPancakeSwapPrice(symbol);
    if (pancakePrice) return pancakePrice;

    return null;
  } catch (error) {
    console.error(`Error getting DEX price for ${symbol}:`, error);
    return null;
  }
}

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

// Batch processing for DEX queries
async function processDexBatch(symbols: string[]): Promise<void> {
  const batchPromises = symbols.map(async (symbol) => {
    const dexPrice = await getDexPrice(symbol);
    if (dexPrice) {
      await updatePriceCache(symbol, dexPrice.price, dexPrice.change24h);
    }
  });

  // Process in batches of MAX_CONCURRENT_REQUESTS
  for (let i = 0; i < batchPromises.length; i += MAX_CONCURRENT_REQUESTS) {
    const batch = batchPromises.slice(i, i + MAX_CONCURRENT_REQUESTS);
    await Promise.all(batch);
  }
}

const exchangeConnections: Record<Exchange, ExchangeConnection> = {
  binance: {
    ws: null,
    connect: async () => {
      if (exchangeConnections.binance.ws) {
        exchangeConnections.binance.ws.close();
      }

      exchangeConnections.binance.ws = new WebSocket('wss://stream.binance.com:9443/ws');

      // Get available symbols from Binance
      try {
        const response = await fetch('https://api.binance.com/api/v3/exchangeInfo');
        const data = await response.json();
        const symbols = data.symbols
          .filter((s: { quoteAsset: string }) => s.quoteAsset === 'USDT')
          .map((s: { baseAsset: string }) => s.baseAsset);
        exchangeCoverage.binance = new Set(symbols.map((s: string) => s.toUpperCase()));
      } catch (error) {
        console.error('Error fetching Binance symbols:', error);
      }

      exchangeConnections.binance.ws.on('open', () => {
        exchangeConnections.binance.ws?.send(
          JSON.stringify({
            method: 'SUBSCRIBE',
            params: ['!ticker@arr'],
            id: 1,
          })
        );
      });

      exchangeConnections.binance.ws.on('message', async (data) => {
        const ticker = JSON.parse(data.toString());
        if (ticker.c) {
          const symbol = ticker.s.replace('USDT', '');
          const price = parseFloat(ticker.c);
          await updatePriceCache(symbol, price);
        }
      });

      exchangeConnections.binance.ws.on('error', (error) => {
        console.error('Binance WebSocket error:', error);
        setTimeout(() => exchangeConnections.binance.connect(), 1000);
      });
    },
    disconnect: () => {
      if (exchangeConnections.binance.ws) {
        exchangeConnections.binance.ws.close();
        exchangeConnections.binance.ws = null;
      }
    },
  },

  dex: {
    ws: null,
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
          await processDexBatch(symbolsToFetch);
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

  coinbase: {
    ws: null,
    connect: async () => {
      if (exchangeConnections.coinbase.ws) {
        exchangeConnections.coinbase.ws.close();
      }

      exchangeConnections.coinbase.ws = new WebSocket('wss://ws-feed.pro.coinbase.com');

      // Get available symbols from Coinbase
      try {
        const response = await fetch('https://api.pro.coinbase.com/products');
        const products = await response.json();
        const symbols = products
          .filter((p: any) => p.quote_currency === 'USD')
          .map((p: any) => p.base_currency);
        exchangeCoverage.coinbase = new Set(symbols.map((s: string) => s.toUpperCase()));
      } catch (error) {
        console.error('Error fetching Coinbase symbols:', error);
      }

      exchangeConnections.coinbase.ws.on('open', () => {
        exchangeConnections.coinbase.ws?.send(
          JSON.stringify({
            type: 'subscribe',
            channels: [{ name: 'ticker', product_ids: ['BTC-USD', 'ETH-USD'] }],
          })
        );
      });

      exchangeConnections.coinbase.ws.on('message', async (data) => {
        const ticker = JSON.parse(data.toString());
        if (ticker.type === 'ticker') {
          const symbol = ticker.product_id.split('-')[0];
          const price = parseFloat(ticker.price);
          await monitorPrice(symbol, price);
        }
      });

      exchangeConnections.coinbase.ws.on('error', (error) => {
        console.error('Coinbase WebSocket error:', error);
        setTimeout(() => exchangeConnections.coinbase.connect(), 1000);
      });
    },
    disconnect: () => {
      if (exchangeConnections.coinbase.ws) {
        exchangeConnections.coinbase.ws.close();
        exchangeConnections.coinbase.ws = null;
      }
    },
  },
  kraken: {
    ws: null,
    connect: async () => {
      if (exchangeConnections.kraken.ws) {
        exchangeConnections.kraken.ws.close();
      }

      exchangeConnections.kraken.ws = new WebSocket('wss://ws.kraken.com');

      // Get available symbols from Kraken
      try {
        const response = await fetch('https://api.kraken.com/0/public/AssetPairs');
        const data = await response.json();
        const result = data.result as Record<string, KrakenPair>;
        const symbols = Object.values(result)
          .filter((p) => p.quote === 'ZUSD' || p.quote === 'USD')
          .map((p) => p.base.replace('X', '').replace('Z', ''));
        exchangeCoverage.kraken = new Set(symbols.map((s: string) => s.toUpperCase()));
      } catch (error) {
        console.error('Error fetching Kraken symbols:', error);
      }

      exchangeConnections.kraken.ws.on('open', () => {
        exchangeConnections.kraken.ws?.send(
          JSON.stringify({
            event: 'subscribe',
            pair: ['XBT/USD', 'ETH/USD'],
            subscription: { name: 'ticker' },
          })
        );
      });

      exchangeConnections.kraken.ws.on('message', async (data) => {
        const message = JSON.parse(data.toString());
        if (Array.isArray(message) && message[2] === 'ticker') {
          const symbol = message[3].split('/')[0].replace('XBT', 'BTC');
          const price = parseFloat(message[1].c[0]);
          await monitorPrice(symbol, price);
        }
      });

      exchangeConnections.kraken.ws.on('error', (error) => {
        console.error('Kraken WebSocket error:', error);
        setTimeout(() => exchangeConnections.kraken.connect(), 1000);
      });
    },
    disconnect: () => {
      if (exchangeConnections.kraken.ws) {
        exchangeConnections.kraken.ws.close();
        exchangeConnections.kraken.ws = null;
      }
    },
  },
};

// Update price cache and check conditions
async function updatePriceCache(symbol: string, price: number, change24h?: number) {
  const now = Date.now();
  const oldData = priceCache.get(symbol);

  let percentageChange: number | undefined;
  if (oldData && now - oldData.timestamp <= CACHE_TTL) {
    percentageChange = ((price - oldData.price) / oldData.price) * 100;
  }

  priceCache.set(symbol, {
    price,
    timestamp: now,
    percentageChange: change24h || percentageChange,
  });

  // Check for combined conditions
  await checkCombinedConditions(symbol, price, percentageChange);
}

// Combined condition schema
const combinedConditionSchema = z.object({
  assets: z.array(
    z.object({
      symbol: z.string(),
      condition: z.enum(['above', 'below', 'between', 'change']),
      value: z.number(),
      value2: z.number().optional(),
      percentageChange: z.number().optional(),
      timeWindow: z.number().optional(),
      isReference: z.boolean().optional(),
    })
  ),
  logicOperator: z.enum(['AND', 'OR']),
  referenceAsset: z.string().optional(), // For relative conditions
});

// Get active conditions from database
async function getActiveConditions() {
  try {
    const supabase = await createServerSupabaseClient();
    const { data } = await supabase
      .from('price_alerts')
      .select('*')
      .eq('active', true)
      .not('condition_type', 'is', null)
      .returns<PriceAlert[]>();

    if (!data?.length) return null;

    // Group alerts by their combined condition group
    const groupedAlerts = data.reduce((groups: Record<string, PriceAlert[]>, alert) => {
      const groupId = alert.group_id || 'default';
      if (!groups[groupId]) groups[groupId] = [];
      groups[groupId].push(alert);
      return groups;
    }, {});

    // Convert each group to the schema format
    return Object.values(groupedAlerts).map((alerts) => {
      const condition = {
        assets: alerts.map((alert) => ({
          symbol: alert.symbol,
          condition: alert.condition_type,
          value: alert.target_price,
          value2: alert.target_price_2,
          percentageChange: alert.percentage_change,
          timeWindow: alert.time_window,
          isReference: alert.is_reference,
        })),
        logicOperator: alerts[0].logic_operator,
        referenceAsset: alerts[0].reference_asset,
      };

      // Validate against schema
      return combinedConditionSchema.parse(condition);
    });
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

// Add type definitions
type CoinGeckoPrice = {
  usd: number;
  usd_24h_change: number;
};

type CoinGeckoPriceResponse = {
  [key: string]: CoinGeckoPrice;
};

type CoinGeckoCoin = {
  id: string;
  symbol: string;
  name: string;
};

// Database types
interface PriceAlert {
  id: string;
  symbol: string;
  condition_type: 'above' | 'below' | 'between' | 'change';
  target_price: number;
  target_price_2?: number;
  percentage_change?: number;
  is_reference: boolean;
  logic_operator: 'AND' | 'OR';
  group_id?: string;
  reference_asset?: string;
  active: boolean;
  time_window?: number;
}

// Add interface definitions for API responses
interface BinanceSymbol {
  quoteAsset: string;
  baseAsset: string;
}

interface KrakenPair {
  quote: string;
  base: string;
}

export async function startPriceMonitoring() {
  try {
    // Connect to all exchanges in parallel
    await Promise.all(Object.values(exchangeConnections).map((conn) => conn.connect()));
    return { success: true };
  } catch (error) {
    console.error('Error starting price monitoring:', error);
    return { error: 'Failed to start price monitoring' };
  }
}

export async function stopPriceMonitoring() {
  Object.values(exchangeConnections).forEach((conn) => conn.disconnect());
  return { success: true };
}
