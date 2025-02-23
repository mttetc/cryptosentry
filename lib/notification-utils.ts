import { z } from 'zod';
import { createServerSupabaseClient } from '@/lib/supabase';

export const userContactPreferencesSchema = z.object({
  phone: z.string().min(1),
  prefer_sms: z.boolean(),
  active_24h: z.boolean(),
  quiet_hours_start: z.string().nullable(),
  quiet_hours_end: z.string().nullable(),
  weekends_enabled: z.boolean(),
  canSend: z.boolean(),
  reason: z.string().optional()
});

export type UserContactPreferences = z.infer<typeof userContactPreferencesSchema>;

function isWithinQuietHours(prefs: UserContactPreferences): boolean {
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

export async function checkUserPreferences(userId: string): Promise<UserContactPreferences | null> {
  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from('user_notification_settings')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error || !data) return null;

    const prefs = userContactPreferencesSchema.parse({
      ...data,
      canSend: true
    });
    
    // Check if notifications are allowed
    if (!prefs.active_24h) {
      return userContactPreferencesSchema.parse({
        ...prefs,
        canSend: false,
        reason: 'Notifications are disabled'
      });
    }

    // Check weekend restrictions
    const now = new Date();
    const isWeekend = now.getDay() === 0 || now.getDay() === 6;
    if (isWeekend && !prefs.weekends_enabled) {
      return userContactPreferencesSchema.parse({
        ...prefs,
        canSend: false,
        reason: 'Weekend notifications are disabled'
      });
    }

    // Check quiet hours
    if (isWithinQuietHours(prefs)) {
      return userContactPreferencesSchema.parse({
        ...prefs,
        canSend: false,
        reason: 'Currently in quiet hours'
      });
    }

    return prefs;
  } catch (error) {
    console.error('Failed to check user preferences:', error);
    return null;
  }
}

export function formatAlertMessage(type: 'price' | 'social', data: Record<string, any>): string {
  if (type === 'price') {
    const direction = data.condition === 'above' ? 'risen above' : 'fallen below';
    return `${data.symbol} has ${direction} your target price of $${data.targetPrice}. Current price: $${data.price}`;
  }

  if (type === 'social') {
    return `New post from ${data.account} matches your keywords: ${data.keywords?.join(', ')}`;
  }

  return 'Alert triggered';
} 