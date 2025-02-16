'use server';

import { monitorPrice } from '@/actions/alerts';
import { z } from 'zod';
import { createServerSupabaseClient } from '@/lib/supabase';

// Types
interface PriceAlert {
  symbol: string;
  target_price: number;
}

// Start price monitoring
export async function startPriceMonitoring() {
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
    return { error: 'Failed to start price monitoring' };
  }
}

// Stop price monitoring (no-op since we're not using WebSocket anymore)
export async function stopPriceMonitoring() {
  return { success: true };
}
