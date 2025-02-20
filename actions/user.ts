'use server';

import { createServerSupabaseClient } from '@/lib/supabase';
import { z } from 'zod';

const notificationPreferencesSchema = z.object({
  phone: z.string().min(1),
  prefer_sms: z.boolean(),
  active_24h: z.boolean(),
  quiet_hours_start: z.string().nullable(),
  quiet_hours_end: z.string().nullable(),
  weekends_enabled: z.boolean(),
});

type NotificationPreferences = z.infer<typeof notificationPreferencesSchema>;

export async function updateUserPreferences(
  preferences: NotificationPreferences
): Promise<{ success: boolean; error?: string }> {
  try {
    const validatedPrefs = notificationPreferencesSchema.parse(preferences);
    
    const supabase = await createServerSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session?.user.id) {
      throw new Error('Unauthorized');
    }

    const { error } = await supabase
      .from('user_notification_settings')
      .upsert({
        user_id: session.user.id,
        phone: validatedPrefs.phone,
        prefer_sms: validatedPrefs.prefer_sms,
        active_24h: validatedPrefs.active_24h,
        quiet_hours_start: validatedPrefs.quiet_hours_start,
        quiet_hours_end: validatedPrefs.quiet_hours_end,
        weekends_enabled: validatedPrefs.weekends_enabled,
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
    const { data: { session } } = await supabase.auth.getSession();

    if (!session?.user.id) {
      return null;
    }

    const { data, error } = await supabase
      .from('user_notification_settings')
      .select('phone, prefer_sms, active_24h, quiet_hours_start, quiet_hours_end, weekends_enabled')
      .eq('user_id', session.user.id)
      .single();

    if (error) throw error;

    return notificationPreferencesSchema.parse(data);
  } catch (error) {
    console.error('Failed to get preferences:', error);
    return null;
  }
} 