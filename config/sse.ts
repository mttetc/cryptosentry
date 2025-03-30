import { z } from 'zod';
import { MONITORING_CONFIG } from './constants';

const sseConfigSchema = z.object({
  maxRetries: z.number().min(1).default(3),
  backoffMultiplier: z.number().min(1).default(1.5),
  reconnectInterval: z.number().min(1000).default(5000), // Base interval for reconnection backoff
  connectionTimeout: z.number().min(1000).default(3600000), // 1 hour default
  heartbeatInterval: z.number().min(1000).default(30000), // 30 seconds default
  maxConnectionsPerUser: z.number().min(1).default(5), // Max concurrent connections per user
  rateLimitRequests: z.number().min(1).default(100), // Number of requests allowed
  rateLimitWindow: z.number().min(1).default(60), // Time window in seconds
});

function loadConfig() {
  const config = {
    maxRetries: MONITORING_CONFIG.SSE.MAX_RETRIES,
    backoffMultiplier: MONITORING_CONFIG.SSE.BACKOFF_MULTIPLIER,
    reconnectInterval: MONITORING_CONFIG.SSE.RECONNECT_INTERVAL,
    connectionTimeout: 3600000, // 1 hour
    heartbeatInterval: 30000, // 30 seconds
    maxConnectionsPerUser: 5,
    rateLimitRequests: 100,
    rateLimitWindow: 60, // 60 seconds
  };

  return sseConfigSchema.parse(config);
}

export type SSEConfig = z.infer<typeof sseConfigSchema>;
export const sseConfig = loadConfig();
