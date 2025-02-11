'use server';

import { createServerSupabaseClient } from '@/lib/supabase';
import { SETTINGS } from './config';

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