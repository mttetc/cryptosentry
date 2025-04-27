import { z } from 'zod';

export const userContactPreferencesSchema = z.object({
  phone: z.string().optional(),
  prefer_sms: z.boolean().optional(),
  active_24h: z.boolean().optional(),
  quiet_hours_start: z.string().optional(),
  quiet_hours_end: z.string().optional(),
  weekends_enabled: z.boolean().optional(),
  canSend: z.boolean().optional(),
  reason: z.string().optional(),
  telegramEnabled: z.boolean().optional(),
  telegramChatId: z.string().optional(),
});

export type UserContactPreferences = z.infer<typeof userContactPreferencesSchema>;

export function isWithinQuietHours(prefs: UserContactPreferences): boolean {
  if (!prefs.quiet_hours_start || !prefs.quiet_hours_end) return false;

  const now = new Date();
  const start = new Date();
  const end = new Date();
  const [startHour, startMinute] = prefs.quiet_hours_start.split(':').map(Number);
  const [endHour, endMinute] = prefs.quiet_hours_end.split(':').map(Number);

  start.setHours(startHour, startMinute, 0);
  end.setHours(endHour, endMinute, 0);

  return now >= start && now <= end;
}
