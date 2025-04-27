'use server';

import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { NotificationPreferences, UserState } from '../types/index';
import { notificationPreferencesSchema } from '../types/index';

export async function updateUserPreferences(
  preferences: NotificationPreferences
): Promise<UserState> {
  try {
    const validatedPrefs = notificationPreferencesSchema.parse(preferences);

    const supabase = await createServerSupabaseClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user.id) {
      throw new Error('Unauthorized');
    }

    const { error } = await supabase.from('user_notification_settings').upsert({
      user_id: session.user.id,
      phone: validatedPrefs.phone,
      prefer_sms: validatedPrefs.prefer_sms,
      active_24h: validatedPrefs.active_24h,
      quiet_hours_start: validatedPrefs.quiet_hours_start,
      quiet_hours_end: validatedPrefs.quiet_hours_end,
      weekends_enabled: validatedPrefs.weekends_enabled,
      telegram_enabled: validatedPrefs.telegram_enabled,
      telegram_chat_id: validatedPrefs.telegram_chat_id,
      telegram_setup_in_progress: validatedPrefs.telegram_setup_in_progress,
      updated_at: new Date().toISOString(),
    });

    if (error) throw error;

    return { success: true };
  } catch (error) {
    console.error('Failed to update preferences:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update preferences',
    };
  }
}

export async function getUserPreferences(): Promise<NotificationPreferences | null> {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user.id) {
      return null;
    }

    const { data, error } = await supabase
      .from('user_notification_settings')
      .select(
        'phone, prefer_sms, active_24h, quiet_hours_start, quiet_hours_end, weekends_enabled, telegram_enabled, telegram_chat_id, telegram_setup_in_progress'
      )
      .eq('user_id', session.user.id)
      .single();

    if (error) {
      console.error('Error fetching user preferences:', error);
      return null;
    }

    if (!data) {
      return null;
    }

    return notificationPreferencesSchema.parse(data);
  } catch (error) {
    console.error('Error in getUserPreferences:', error);
    return null;
  }
}
