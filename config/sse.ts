import { z } from 'zod';
import { SSE_CONFIG } from '@/actions/monitor/config';

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
});

function loadConfig() {
  const config = {
    maxRetries: SSE_CONFIG.maxRetries,
    backoffMultiplier: SSE_CONFIG.backoffMultiplier,
    reconnectInterval: SSE_CONFIG.reconnectInterval,
    connectionTimeout: SSE_CONFIG.connectionTimeout,
    heartbeatInterval: SSE_CONFIG.heartbeatInterval,
    maxConnectionsPerUser: SSE_CONFIG.maxConnectionsPerUser,
    rateLimitRequests: SSE_CONFIG.rateLimitRequests,
    rateLimitWindow: SSE_CONFIG.rateLimitWindow,
    batchSize: SSE_CONFIG.batchSize,
  };

  return sseConfigSchema.parse(config);
}

export type SSEConfig = z.infer<typeof sseConfigSchema>;
export const sseConfig = loadConfig();
