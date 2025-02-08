'use server';

import { createServerSupabaseClient } from '@/lib/supabase';

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

// Get system health status
export async function getSystemHealth() {
  try {
    const supabase = await createServerSupabaseClient();
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

    // Get recent metrics
    const { data: metrics } = await supabase
      .from('system_metrics')
      .select('*')
      .gte('created_at', fiveMinutesAgo.toISOString())
      .order('created_at', { ascending: false });

    if (!metrics) return { error: 'No metrics found' };

    // Calculate health scores
    const health: Record<ServiceType, number> = {
      price: calculateServiceHealth(metrics.filter((m) => m.service === 'price')),
      social: calculateServiceHealth(metrics.filter((m) => m.service === 'social')),
      calls: calculateServiceHealth(metrics.filter((m) => m.service === 'calls')),
      system: calculateServiceHealth(metrics.filter((m) => m.service === 'system')),
    };

    return { success: true, health };
  } catch (error) {
    console.error('Error getting system health:', error);
    return { error: 'Failed to get system health' };
  }
}

// Calculate service health score (0-100)
function calculateServiceHealth(metrics: any[]) {
  if (!metrics.length) return 0;

  const weights: Record<MetricType, number> = {
    latency: 0.3,
    uptime: 0.4,
    error: 0.2,
    processing: 0.1,
  };

  const scores: Record<MetricType, number> = {
    latency: calculateLatencyScore(metrics.filter((m) => m.metric_type === 'latency')),
    uptime: calculateUptimeScore(metrics.filter((m) => m.metric_type === 'uptime')),
    error: calculateErrorScore(metrics.filter((m) => m.metric_type === 'error')),
    processing: calculateProcessingScore(metrics.filter((m) => m.metric_type === 'processing')),
  };

  return Object.entries(weights).reduce((score, [key, weight]) => {
    return score + scores[key as MetricType] * weight;
  }, 0);
}

function calculateLatencyScore(metrics: any[]) {
  if (!metrics.length) return 100;
  const avgLatency = metrics.reduce((sum, m) => sum + m.value, 0) / metrics.length;
  // Score decreases as latency increases (target: <100ms)
  return Math.max(0, 100 - avgLatency / 2);
}

function calculateUptimeScore(metrics: any[]) {
  if (!metrics.length) return 0;
  const uptime = metrics.filter((m) => m.value === 1).length / metrics.length;
  return uptime * 100;
}

function calculateErrorScore(metrics: any[]) {
  if (!metrics.length) return 100;
  const errorRate = metrics.filter((m) => m.value === 1).length / metrics.length;
  return (1 - errorRate) * 100;
}

function calculateProcessingScore(metrics: any[]) {
  if (!metrics.length) return 100;
  const avgProcessing = metrics.reduce((sum, m) => sum + m.value, 0) / metrics.length;
  // Score decreases as processing time increases (target: <50ms)
  return Math.max(0, 100 - avgProcessing);
}
