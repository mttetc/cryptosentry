import { z } from 'zod';

// Configuration schema
const configSchema = z.object({
  polling: z.object({
    interval: z.number().min(1000).default(5000),
    maxRetries: z.number().min(1).default(3),
    backoffMultiplier: z.number().min(1).default(1.5),
  }),
  cache: z.object({
    ttl: z.number().min(1000).default(60000),
    maxSize: z.number().min(100).default(1000),
    cleanupThreshold: z.number().min(100).default(800),
  }),
  websocket: z.object({
    initialBackoff: z.number().min(100).default(1000),
    maxBackoff: z.number().min(1000).default(30000),
    backoffMultiplier: z.number().min(1).default(1.5),
    pingInterval: z.number().min(1000).default(30000),
    pingTimeout: z.number().min(1000).default(5000),
    reconnectAttempts: z.number().min(1).default(5),
  }),
  exchanges: z.object({
    endpoints: z.object({
      uniswap: z.string().url(),
      pancakeswap: z.string().url(),
    }),
    batchSize: z.number().min(1).default(5),
  }),
});

// Load and validate configuration
function loadConfig() {
  const config = {
    polling: {
      interval: Number(process.env.POLLING_INTERVAL) || 5000,
      maxRetries: Number(process.env.MAX_RETRIES) || 3,
      backoffMultiplier: Number(process.env.BACKOFF_MULTIPLIER) || 1.5,
    },
    cache: {
      ttl: Number(process.env.CACHE_TTL) || 60000,
      maxSize: Number(process.env.MAX_CACHE_SIZE) || 1000,
      cleanupThreshold: Number(process.env.CACHE_CLEANUP_THRESHOLD) || 800,
    },
    websocket: {
      initialBackoff: Number(process.env.WS_INITIAL_BACKOFF) || 1000,
      maxBackoff: Number(process.env.WS_MAX_BACKOFF) || 30000,
      backoffMultiplier: Number(process.env.WS_BACKOFF_MULTIPLIER) || 1.5,
      pingInterval: Number(process.env.WS_PING_INTERVAL) || 30000,
      pingTimeout: Number(process.env.WS_PING_TIMEOUT) || 5000,
      reconnectAttempts: Number(process.env.WS_RECONNECT_ATTEMPTS) || 5,
    },
    exchanges: {
      endpoints: {
        uniswap: process.env.UNISWAP_ENDPOINT || 'https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v2',
        pancakeswap: process.env.PANCAKESWAP_ENDPOINT || 'https://api.thegraph.com/subgraphs/name/pancakeswap/exchange-v2',
      },
      batchSize: Number(process.env.EXCHANGE_BATCH_SIZE) || 5,
    },
  };

  return configSchema.parse(config);
}

export type Config = z.infer<typeof configSchema>;
export const config = loadConfig(); 