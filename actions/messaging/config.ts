import { z } from 'zod';

export const SETTINGS = {
  CALL: {
    LIMITS: {
      DAILY: 30,
      CONCURRENT: 5,
      PER_MINUTE: 10,
    },
    DURATION: {
      MAX: 6, // Maximum 6 seconds
      MIN: 2, // Minimum duration to ensure message is heard
    },
    COOLDOWN: {
      DURATION: 60, // 60 seconds between calls
      CHECK_INTERVAL: 1000, // Check cooldown every second
    },
    SPEECH: {
      RATE: 1.3,
      VOICE: 'female', // Default Telnyx TTS voice
      LANGUAGE: 'en-US', // Default language
      WORDS_PER_SECOND: 2.5,
      MAX_WORDS: Math.floor(2.5 * 1.3 * 6), // Based on duration and rate
      OPTIMIZATION: {
        REMOVE_PATTERNS: [
          /please|kindly|would you|could you/gi,
          /notification|alert|message/gi,
          /your|the|a|an/gi,
        ],
      },
    },
    TIMEOUTS: {
      ANSWER: 12,
      MACHINE: 3,
      DTMF: 2,
    },
    AMD: {
      DEFAULT_CONFIG: {
        TOTAL_ANALYSIS_TIME: 5000,
        AFTER_GREETING_SILENCE: 800,
        BETWEEN_WORDS_SILENCE: 500,
        GREETING_DURATION: 3500,
        INITIAL_SILENCE: 3000,
        MAX_WORDS: 5,
        MAX_WORD_LENGTH: 3000,
        SILENCE_THRESHOLD: 500,
        GREETING_TOTAL_ANALYSIS_TIME: 5000,
        GREETING_SILENCE_DURATION: 1500,
      },
      RESPONSE_DELAYS: {
        HUMAN: 500,    // Wait 500ms before speaking to a human
        MACHINE: 1000, // Wait 1s after beep detection
      },
    },
  },
  SMS: {
    LIMITS: {
      DAILY: 50,
      PER_MINUTE: 20,
    },
    COOLDOWN: {
      DURATION: 30, // 30 seconds between SMS
      CHECK_INTERVAL: 1000,
    },
    MESSAGE: {
      MAX_LENGTH: 160,
      UNICODE_SUPPORT: true,
    },
  },
  ERROR_HANDLING: {
    AUTO_RETRY_CODES: [408, 500, 502, 503, 504],
    MAX_RETRIES: 2,
    BACKOFF: {
      INITIAL_DELAY: 60000, // 1 minute
      MULTIPLIER: 2,
      MAX_DELAY: 300000, // 5 minutes
    },
  },
  DID_ROTATION: {
    STRATEGY: 'round-robin' as const,
    BACKUP_NUMBER: process.env.BULKVS_FROM_NUMBER!,
    MAX_CONSECUTIVE_USES: 10,
  },
} as const;

export const SUBSCRIPTION_TIERS = {
  BASIC: {
    name: 'Basic',
    price: 14.99,
    limits: {
      calls: {
        daily: 30,
        concurrent: 3,
        perMinute: 5,
      },
      sms: {
        daily: 50,
        perMinute: 10,
      },
    },
    costPerUser: 0.342,
    grossMargin: 14.65,
  },
  PRO: {
    name: 'Pro',
    price: 24.99,
    limits: {
      calls: {
        daily: 100,
        concurrent: 5,
        perMinute: 10,
      },
      sms: {
        daily: 150,
        perMinute: 20,
      },
    },
    costPerUser: 1.14,
    grossMargin: 23.85,
  },
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