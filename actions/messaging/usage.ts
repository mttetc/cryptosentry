import { createServerSupabaseClient } from '@/lib/supabase';
import { SETTINGS } from './config';

export interface UsageLimits {
  count: number;
  lastUsedAt: Date | null;
  remainingToday: number;
  isInCooldown: boolean;
  cooldownRemaining: number;
  isRateLimited: boolean;
  rateLimitReset: number;
  isBlocked: boolean;
  blockReason?: string;
  blockRemaining?: number;
  riskScore: number;
}

export async function getUsageLimits(
  userId: string,
  phone: string,
  type: 'call' | 'sms'
): Promise<UsageLimits> {
  const supabase = await createServerSupabaseClient();
  const today = new Date().toISOString().split('T')[0];
  
  // Get security status first
  const { data: security } = await supabase
    .from('usage_limits')
    .select('blocked_until, block_reason, risk_score')
    .eq('user_id', userId)
    .eq('phone_number', phone)
    .eq('date', today)
    .single();
  
  // Get or create today's usage record
  const { data: usage, error } = await supabase
    .from('usage_limits')
    .select('*')
    .eq('user_id', userId)
    .eq('phone_number', phone)
    .eq('date', today)
    .single();

  if (error && error.code !== 'PGRST116') { // Not found error
    throw error;
  }

  if (!usage) {
    const { data: newUsage, error: insertError } = await supabase
      .from('usage_limits')
      .insert({
        user_id: userId,
        phone_number: phone,
        date: today,
        calls_last_minute: [],
        sms_last_minute: [],
        last_cleanup_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError) throw insertError;
    
    return {
      count: 0,
      lastUsedAt: null,
      remainingToday: type === 'call' ? SETTINGS.CALL.LIMITS.DAILY : SETTINGS.SMS.LIMITS.DAILY,
      isInCooldown: false,
      cooldownRemaining: 0,
      isRateLimited: false,
      rateLimitReset: 0,
      isBlocked: false,
      riskScore: 0,
    };
  }

  const count = type === 'call' ? usage.call_count : usage.sms_count;
  const lastUsedAt = type === 'call' ? usage.last_call_at : usage.last_sms_at;
  const limit = type === 'call' ? SETTINGS.CALL.LIMITS.DAILY : SETTINGS.SMS.LIMITS.DAILY;
  const cooldownDuration = type === 'call' 
    ? SETTINGS.CALL.COOLDOWN.DURATION 
    : SETTINGS.SMS.COOLDOWN.DURATION;

  const now = new Date();
  const cooldownRemaining = lastUsedAt 
    ? Math.max(0, cooldownDuration - Math.floor((now.getTime() - new Date(lastUsedAt).getTime()) / 1000))
    : 0;

  // Check rate limits
  const timestamps = type === 'call' ? usage.calls_last_minute : usage.sms_last_minute;
  const maxPerMinute = type === 'call' ? SETTINGS.CALL.LIMITS.PER_MINUTE : SETTINGS.SMS.LIMITS.PER_MINUTE;
  const currentTime = Math.floor(now.getTime() / 1000);
  const recentTimestamps = (timestamps || []).filter((ts: number) => ts > currentTime - 60);
  const isRateLimited = recentTimestamps.length >= maxPerMinute;
  const rateLimitReset = isRateLimited ? Math.max(...recentTimestamps) + 60 - currentTime : 0;

  const isBlocked = security?.blocked_until && new Date(security.blocked_until) > now;
  const blockRemaining = isBlocked 
    ? Math.ceil((new Date(security.blocked_until).getTime() - now.getTime()) / 1000)
    : undefined;

  return {
    count,
    lastUsedAt: lastUsedAt ? new Date(lastUsedAt) : null,
    remainingToday: Math.max(0, limit - count),
    isInCooldown: cooldownRemaining > 0,
    cooldownRemaining,
    isRateLimited,
    rateLimitReset,
    isBlocked,
    blockReason: isBlocked ? security?.block_reason : undefined,
    blockRemaining,
    riskScore: security?.risk_score || 0,
  };
}

export async function incrementUsage(
  userId: string,
  phone: string,
  type: 'call' | 'sms'
): Promise<void> {
  const supabase = await createServerSupabaseClient();
  const today = new Date().toISOString().split('T')[0];
  
  // First, try to get the current record
  const { data: existing } = await supabase
    .from('usage_limits')
    .select('*')
    .eq('user_id', userId)
    .eq('phone_number', phone)
    .eq('date', today)
    .single();

  if (existing) {
    // Update existing record with rate limit tracking
    const currentTime = Math.floor(Date.now() / 1000);
    const timestamps = type === 'call' ? existing.calls_last_minute : existing.sms_last_minute;
    const recentTimestamps = [...(timestamps || [])].filter(ts => ts > currentTime - 60);
    recentTimestamps.push(currentTime);

    const updates = type === 'call' 
      ? { 
          call_count: existing.call_count + 1,
          last_call_at: new Date().toISOString(),
          calls_last_minute: recentTimestamps,
        }
      : {
          sms_count: existing.sms_count + 1,
          last_sms_at: new Date().toISOString(),
          sms_last_minute: recentTimestamps,
        };

    const { error: updateError } = await supabase
      .from('usage_limits')
      .update(updates)
      .eq('user_id', userId)
      .eq('phone_number', phone)
      .eq('date', today);

    if (updateError) throw updateError;
  } else {
    // Insert new record with initial rate limit tracking
    const currentTime = Math.floor(Date.now() / 1000);
    const newRecord = {
      user_id: userId,
      phone_number: phone,
      date: today,
      call_count: type === 'call' ? 1 : 0,
      sms_count: type === 'sms' ? 1 : 0,
      last_call_at: type === 'call' ? new Date().toISOString() : null,
      last_sms_at: type === 'sms' ? new Date().toISOString() : null,
      calls_last_minute: type === 'call' ? [currentTime] : [],
      sms_last_minute: type === 'sms' ? [currentTime] : [],
      last_cleanup_at: new Date().toISOString(),
    };

    const { error: insertError } = await supabase
      .from('usage_limits')
      .insert(newRecord);

    if (insertError) throw insertError;
  }
} 