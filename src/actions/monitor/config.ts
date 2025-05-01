import { z } from 'zod';
import { FEATURES } from '@/lib/config/features';

// Configuration schema
const configSchema = z.object({
  sse: z.object({
    maxRetries: z.number().min(1).default(3),
    backoffMultiplier: z.number().min(1).default(1.5),
    reconnectInterval: z.number().min(1000).default(5000),
    connectionTimeout: z.number().min(1000).default(3600000),
    heartbeatInterval: z.number().min(1000).default(30000),
    maxConnectionsPerUser: z.number().min(1).default(5),
    rateLimitRequests: z.number().min(1).default(100),
    rateLimitWindow: z.number().min(1).default(60),
    batchSize: z.number().min(1).default(50),
    maxMessageSize: z
      .number()
      .min(1)
      .default(1024 * 1024),
    rateLimitBlockDuration: z.number().min(1).default(300000),
    maxConsecutiveFailures: z.number().min(1).default(20),
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
  maxConnectionsPerUser: FEATURES.isDevMode ? 100 : 5,
  rateLimitRequests: 1000,
  rateLimitWindow: 60,
  batchSize: 50,
  maxMessageSize: 1024 * 1024,
  rateLimitBlockDuration: 300000,
  maxConsecutiveFailures: 20,
} as const;

// Load and validate configuration
function loadConfig() {
  const config = {
    sse: {
      maxRetries: SSE_CONFIG.maxRetries,
      backoffMultiplier: SSE_CONFIG.backoffMultiplier,
      reconnectInterval: SSE_CONFIG.reconnectInterval,
      connectionTimeout: SSE_CONFIG.connectionTimeout,
      heartbeatInterval: SSE_CONFIG.heartbeatInterval,
      maxConnectionsPerUser: SSE_CONFIG.maxConnectionsPerUser,
      rateLimitRequests: SSE_CONFIG.rateLimitRequests,
      rateLimitWindow: SSE_CONFIG.rateLimitWindow,
      batchSize: SSE_CONFIG.batchSize,
      maxMessageSize: SSE_CONFIG.maxMessageSize,
      rateLimitBlockDuration: SSE_CONFIG.rateLimitBlockDuration,
      maxConsecutiveFailures: SSE_CONFIG.maxConsecutiveFailures,
    },
    batchSize: SSE_CONFIG.batchSize,
  };

  return configSchema.parse(config);
}

export const config = loadConfig();
