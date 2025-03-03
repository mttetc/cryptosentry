import { z } from 'zod';

const sseConfigSchema = z.object({
  interval: z.number().min(1000).default(5000),
  maxRetries: z.number().min(1).default(3),
  backoffMultiplier: z.number().min(1).default(1.5),
  connectionTimeout: z.number().min(1000).default(3600000), // 1 hour default
  heartbeatInterval: z.number().min(1000).default(30000), // 30 seconds default
  maxConnectionsPerUser: z.number().min(1).default(5), // Max concurrent connections per user
  rateLimitRequests: z.number().min(1).default(100), // Number of requests allowed
  rateLimitWindow: z.number().min(1).default(60), // Time window in seconds
});

function loadConfig() {
  const config = {
    interval: Number(process.env.SSE_INTERVAL) || 5000,
    maxRetries: Number(process.env.SSE_MAX_RETRIES) || 3,
    backoffMultiplier: Number(process.env.SSE_BACKOFF_MULTIPLIER) || 1.5,
    connectionTimeout: Number(process.env.SSE_CONNECTION_TIMEOUT) || 3600000, // 1 hour
    heartbeatInterval: Number(process.env.SSE_HEARTBEAT_INTERVAL) || 30000, // 30 seconds
    maxConnectionsPerUser: Number(process.env.SSE_MAX_CONNECTIONS_PER_USER) || 5,
    rateLimitRequests: Number(process.env.SSE_RATE_LIMIT_REQUESTS) || 100,
    rateLimitWindow: Number(process.env.SSE_RATE_LIMIT_WINDOW) || 60, // 60 seconds
  };

  return sseConfigSchema.parse(config);
}

export type SSEConfig = z.infer<typeof sseConfigSchema>;
export const sseConfig = loadConfig();
