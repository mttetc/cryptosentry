import { z } from 'zod';
import { SSE_CONFIG } from '@/actions/monitor/config';
import { FEATURES } from './features';

const sseConfigSchema = z.object({
  maxRetries: z.number().min(1).default(3),
  backoffMultiplier: z.number().min(1).default(1.5),
  reconnectInterval: z.number().min(1000).default(5000), // Base interval for reconnection backoff
  connectionTimeout: z.number().min(1000).default(3600000), // 1 hour default
  heartbeatInterval: z.number().min(1000).default(30000), // 30 seconds default
  maxConnectionsPerUser: z.number().min(1).default(5), // Max concurrent connections per user
  rateLimitRequests: z.number().min(1).default(100), // Number of requests allowed
  rateLimitWindow: z.number().min(1).default(60), // Time window in seconds
  batchSize: z.number().min(1).default(50),
  maxMessageSize: z
    .number()
    .min(1)
    .default(1024 * 1024), // 1MB
  rateLimitBlockDuration: z.number().min(1).default(300000), // 5 minutes
  maxConsecutiveFailures: z.number().min(1).default(20),
});

function loadConfig() {
  const config = {
    maxRetries: SSE_CONFIG.maxRetries,
    backoffMultiplier: SSE_CONFIG.backoffMultiplier,
    reconnectInterval: SSE_CONFIG.reconnectInterval,
    connectionTimeout: SSE_CONFIG.connectionTimeout,
    heartbeatInterval: SSE_CONFIG.heartbeatInterval,
    maxConnectionsPerUser: FEATURES.isDevMode ? 100 : 5,
    rateLimitRequests: SSE_CONFIG.rateLimitRequests,
    rateLimitWindow: SSE_CONFIG.rateLimitWindow,
    batchSize: SSE_CONFIG.batchSize,
    maxMessageSize: SSE_CONFIG.maxMessageSize,
    rateLimitBlockDuration: SSE_CONFIG.rateLimitBlockDuration,
    maxConsecutiveFailures: SSE_CONFIG.maxConsecutiveFailures,
  };

  return sseConfigSchema.parse(config);
}

export type SSEConfig = z.infer<typeof sseConfigSchema>;
export const sseConfig = loadConfig();
