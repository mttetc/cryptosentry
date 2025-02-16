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
  price: number;
  social: number;
  calls: number;
  system: number;
}

export interface HealthResponse {
  success: boolean;
  health?: HealthScore;
  error?: string;
}

// Cache health check results
export const getSystemHealth = cache(async (): Promise<HealthResponse> => {
  try {
    const [priceHealth, socialHealth, callsHealth, systemHealth] = await Promise.all([
      checkPriceServiceHealth(),
      checkSocialServiceHealth(),
      checkCallServiceHealth(),
      checkSystemHealth(),
    ]);

    const health = {
      price: priceHealth,
      social: socialHealth,
      calls: callsHealth,
      system: systemHealth,
    };

    // Prevent sensitive metrics from being exposed
    experimental_taintObjectReference(
      'Do not pass internal health metrics to client',
      health
    );

    return { success: true, health };
  } catch (error) {
    console.error('Error getting system health:', error);
    return { success: false, error: 'Failed to get system health' };
  }
});

// Health check functions
async function checkPriceServiceHealth(): Promise<number> {
  const supabase = await createServerSupabaseClient();
  
  try {
    const startTime = Date.now();
    const { data, error } = await supabase
      .from('price_alerts')
      .select('count', { count: 'exact' })
      .limit(1);

    if (error) throw error;

    const responseTime = Date.now() - startTime;
    
    if (responseTime < 100) return 100;
    if (responseTime < 500) return 90;
    if (responseTime < 1000) return 80;
    if (responseTime < 2000) return 60;
    return 40;
  } catch (error) {
    console.error('Price service health check failed:', error);
    return 0;
  }
}

async function checkSocialServiceHealth(): Promise<number> {
  const supabase = await createServerSupabaseClient();
  
  try {
    const startTime = Date.now();
    const { data, error } = await supabase
      .from('social_alerts')
      .select('count', { count: 'exact' })
      .limit(1);

    if (error) throw error;

    const responseTime = Date.now() - startTime;
    
    if (responseTime < 100) return 100;
    if (responseTime < 500) return 90;
    if (responseTime < 1000) return 80;
    if (responseTime < 2000) return 60;
    return 40;
  } catch (error) {
    console.error('Social service health check failed:', error);
    return 0;
  }
}

async function checkCallServiceHealth(): Promise<number> {
  const supabase = await createServerSupabaseClient();
  
  try {
    const startTime = Date.now();
    const { data, error } = await supabase
      .from('alert_history')
      .select('count', { count: 'exact' })
      .eq('alert_type', 'call')
      .limit(1);

    if (error) throw error;

    const responseTime = Date.now() - startTime;
    
    if (responseTime < 100) return 100;
    if (responseTime < 500) return 90;
    if (responseTime < 1000) return 80;
    if (responseTime < 2000) return 60;
    return 40;
  } catch (error) {
    console.error('Call service health check failed:', error);
    return 0;
  }
}

async function checkSystemHealth(): Promise<number> {
  const supabase = await createServerSupabaseClient();
  
  try {
    const startTime = Date.now();
    
    // Check multiple system components
    const results = await Promise.all([
      supabase.from('users').select('count', { count: 'exact' }).limit(1),
      supabase.from('error_logs').select('count', { count: 'exact' }).limit(1),
      supabase.from('processed_posts').select('count', { count: 'exact' }).limit(1)
    ]);

    if (results.some(result => result.error)) {
      throw new Error('One or more system checks failed');
    }

    const responseTime = Date.now() - startTime;
    
    if (responseTime < 300) return 100;
    if (responseTime < 1000) return 90;
    if (responseTime < 2000) return 80;
    if (responseTime < 3000) return 60;
    return 40;
  } catch (error) {
    console.error('System health check failed:', error);
    return 0;
  }
}

// Subscribe to health updates
export async function* subscribeToHealth(signal: AbortSignal) {
  while (!signal.aborted) {
    const result = await getSystemHealth();
    if (result.success && result.health) {
      yield result.health;
    }
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
}
