'use server';

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { z } from 'zod';
import { getUserCountry } from '@/actions/messaging/utils/geolocation';

const waitlistSchema = z.object({
  email: z.string().email(),
});

export type State = {
  error?: string;
  success?: boolean;
};

export async function getWaitlistCount() {
  try {
    const supabase = await createServerSupabaseClient();
    const { count, error } = await supabase
      .from('waitlist')
      .select('*', { count: 'exact', head: true });

    if (error) throw error;

    // If count is less than 15, return 20
    return count && count < 15 ? 20 : count;
  } catch (error) {
    console.error('Error getting waitlist count:', error);
    return 20; // Default to 20 if there's an error
  }
}

export async function joinWaitlist(prevState: State | null, formData: FormData): Promise<State> {
  try {
    const country = await getUserCountry();
    const validatedData = waitlistSchema.parse({
      email: formData.get('email'),
    });

    // Create Supabase client
    const supabase = await createServerSupabaseClient();

    // Check if email already exists
    const { data: existingEntry, error: existingError } = await supabase
      .from('waitlist')
      .select()
      .eq('email', validatedData.email)
      .single();

    if (existingError && existingError.code !== 'PGRST116') {
      throw existingError;
    }

    if (existingEntry) {
      return {
        error: 'This email is already on the waitlist',
      };
    }

    // Insert new entry with country
    const { error: insertError } = await supabase
      .from('waitlist')
      .insert([
        {
          ...validatedData,
          country,
        },
      ])
      .select();

    if (insertError) throw insertError;

    return {
      success: true,
    };
  } catch (error) {
    console.error('Waitlist submission error:', error);
    return {
      error: error instanceof Error ? error.message : 'Failed to join waitlist',
    };
  }
}
