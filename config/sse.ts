import { z } from 'zod';

const sseConfigSchema = z.object({
  interval: z.number().min(1000).default(5000),
  maxRetries: z.number().min(1).default(3),
  backoffMultiplier: z.number().min(1).default(1.5),
});

function loadConfig() {
  const config = {
    interval: Number(process.env.SSE_INTERVAL) || 5000,
    maxRetries: Number(process.env.SSE_MAX_RETRIES) || 3,
    backoffMultiplier: Number(process.env.SSE_BACKOFF_MULTIPLIER) || 1.5,
  };

  return sseConfigSchema.parse(config);
}

export type SSEConfig = z.infer<typeof sseConfigSchema>;
export const sseConfig = loadConfig(); 