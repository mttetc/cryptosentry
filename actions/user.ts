'use server';

import { createServerSupabaseClient } from '@/lib/supabase';
import { z } from 'zod';

const preferencesSchema = z.object({
  active_24h: z.boolean(),
  quiet_hours_start: z.string().nullable(),
  quiet_hours_end: z.string().nullable(),
  weekends_enabled: z.boolean(),
  prefer_sms: z.boolean(),
});

type UserPreferences = z.infer<typeof preferencesSchema>;

export async function updateUserPreferences(
  preferences: UserPreferences
): Promise<{ success: boolean; error?: string }> {
  try {
    const validatedPrefs = preferencesSchema.parse(preferences);
    
    const supabase = await createServerSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session?.user.id) {
      throw new Error('Unauthorized');
    }

    const { error } = await supabase
      .from('users')
      .update({
        active_24h: validatedPrefs.active_24h,
        quiet_hours_start: validatedPrefs.quiet_hours_start,
        quiet_hours_end: validatedPrefs.quiet_hours_end,
        weekends_enabled: validatedPrefs.weekends_enabled,
        prefer_sms: validatedPrefs.prefer_sms,
      })
      .eq('id', session.user.id);

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

export async function getUserPreferences(): Promise<UserPreferences | null> {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session?.user.id) {
      return null;
    }

    const { data, error } = await supabase
      .from('users')
      .select('active_24h, quiet_hours_start, quiet_hours_end, weekends_enabled, prefer_sms')
      .eq('id', session.user.id)
      .single();

    if (error) throw error;

    return preferencesSchema.parse(data);
  } catch (error) {
    console.error('Failed to get preferences:', error);
    return null;
  }
} 