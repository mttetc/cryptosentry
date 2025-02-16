'use server';

import { createServerSupabaseClient } from '@/lib/supabase';
import { monitorPrice, monitorSocial } from '@/actions/alerts';
import { startPriceMonitoring, stopPriceMonitoring } from '@/actions/exchanges';
import { startSocialMonitoring, stopSocialMonitoring } from '@/actions/social';
import { logError } from '@/lib/logger';
import { config } from '@/config/monitoring';
import 'server-only';

let monitoringPromise: Promise<void> | null = null;

/**
 * Start the monitoring service. This is idempotent and can be called multiple times safely.
 * If monitoring is already active, it will return the existing promise.
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

      // Start monitoring services
      await Promise.all([
        startPriceMonitoring(),
        startSocialMonitoring(),
      ]);

    } catch (error) {
      logError('Failed to start monitoring service:', error);
      throw error;
    }
  })();

  try {
    await monitoringPromise;
    return { success: true };
  } catch (error) {
    return { success: false, error: 'Failed to start monitoring' };
  }
}

/**
 * Stop the monitoring service and clean up resources
 */
export async function stopMonitoring(): Promise<{ success: boolean; error?: string }> {
  try {
    // Stop monitoring services
    await Promise.all([
      stopPriceMonitoring(),
      stopSocialMonitoring(),
    ]);

    monitoringPromise = null;
    return { success: true };
  } catch (error) {
    logError('Failed to stop monitoring:', error);
    return { success: false, error: 'Failed to stop monitoring' };
  }
}

// Start monitoring on server start
startMonitoring().catch(error => {
  logError('Failed to start monitoring:', error);
}); 