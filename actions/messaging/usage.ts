'use server';

import { createServerSupabaseClient } from '@/lib/supabase';
import { SUBSCRIPTION_TIERS, SubscriptionTier } from './config';

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

async function getUserSubscriptionTier(userId: string): Promise<SubscriptionTier> {
  const supabase = await createServerSupabaseClient();
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('tier')
    .eq('user_id', userId)
    .single();

  return (subscription?.tier || 'BASIC') as SubscriptionTier;
}

export async function getUsageLimits(
  userId: string,
  phone: string,
  type: 'call' | 'sms'
): Promise<UsageLimits> {
  const supabase = await createServerSupabaseClient();
  const today = new Date().toISOString().split('T')[0];
  
  // Get user's subscription tier
  const tier = await getUserSubscriptionTier(userId);
  const limits = SUBSCRIPTION_TIERS[tier].limits;
  
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
      remainingToday: type === 'call' ? limits.calls.daily : limits.sms.daily,
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
  const dailyLimit = type === 'call' ? limits.calls.daily : limits.sms.daily;
  const perMinuteLimit = type === 'call' ? limits.calls.perMinute : limits.sms.perMinute;

  const now = new Date();
  const cooldownDuration = 60; // 1 minute cooldown for both types
  const cooldownRemaining = lastUsedAt 
    ? Math.max(0, cooldownDuration - Math.floor((now.getTime() - new Date(lastUsedAt).getTime()) / 1000))
    : 0;

  // Check rate limits
  const timestamps = type === 'call' ? usage.calls_last_minute : usage.sms_last_minute;
  const currentTime = Math.floor(now.getTime() / 1000);
  const recentTimestamps = (timestamps || []).filter((ts: number) => ts > currentTime - 60);
  const isRateLimited = recentTimestamps.length >= perMinuteLimit;
  const rateLimitReset = isRateLimited ? Math.max(...recentTimestamps) + 60 - currentTime : 0;

  const isBlocked = security?.blocked_until && new Date(security.blocked_until) > now;
  const blockRemaining = isBlocked 
    ? Math.ceil((new Date(security.blocked_until).getTime() - now.getTime()) / 1000)
    : undefined;

  return {
    count,
    lastUsedAt: lastUsedAt ? new Date(lastUsedAt) : null,
    remainingToday: Math.max(0, dailyLimit - count),
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

// Update usage tracking
export async function incrementUsage(
  userId: string,
  phone: string,
  type: 'call' | 'sms'
): Promise<void> {
  const supabase = await createServerSupabaseClient();
  const today = new Date().toISOString().split('T')[0];
  const now = new Date();

  try {
    // First, check if record exists
    const { data: existing } = await supabase
      .from('usage_limits')
      .select('id')
      .eq('user_id', userId)
      .eq('phone_number', phone)
      .eq('date', today)
      .single();

    if (!existing) {
      // Create new record if doesn't exist
      await supabase
        .from('usage_limits')
        .insert({
          user_id: userId,
          phone_number: phone,
          date: today,
          [`${type}_count`]: 1,
          [`${type}_last_minute`]: [now.toISOString()],
          [`last_${type}_at`]: now.toISOString(),
          last_cleanup_at: now.toISOString(),
        });
    } else {
      // Update existing record
      await supabase
        .from('usage_limits')
        .update({
          [`${type}_count`]: `${type}_count + 1`,
          [`${type}_last_minute`]: `array_append(${type}_last_minute, '${now.toISOString()}')`,
          [`last_${type}_at`]: now.toISOString(),
        })
        .eq('user_id', userId)
        .eq('phone_number', phone)
        .eq('date', today);
    }
  } catch (error) {
    console.error('Error updating usage:', error);
    throw new Error('Failed to update usage limits');
  }
} 