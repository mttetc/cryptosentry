'use server';

import { z } from 'zod';
import { createServerSupabaseClient } from '@/lib/supabase';
import { revalidatePath } from 'next/cache';

const signUpSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  phone: z.string().regex(/^\+[1-9]\d{1,14}$/, {
    message: 'Phone number must be in E.164 format (e.g., +33612345678)',
  }),
});

const signInSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export type AuthState = {
  error?: string;
  success?: boolean;
};

export async function signUp(prevState: AuthState, formData: FormData): Promise<AuthState> {
  try {
    const validatedFields = signUpSchema.parse({
      email: formData.get('email'),
      password: formData.get('password'),
      phone: formData.get('phone'),
    });

    const supabase = await createServerSupabaseClient();

    // Sign up the user with just email/password
    const { data: authData, error: signUpError } = await supabase.auth.signUp({
      email: validatedFields.email,
      password: validatedFields.password,
    });

    if (signUpError) throw signUpError;

    // Create user profile with phone number
    const { error: profileError } = await supabase.from('users').insert({
      id: authData.user?.id,
      phone: validatedFields.phone,
      active_24h: true, // default settings
      weekends_enabled: true,
    });

    if (profileError) throw profileError;

    revalidatePath('/auth');
    return { success: true };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Failed to sign up',
    };
  }
}

export async function signIn(prevState: AuthState, formData: FormData): Promise<AuthState> {
  try {
    const validatedFields = signInSchema.parse({
      email: formData.get('email'),
      password: formData.get('password'),
    });

    const supabase = await createServerSupabaseClient();

    const { error } = await supabase.auth.signInWithPassword({
      email: validatedFields.email,
      password: validatedFields.password,
    });

    if (error) throw error;

    revalidatePath('/auth');
    return { success: true };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Failed to sign in',
    };
  }
}

export async function signOut(): Promise<AuthState> {
  try {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.signOut();

    if (error) throw error;

    revalidatePath('/auth');
    return { success: true };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Failed to sign out',
    };
  }
}
