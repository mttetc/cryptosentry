import { z } from 'zod';

export const userContactPreferencesSchema = z.object({
  phone: z.string().min(1),
  prefer_sms: z.boolean(),
  active_24h: z.boolean(),
  quiet_hours_start: z.string().nullable(),
  quiet_hours_end: z.string().nullable(),
  weekends_enabled: z.boolean(),
  canSend: z.boolean(),
  reason: z.string().optional(),
});

export type UserContactPreferences = z.infer<typeof userContactPreferencesSchema>;
