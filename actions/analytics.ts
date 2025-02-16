'use server';

import { createServerSupabaseClient } from '@/lib/supabase';
import { experimental_taintObjectReference } from 'react';
import { unstable_cache } from 'next/cache';
import { cache } from 'react';

type MetricType = 'latency' | 'uptime' | 'error' | 'processing';
type ServiceType = 'price' | 'social' | 'calls' | 'system';

interface Metric {
  type: MetricType;
  service: ServiceType;
  value: number;
  metadata?: Record<string, any>;
}

// Track system metrics
export async function trackMetric(metric: Metric) {
  try {
    const supabase = await createServerSupabaseClient();

    const { error } = await supabase.from('system_metrics').insert({
      metric_type: metric.type,
      service: metric.service,
      value: metric.value,
      metadata: metric.metadata,
    });

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Error tracking metric:', error);
    return { error: 'Failed to track metric' };
  }
}

// Types
export interface HealthScore {
  priceHealth: number;
  socialHealth: number;
  priceAlerts?: Array<{
    id: string;
    symbol: string;
    price: number;
    condition: 'above' | 'below';
    target_price: number;
    user_id: string;
    active: boolean;
    created_at: string;
  }>;
  socialAlerts?: Array<{
    id: string;
    platform: string;
    keyword: string;
    user_id: string;
    active: boolean;
    created_at: string;
  }>;
}

// Cache health check results
export const getSystemHealth = cache(async (): Promise<HealthScore> => {
  try {
    const supabase = await createServerSupabaseClient();
    
    // Get active alerts count and data
    const [priceAlerts, socialAlerts] = await Promise.all([
      supabase
        .from('price_alerts')
        .select('*')
        .eq('active', true),
      supabase
        .from('social_alerts')
        .select('*')
        .eq('active', true),
    ]);

    // Calculate health scores based on number of active alerts
    const priceHealth = calculateHealthScore(priceAlerts.data?.length || 0);
    const socialHealth = calculateHealthScore(socialAlerts.data?.length || 0);

    const health: HealthScore = {
      priceHealth,
      socialHealth,
      priceAlerts: priceAlerts.data || [],
      socialAlerts: socialAlerts.data || [],
    };

    // Prevent sensitive metrics from being exposed
    experimental_taintObjectReference(
      'Do not pass internal health metrics to client',
      health
    );

    return health;
  } catch (error) {
    console.error('Error getting system health:', error);
    // Return default health state on error
    return {
      priceHealth: 0,
      socialHealth: 0,
      priceAlerts: [],
      socialAlerts: [],
    };
  }
});

// Calculate health score based on number of active alerts
function calculateHealthScore(alertCount: number): number {
  // Each alert reduces health by 10%
  return Math.max(0, 100 - (alertCount * 10));
}
