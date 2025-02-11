'use server';

import { createServerSupabaseClient } from '@/lib/supabase';
import { SETTINGS } from './bulkvs';

// Smart DID rotation
export async function getNextDID(excludeNumbers: string[] = []): Promise<string> {
  const supabase = await createServerSupabaseClient();
  
  // Get next best DID from the database
  const { data: did } = await supabase
    .rpc('get_next_did', { p_exclude_numbers: excludeNumbers });

  if (did) {
    return did;
  }

  // Fallback to default number if no DIDs available
  return SETTINGS.DID_ROTATION.BACKUP_NUMBER;
}

// Update DID performance
export async function updateDIDPerformance(
  didNumber: string,
  status: string,
  duration: number,
  machineDetected: boolean
): Promise<void> {
  const supabase = await createServerSupabaseClient();
  
  await supabase.rpc('update_did_performance', {
    p_did_number: didNumber,
    p_call_status: status,
    p_duration: duration,
    p_machine_detected: machineDetected,
  });
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

// Check security status
export async function getSecurityStatus(userId: string, phone: string): Promise<{
  isBlocked: boolean;
  blockReason?: string;
  blockRemaining?: number;
  riskScore: number;
}> {
  const supabase = await createServerSupabaseClient();
  const today = new Date().toISOString().split('T')[0];
  
  const { data: usage } = await supabase
    .from('usage_limits')
    .select('blocked_until, block_reason, risk_score')
    .eq('user_id', userId)
    .eq('phone_number', phone)
    .eq('date', today)
    .single();

  if (!usage) {
    return {
      isBlocked: false,
      riskScore: 0,
    };
  }

  const now = new Date();
  const isBlocked = usage.blocked_until && new Date(usage.blocked_until) > now;
  const blockRemaining = isBlocked 
    ? Math.ceil((new Date(usage.blocked_until).getTime() - now.getTime()) / 1000)
    : 0;

  return {
    isBlocked,
    blockReason: isBlocked ? usage.block_reason : undefined,
    blockRemaining: isBlocked ? blockRemaining : undefined,
    riskScore: usage.risk_score || 0,
  };
}

// Handle call webhook
export async function handleCallWebhook(
  callId: string,
  status: string,
  duration: number,
  didNumber: string,
  machineDetected: boolean,
  userId: string,
  phone: string
): Promise<void> {
  // Update DID performance
  await updateDIDPerformance(didNumber, status, duration, machineDetected);

  // Handle suspicious patterns
  if (machineDetected) {
    await handleSuspiciousActivity(userId, phone, 'machine_detections', 0.3);
  }
  
  if (status === 'completed' && duration < 3) {
    await handleSuspiciousActivity(userId, phone, 'short_calls', 0.2);
  }
  
  if (status === 'failed') {
    await handleSuspiciousActivity(userId, phone, 'consecutive_failures', 0.4);
  }
} 