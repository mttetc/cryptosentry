'use server';

import { monitorPrice } from '@/actions/monitor/lib/core';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { ExchangeState, PriceAlert } from '../types';

// Start price monitoring
export async function startPriceMonitoring(): Promise<ExchangeState> {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: alerts } = await supabase
      .from('price_alerts')
      .select('symbol, target_price')
      .eq('active', true);

    if (!alerts?.length) return { success: true };

    // Process alerts
    for (const alert of alerts as PriceAlert[]) {
      await monitorPrice(alert.symbol, alert.target_price);
    }

    return { success: true };
  } catch (error) {
    console.error('Error starting price monitoring:', error);
    return { success: false, error: 'Failed to start price monitoring' };
  }
}
