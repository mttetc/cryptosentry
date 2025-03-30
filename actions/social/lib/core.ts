'use server';

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { logError } from '@/lib/logger';
import type { SocialState, SocialMonitoringConfig } from '../types';

// Start social monitoring
export async function startSocialMonitoring(): Promise<SocialState> {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: alerts } = await supabase.from('social_alerts').select('*').eq('active', true);

    if (!alerts?.length) {
      return { success: true };
    }

    // Process alerts
    for (const alert of alerts) {
      await monitorSocial(alert.platform, alert.keyword);
    }

    return { success: true };
  } catch (error) {
    logError('Error in social monitoring:', error);
    return { success: false, error: 'Failed to monitor social feeds' };
  }
}

// Stop social monitoring (no-op since we're using SSE)
export async function stopSocialMonitoring(): Promise<SocialState> {
  return { success: true };
}

// Monitor social media for keywords
export async function monitorSocial(platform: string, keyword: string): Promise<SocialState> {
  try {
    const supabase = await createServerSupabaseClient();

    // Store the monitoring request
    await supabase.from('social_monitoring').upsert({
      platform,
      keyword,
      last_checked: new Date().toISOString(),
    });

    return { success: true };
  } catch (error) {
    logError('Error monitoring social media:', error);
    return { success: false, error: 'Failed to monitor social media' };
  }
}
