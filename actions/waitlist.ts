'use server';

import { createServerSupabaseClient } from '@/lib/supabase-server';
import { z } from 'zod';

const waitlistSchema = z.object({
  email: z.string().email(),
  country: z.string().min(1),
});

export type State = {
  error?: string;
  success?: boolean;
};

export async function joinWaitlist(prevState: State | null, formData: FormData): Promise<State> {
  try {
    const validatedData = waitlistSchema.parse({
      email: formData.get('email'),
      country: formData.get('country'),
    });

    // Create Supabase client
    const supabase = await createServerSupabaseClient();

    // Check if email already exists
    const { data: existingEntry } = await supabase
      .from('waitlist')
      .select()
      .eq('email', validatedData.email)
      .single();

    if (existingEntry) {
      return {
        error: 'This email is already on the waitlist',
      };
    }

    // Insert new entry
    const { error } = await supabase.from('waitlist').insert([validatedData]);

    if (error) throw error;

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
