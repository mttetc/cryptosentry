'use server';

import { createServerSupabaseClient } from '@/lib/supabase/server';
import {
  userContactPreferencesSchema,
  type UserContactPreferences,
  isWithinQuietHours,
} from '@/actions/messaging/providers/notification-schemas';

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
      canSend: true,
    });

    // Check if notifications are allowed
    if (!prefs.active_24h) {
      return userContactPreferencesSchema.parse({
        ...prefs,
        canSend: false,
        reason: 'Notifications are disabled',
      });
    }

    // Check weekend restrictions
    const now = new Date();
    const isWeekend = now.getDay() === 0 || now.getDay() === 6;
    if (isWeekend && !prefs.weekends_enabled) {
      return userContactPreferencesSchema.parse({
        ...prefs,
        canSend: false,
        reason: 'Weekend notifications are disabled',
      });
    }

    // Check quiet hours
    if (isWithinQuietHours(prefs)) {
      return userContactPreferencesSchema.parse({
        ...prefs,
        canSend: false,
        reason: 'Currently in quiet hours',
      });
    }

    return prefs;
  } catch (error) {
    console.error('Failed to check user preferences:', error);
    return null;
  }
}

export async function formatAlertMessage(
  type: 'price' | 'social',
  data: Record<string, any>
): Promise<string> {
  if (type === 'price') {
    const direction = data.condition === 'above' ? 'risen above' : 'fallen below';
    return `${data.symbol} has ${direction} your target price of $${data.targetPrice}. Current price: $${data.price}`;
  }

  if (type === 'social') {
    return `New post from ${data.account} matches your keywords: ${data.keywords?.join(', ')}`;
  }

  return 'Alert triggered';
}
