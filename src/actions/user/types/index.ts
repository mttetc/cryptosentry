import { z } from 'zod';

export const notificationPreferencesSchema = z.object({
  phone: z.string().min(1),
  prefer_sms: z.boolean(),
  active_24h: z.boolean(),
  quiet_hours_start: z.string().nullable(),
  quiet_hours_end: z.string().nullable(),
  weekends_enabled: z.boolean(),
  telegram_enabled: z.boolean().optional(),
  telegram_chat_id: z.string().nullable().optional(),
  telegram_setup_in_progress: z.boolean().optional(),
});

export type NotificationPreferences = z.infer<typeof notificationPreferencesSchema>;

export interface UserState {
  success: boolean;
  error?: string;
}
