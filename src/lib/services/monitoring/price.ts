'use server';

import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { MonitorState } from '@/actions/monitor/schemas/monitor';

export async function monitorPrice(symbol: string, price: number): Promise<MonitorState> {
  try {
    const supabase = await createServerSupabaseClient();

    // Get active price alerts for this symbol
    const { price: priceAlerts } = await getActiveAlerts();
    const relevantAlerts = priceAlerts.filter((alert) => alert.symbol === symbol);

    // Check each alert's conditions
    for (const alert of relevantAlerts) {
      const isTriggered =
        (alert.condition === 'above' && price >= alert.targetPrice) ||
        (alert.condition === 'below' && price <= alert.targetPrice);

      if (isTriggered) {
        // Record the trigger
        await supabase.from('alert_triggers').insert({
          alert_id: alert.id,
          triggered_at: new Date().toISOString(),
          price: price,
        });

        // Optionally deactivate one-time alerts
        if (!alert.is_recurring) {
          await supabase.from('price_alerts').update({ active: false }).eq('id', alert.id);
        }
      }
    }

    return { success: true };
  } catch (error) {
    console.error('Failed to monitor price:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to monitor price',
    };
  }
}

async function getActiveAlerts() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error('User not authenticated');

  const [priceAlerts, socialAlerts] = await Promise.all([
    supabase.from('price_alerts').select('*').eq('user_id', user.id).eq('active', true),
    supabase.from('social_alerts').select('*').eq('user_id', user.id).eq('active', true),
  ]);

  return {
    price: priceAlerts.data || [],
    social: socialAlerts.data || [],
  };
}
