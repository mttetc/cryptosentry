import { z } from 'zod';

export const SETTINGS = {
  CALL: {
    TIMEOUTS: {
      ANSWER: 12,
    },
    SPEECH: {
      RATE: 1.3,
      VOICE: 'female', // Default Telnyx TTS voice
      LANGUAGE: 'en-US', // Default language
    }
  },
  SMS: {
    MESSAGE: {
      MAX_LENGTH: 160,
      UNICODE_SUPPORT: true,
    },
  }
};

export const SUBSCRIPTION_TIERS = {
  BASIC: {
    name: 'Basic',
    price: 14.99,
    costPerUser: 0.342,
    grossMargin: 14.65,
  },
  PRO: {
    name: 'Pro',
    price: 24.99,
    costPerUser: 1.14,
    grossMargin: 23.85,
  }
} as const;

// Configuration schema
const configSchema = z.object({
  sse: z.object({
    interval: z.number().min(1000).default(5000),
    maxRetries: z.number().min(1).default(3),
    backoffMultiplier: z.number().min(1).default(1.5),
  }),
  cache: z.object({
    ttl: z.number().min(1000).default(60000),
    maxSize: z.number().min(100).default(1000),
    cleanupThreshold: z.number().min(100).default(800),
  }),
  exchanges: z.object({
    endpoints: z.object({
      binance: z.string().url(),
      coinbase: z.string().url(),
      kraken: z.string().url(),
    }),
  }),
});

// Load and validate configuration
function loadConfig() {
  const config = {
    sse: {
      interval: Number(process.env.SSE_INTERVAL) || 5000,
      maxRetries: Number(process.env.SSE_MAX_RETRIES) || 3,
      backoffMultiplier: Number(process.env.SSE_BACKOFF_MULTIPLIER) || 1.5,
    },
    cache: {
      ttl: Number(process.env.CACHE_TTL) || 60000,
      maxSize: Number(process.env.MAX_CACHE_SIZE) || 1000,
      cleanupThreshold: Number(process.env.CACHE_CLEANUP_THRESHOLD) || 800,
    },
    exchanges: {
      endpoints: {
        binance: process.env.BINANCE_ENDPOINT || 'https://api.binance.com/api/v3',
        coinbase: process.env.COINBASE_ENDPOINT || 'https://api.coinbase.com/v2',
        kraken: process.env.KRAKEN_ENDPOINT || 'https://api.kraken.com/0/public',
      },
    },
  };

  return configSchema.parse(config);
}

export const config = loadConfig();

export type SubscriptionTier = keyof typeof SUBSCRIPTION_TIERS; 