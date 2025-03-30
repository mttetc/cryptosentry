import { z } from 'zod';

// Configuration schema
const configSchema = z.object({
  sse: z.object({
    maxRetries: z.number().min(1).default(3),
    backoffMultiplier: z.number().min(1).default(1.5),
  }),
  batchSize: z.number().min(1).default(50),
});

// SSE Configuration
export const SSE_CONFIG = {
  maxRetries: 3,
  backoffMultiplier: 1.5,
  reconnectInterval: 5000,
  connectionTimeout: 3600000,
  heartbeatInterval: 30000,
  maxConnectionsPerUser: 5,
  rateLimitRequests: 100,
  rateLimitWindow: 60,
  batchSize: 50,
} as const;

// Load and validate configuration
function loadConfig() {
  const config = {
    sse: {
      maxRetries: SSE_CONFIG.maxRetries,
      backoffMultiplier: SSE_CONFIG.backoffMultiplier,
    },
    batchSize: SSE_CONFIG.batchSize,
  };

  return configSchema.parse(config);
}

export const config = loadConfig();
