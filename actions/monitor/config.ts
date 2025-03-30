import { z } from 'zod';
import { MONITORING_CONFIG } from '@/config/constants';

// Configuration schema
const configSchema = z.object({
  sse: z.object({
    maxRetries: z.number().min(1).default(3),
    backoffMultiplier: z.number().min(1).default(1.5),
  }),
  batchSize: z.number().min(1).default(50),
});

// Load and validate configuration
function loadConfig() {
  const config = {
    sse: {
      maxRetries: MONITORING_CONFIG.SSE.MAX_RETRIES,
      backoffMultiplier: MONITORING_CONFIG.SSE.BACKOFF_MULTIPLIER,
    },
    batchSize: MONITORING_CONFIG.BATCH_SIZE,
  };

  return configSchema.parse(config);
}

export const config = loadConfig();
