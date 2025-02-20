import { z } from 'zod';

// Configuration schema
const configSchema = z.object({
  sse: z.object({
    interval: z.number().min(1000).default(5000),
    maxRetries: z.number().min(1).default(3),
    backoffMultiplier: z.number().min(1).default(1.5),
  }),
  monitoring: z.object({
    priceCheck: z.object({
      interval: z.number().min(1000).default(60000),
      batchSize: z.number().min(1).default(50),
    }),
    socialCheck: z.object({
      interval: z.number().min(1000).default(300000),
      batchSize: z.number().min(1).default(20),
    }),
  }),
  cache: z.object({
    ttl: z.number().min(1000).default(60000),
    maxSize: z.number().min(100).default(1000),
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
    monitoring: {
      priceCheck: {
        interval: Number(process.env.PRICE_CHECK_INTERVAL) || 60000,
        batchSize: Number(process.env.PRICE_CHECK_BATCH_SIZE) || 50,
      },
      socialCheck: {
        interval: Number(process.env.SOCIAL_CHECK_INTERVAL) || 300000,
        batchSize: Number(process.env.SOCIAL_CHECK_BATCH_SIZE) || 20,
      },
    },
    cache: {
      ttl: Number(process.env.CACHE_TTL) || 60000,
      maxSize: Number(process.env.MAX_CACHE_SIZE) || 1000,
    },
  };

  return configSchema.parse(config);
}

export const config = loadConfig(); 