'use server';

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { priceAlertSchema, socialAlertSchema } from '../schemas';
import type { z } from 'zod';

export interface AlertState {
  error?: string;
  success: boolean;
}

export const initialAlertState: AlertState = {
  error: undefined,
  success: false,
};

async function getAuthenticatedClient() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.user.id) {
    throw new Error('Unauthorized');
  }

  return { supabase, userId: session.user.id };
}

export async function createPriceAlert(
  input: z.infer<typeof priceAlertSchema>
): Promise<AlertState> {
  try {
    const { supabase, userId } = await getAuthenticatedClient();
    const validated = priceAlertSchema.parse(input);

    const { error } = await supabase
      .from('price_alerts')
      .insert({
        user_id: userId,
        symbol: validated.symbol,
        target_price: validated.targetPrice,
        condition: validated.condition,
        active: true,
      })
      .select()
      .single();

    if (error) throw error;

    revalidatePath('/dashboard');
    return { success: true };
  } catch (error) {
    console.error('Failed to create price alert:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create price alert',
    };
  }
}

export async function createSocialAlert(
  input: z.infer<typeof socialAlertSchema>
): Promise<AlertState> {
  try {
    const { supabase, userId } = await getAuthenticatedClient();
    const validated = socialAlertSchema.parse(input);

    const { error } = await supabase
      .from('social_alerts')
      .insert({
        user_id: userId,
        account: validated.account,
        keywords: validated.keywords,
        active: true,
      })
      .select()
      .single();

    if (error) throw error;

    revalidatePath('/dashboard');
    return { success: true };
  } catch (error) {
    console.error('Failed to create social alert:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create social alert',
    };
  }
}

export async function getActiveAlerts() {
  try {
    const { supabase, userId } = await getAuthenticatedClient();

    const [priceAlerts, socialAlerts] = await Promise.all([
      supabase.from('price_alerts').select('*').eq('user_id', userId).eq('active', true),
      supabase.from('social_alerts').select('*').eq('user_id', userId).eq('active', true),
    ]);

    return {
      price: priceAlerts.data || [],
      social: socialAlerts.data || [],
    };
  } catch (error) {
    console.error('Failed to get active alerts:', error);
    return { price: [], social: [] };
  }
}
