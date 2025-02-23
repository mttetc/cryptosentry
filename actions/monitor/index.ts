'use server';

import { createServerSupabaseClient } from '@/lib/supabase';
import { startPriceMonitoring } from '@/actions/exchanges';
import { startSocialMonitoring } from '@/actions/social';
import { logError } from '@/lib/logger';
import 'server-only';

let monitoringPromise: Promise<void> | null = null;

/**
 * Initialize the monitoring service. This is idempotent and can be called multiple times safely.
 * If monitoring is already initialized, it will return the existing promise.
 */
export async function startMonitoring(): Promise<{ success: boolean; error?: string }> {
  if (monitoringPromise) {
    await monitoringPromise;
    return { success: true };
  }

  monitoringPromise = (async () => {
    try {
      // Initialize database connection
      const supabase = await createServerSupabaseClient();
      const { error } = await supabase.from('health_check').select('count');
      if (error) throw error;

      // Initialize monitoring services
      await Promise.all([
        startPriceMonitoring(),
        startSocialMonitoring(),
      ]);

    } catch (error) {
      logError('Failed to initialize monitoring service:', error);
      throw error;
    }
  })();

  try {
    await monitoringPromise;
    return { success: true };
  } catch (error) {
    return { success: false, error: 'Failed to initialize monitoring' };
  }
}

// Initialize monitoring on server start
startMonitoring().catch(error => {
  logError('Failed to initialize monitoring:', error);
});