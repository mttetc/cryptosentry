import { z } from 'zod';

const monitorConfigSchema = z.object({
  apiKey: z.string().min(1),
  endpoints: z.object({
    events: z.string().url(),
  }),
});

function loadConfig() {
  const config = {
    apiKey: process.env.MONITOR_API_KEY!,
    endpoints: {
      events: `${process.env.NEXT_PUBLIC_APP_URL}/api/monitor/events`,
    },
  };

  return monitorConfigSchema.parse(config);
}

export type MonitorConfig = z.infer<typeof monitorConfigSchema>;
export const monitorConfig = loadConfig(); 