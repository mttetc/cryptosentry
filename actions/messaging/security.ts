'use server';

import { createServerSupabaseClient } from '@/lib/supabase';
import { SETTINGS } from './config';

// Cache DID performance metrics
const didPerformanceCache = new Map<string, {
  successCount: number;
  failureCount: number;
  lastUsed: number;
  machineDetectionRate: number;
  averageDuration: number;
}>();

// Get the next available DID based on performance metrics
export async function getNextDID(): Promise<string> {
  const supabase = await createServerSupabaseClient();
  
  try {
    // Get all available DIDs
    const { data: dids, error } = await supabase
      .from('did_numbers')
      .select('*')
      .eq('active', true)
      .order('last_used_at', { ascending: true });

    if (error) throw error;
    if (!dids?.length) return SETTINGS.DID_ROTATION.BACKUP_NUMBER;

    // Filter out DIDs that have been used too many times consecutively
    const availableDids = dids.filter(did => {
      const performance = didPerformanceCache.get(did.number);
      if (!performance) return true;
      
      const consecutiveUses = performance.successCount - performance.failureCount;
      return consecutiveUses < SETTINGS.DID_ROTATION.MAX_CONSECUTIVE_USES;
    });

    if (!availableDids.length) return SETTINGS.DID_ROTATION.BACKUP_NUMBER;

    // Score DIDs based on performance metrics
    const scoredDids = availableDids.map(did => {
      const performance = didPerformanceCache.get(did.number) || {
        successCount: 0,
        failureCount: 0,
        lastUsed: 0,
        machineDetectionRate: 0,
        averageDuration: 0,
      };

      // Calculate score based on multiple factors
      const successRate = performance.successCount / (performance.successCount + performance.failureCount || 1);
      const timeSinceLastUse = Date.now() - performance.lastUsed;
      const machineDetectionPenalty = performance.machineDetectionRate * 0.5;

      const score = successRate * 0.4 + // 40% weight on success rate
        (timeSinceLastUse / 3600000) * 0.3 + // 30% weight on time since last use
        (1 - machineDetectionPenalty) * 0.3; // 30% weight on machine detection rate

      return { did, score };
    });

    // Sort by score and get the best DID
    scoredDids.sort((a, b) => b.score - a.score);
    const selectedDid = scoredDids[0].did;

    // Update last used timestamp
    await supabase
      .from('did_numbers')
      .update({ last_used_at: new Date().toISOString() })
      .eq('number', selectedDid.number);

    return selectedDid.number;
  } catch (error) {
    console.error('Error getting next DID:', error);
    return SETTINGS.DID_ROTATION.BACKUP_NUMBER;
  }
}

// Update DID performance metrics
export async function updateDIDPerformance(
  didNumber: string,
  status: string,
  duration: number,
  isMachine: boolean
): Promise<void> {
  try {
    const performance = didPerformanceCache.get(didNumber) || {
      successCount: 0,
      failureCount: 0,
      lastUsed: Date.now(),
      machineDetectionRate: 0,
      averageDuration: 0,
    };

    // Update metrics based on call status
    if (status === 'call.completed') {
      performance.successCount++;
      performance.averageDuration = (performance.averageDuration * (performance.successCount - 1) + duration) / performance.successCount;
    } else if (status === 'call.failed' || status === 'call.no-answer') {
      performance.failureCount++;
    }

    // Update machine detection rate
    if (isMachine !== undefined) {
      const totalCalls = performance.successCount + performance.failureCount;
      performance.machineDetectionRate = (performance.machineDetectionRate * (totalCalls - 1) + (isMachine ? 1 : 0)) / totalCalls;
    }

    performance.lastUsed = Date.now();
    didPerformanceCache.set(didNumber, performance);

    // Persist to database periodically
    const supabase = await createServerSupabaseClient();
    await supabase
      .from('did_numbers')
      .update({
        success_count: performance.successCount,
        failure_count: performance.failureCount,
        machine_detection_rate: performance.machineDetectionRate,
        average_duration: performance.averageDuration,
        last_used_at: new Date().toISOString(),
      })
      .eq('number', didNumber);
  } catch (error) {
    console.error('Error updating DID performance:', error);
  }
}

// Handle suspicious activity
export async function handleSuspiciousActivity(
  userId: string,
  phone: string,
  failureType: 'consecutive_failures' | 'machine_detections' | 'short_calls',
  severity: number = 0.2
): Promise<void> {
  const supabase = await createServerSupabaseClient();
  
  await supabase.rpc('handle_suspicious_activity', {
    p_user_id: userId,
    p_phone: phone,
    p_failure_type: failureType,
    p_severity: severity,
  });
} 