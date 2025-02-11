'use server';

import crypto from 'crypto';
import { createServerSupabaseClient } from '@/lib/supabase';
import {
  getNextDID,
  updateDIDPerformance,
  handleSuspiciousActivity,
  getSecurityStatus,
} from './security';

// Base URL for BulkVS API
const BASE_URL = 'https://api.bulkvs.com/v1';

// Strict duration and limit settings
export const SETTINGS = {
  CALL: {
    LIMITS: {
      DAILY: 30,
      CONCURRENT: 5,
      PER_MINUTE: 10,
    },
    DURATION: {
      MAX: 6, // Maximum 6 seconds
      MIN: 2, // Minimum duration to ensure message is heard
    },
    COOLDOWN: {
      DURATION: 60, // 60 seconds between calls
      CHECK_INTERVAL: 1000, // Check cooldown every second
    },
    SPEECH: {
      RATE: 1.3,
      VOICE: 'neural' as const,
      WORDS_PER_SECOND: 2.5,
      MAX_WORDS: Math.floor(2.5 * 1.3 * 6), // Based on duration and rate
      OPTIMIZATION: {
        REMOVE_PATTERNS: [
          /please|kindly|would you|could you/gi,
          /notification|alert|message/gi,
          /your|the|a|an/gi,
        ],
      },
    },
    TIMEOUTS: {
      ANSWER: 12,
      MACHINE: 3,
      DTMF: 2,
    },
  },
  SMS: {
    LIMITS: {
      DAILY: 50,
      PER_MINUTE: 20,
    },
    COOLDOWN: {
      DURATION: 30, // 30 seconds between SMS
      CHECK_INTERVAL: 1000,
    },
    MESSAGE: {
      MAX_LENGTH: 160,
      UNICODE_SUPPORT: true,
    },
  },
  ERROR_HANDLING: {
    AUTO_RETRY_CODES: [408, 500, 502, 503, 504],
    MAX_RETRIES: 2,
    BACKOFF: {
      INITIAL_DELAY: 60000, // 1 minute
      MULTIPLIER: 2,
      MAX_DELAY: 300000, // 5 minutes
    },
  },
  CLEANUP: {
    PROBABILITY: 0.1,
    MAX_CACHE_AGE: 24 * 60 * 60 * 1000, // 24 hours
    MIN_ENTRIES_FOR_CLEANUP: 1000, // Start cleaning when cache gets large
  },
  DID_ROTATION: {
    STRATEGY: 'round-robin' as const,
    BACKUP_NUMBER: process.env.BULKVS_FROM_NUMBER!,
    MAX_CONSECUTIVE_USES: 10,
  },
  TIMEZONE: {
    DEFAULT: 'UTC',
    RESET_HOUR: 0, // When daily limits reset
  },
} as const;

// DID pool for shared numbers
const DID_POOL = process.env.BULKVS_DID_POOL?.split(',') || [];
let currentDidIndex = 0;

// Validate required environment variables
const requiredEnvVars = {
  BULKVS_API_KEY: process.env.BULKVS_API_KEY!,
  BULKVS_API_SECRET: process.env.BULKVS_API_SECRET!,
  BULKVS_FROM_NUMBER: process.env.BULKVS_FROM_NUMBER!,
  BULKVS_WEBHOOK_URL: process.env.BULKVS_WEBHOOK_URL!,
} as const;

// Check for missing environment variables
Object.entries(requiredEnvVars).forEach(([key, value]) => {
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
});

// Types
export interface CallOptions {
  phone: string;
  message: string;
  retryCount?: number;
  retryDelay?: number;
  isEmergency?: boolean;
  shouldFallbackToSMS?: boolean;
  bypassCooldown?: boolean;
  bypassDailyLimit?: boolean;
}

export interface SMSOptions {
  phone: string;
  message: string;
  isEmergency?: boolean;
  bypassLimits?: boolean;
}

// Get today's date in YYYY-MM-DD format
function getTodayDate(): string {
  return new Date().toISOString().split('T')[0];
}

// Keep the optimizeMessage function as it's used in makeCall
function optimizeMessage(message: string): string {
  // Remove unnecessary words and shorten the message
  let optimized = message;
  
  // Apply each optimization pattern
  SETTINGS.CALL.SPEECH.OPTIMIZATION.REMOVE_PATTERNS.forEach(pattern => {
    optimized = optimized.replace(pattern, '');
  });
  
  // Remove extra spaces
  optimized = optimized.replace(/\s+/g, ' ').trim();

  // Ensure message can be spoken within duration limit
  return optimized.split(' ')
    .slice(0, SETTINGS.CALL.SPEECH.MAX_WORDS)
    .join(' ');
}

// Keep the bulkvsRequest function as it's used in makeCall and sendSMS
async function bulkvsRequest<T>(endpoint: string, method: string, data?: any): Promise<T> {
  const auth = Buffer.from(
    `${process.env.BULKVS_API_KEY}:${process.env.BULKVS_API_SECRET}`
  ).toString('base64');

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    method,
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/json',
    },
    body: data ? JSON.stringify(data) : undefined,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Unknown error' }));
    throw new Error(error.message || `HTTP error! status: ${response.status}`);
  }

  return response.json();
}

// Keep the getUsageLimits function as it's used in makeCall and sendSMS
async function getUsageLimits(userId: string, phone: string, type: 'call' | 'sms'): Promise<{
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
}> {
  const supabase = await createServerSupabaseClient();
  const today = new Date().toISOString().split('T')[0];
  
  // Get security status first
  const security = await getSecurityStatus(userId, phone);
  
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
      ...security,
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

  return {
    count,
    lastUsedAt: lastUsedAt ? new Date(lastUsedAt) : null,
    remainingToday: Math.max(0, limit - count),
    isInCooldown: cooldownRemaining > 0,
    cooldownRemaining,
    isRateLimited,
    rateLimitReset,
    ...security,
  };
}

// Keep the incrementUsage function as it's used in makeCall and sendSMS
async function incrementUsage(userId: string, phone: string, type: 'call' | 'sms'): Promise<void> {
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

// Update sendSMS function to use new settings
export async function sendSMS({
  userId,
  phone,
  message,
  isEmergency = false,
  bypassLimits = false,
}: SMSOptions & { userId: string }) {
  try {
    if (!bypassLimits && !isEmergency) {
      const usage = await getUsageLimits(userId, phone, 'sms');
      
      if (usage.remainingToday <= 0) {
        return {
          error: `Daily SMS limit (${SETTINGS.SMS.LIMITS.DAILY}) reached for ${phone}. Please try again tomorrow.`,
          remainingSMS: 0,
          nextResetTime: `${getTodayDate()}T${SETTINGS.TIMEZONE.RESET_HOUR.toString().padStart(2, '0')}:00:00Z`,
        };
      }

      if (usage.isInCooldown) {
        return {
          error: `SMS to ${phone} is in cooldown. Please wait ${usage.cooldownRemaining} seconds.`,
          cooldownRemaining: usage.cooldownRemaining,
        };
      }

      if (usage.isRateLimited) {
        return {
          error: `Rate limit exceeded. Please wait ${usage.rateLimitReset} seconds.`,
          rateLimitReset: usage.rateLimitReset,
        };
      }
    }

    // Truncate message if needed
    const truncatedMessage = SETTINGS.SMS.MESSAGE.UNICODE_SUPPORT
      ? message.slice(0, SETTINGS.SMS.MESSAGE.MAX_LENGTH)
      : message.slice(0, SETTINGS.SMS.MESSAGE.MAX_LENGTH).replace(/[^\x00-\x7F]/g, '?');

    const response = await bulkvsRequest<{ id: string }>('/messages', 'POST', {
      to: phone,
      from: getNextDID(),
      text: truncatedMessage,
      custom_params: {
        emergency: isEmergency.toString(),
        user_id: userId,
      },
    });

    // Update usage in database
    if (!bypassLimits) {
      await incrementUsage(userId, phone, 'sms');
    }

    const usage = await getUsageLimits(userId, phone, 'sms');

    return {
      success: true,
      messageId: response.id,
      remainingSMS: usage.remainingToday,
      truncated: truncatedMessage.length < message.length,
    };
  } catch (error) {
    console.error('Error sending SMS:', error);
    return {
      error: error instanceof Error ? error.message : 'Failed to send SMS',
    };
  }
}

// Update makeCall function to use security features
export async function makeCall({
  userId,
  phone,
  message,
  retryCount = SETTINGS.ERROR_HANDLING.MAX_RETRIES,
  retryDelay = SETTINGS.ERROR_HANDLING.BACKOFF.INITIAL_DELAY,
  isEmergency = false,
  shouldFallbackToSMS = true,
  bypassCooldown = false,
  bypassDailyLimit = false,
}: CallOptions & { userId: string }) {
  try {
    if (!bypassDailyLimit && !isEmergency) {
      const usage = await getUsageLimits(userId, phone, 'call');
      
      // Check for blocks first
      if (usage.isBlocked) {
        return {
          error: `This number is temporarily blocked. Reason: ${usage.blockReason}. Try again in ${usage.blockRemaining} seconds.`,
          blockRemaining: usage.blockRemaining,
          blockReason: usage.blockReason,
        };
      }

      // High risk warning
      if (usage.riskScore >= 0.7) {
        console.warn(`High risk activity detected for user ${userId} and phone ${phone}`);
      }

      if (usage.remainingToday <= 0) {
        return {
          error: `Daily call limit (${SETTINGS.CALL.LIMITS.DAILY}) reached for ${phone}. Please try again tomorrow.`,
          remainingCalls: 0,
          nextResetTime: `${getTodayDate()}T${SETTINGS.TIMEZONE.RESET_HOUR.toString().padStart(2, '0')}:00:00Z`,
        };
      }

      if (!bypassCooldown && usage.isInCooldown) {
        return {
          error: `Call to ${phone} is in cooldown. Please wait ${usage.cooldownRemaining} seconds.`,
          cooldownRemaining: usage.cooldownRemaining,
        };
      }

      if (usage.isRateLimited) {
        return {
          error: `Rate limit exceeded. Please wait ${usage.rateLimitReset} seconds.`,
          rateLimitReset: usage.rateLimitReset,
        };
      }
    }

    // Get best performing DID
    const didNumber = await getNextDID();
    
    const optimizedMessage = optimizeMessage(message);
    
    const response = await bulkvsRequest<{ id: string }>('/calls', 'POST', {
      to: phone,
      from: didNumber,
      webhook_url: process.env.BULKVS_WEBHOOK_URL,
      settings: {
        max_duration: SETTINGS.CALL.DURATION.MAX,
        answer_timeout: SETTINGS.CALL.TIMEOUTS.ANSWER,
        machine_detection: {
          enabled: true,
          mode: 'fast',
          timeout: SETTINGS.CALL.TIMEOUTS.MACHINE,
        },
        dtmf_timeout: SETTINGS.CALL.TIMEOUTS.DTMF,
        speech: {
          voice: SETTINGS.CALL.SPEECH.VOICE,
          speed: SETTINGS.CALL.SPEECH.RATE,
          text: optimizedMessage,
        },
        hangup: {
          after_speak: true,
          max_duration: SETTINGS.CALL.DURATION.MAX,
        },
      },
      custom_params: {
        emergency: isEmergency.toString(),
        message: Buffer.from(optimizedMessage).toString('base64'),
        user_id: userId,
        did_number: didNumber,
      },
    });

    // Track DID usage
    await updateDIDPerformance(didNumber, 'initiated', 0, false);

    // Update usage in database
    if (!bypassDailyLimit) {
      await incrementUsage(userId, phone, 'call');
    }

    const usage = await getUsageLimits(userId, phone, 'call');

    return {
      success: true,
      callId: response.id,
      message: optimizedMessage,
      remainingCalls: usage.remainingToday,
    };
  } catch (error) {
    console.error('Error making call:', error);

    // Handle failures
    await handleSuspiciousActivity(userId, phone, 'consecutive_failures');

    // Check if error code is in auto-retry list
    const errorCode = error instanceof Error && 'code' in error ? (error as any).code : null;
    const shouldRetry = errorCode ? SETTINGS.ERROR_HANDLING.AUTO_RETRY_CODES.includes(errorCode) : true;

    if (shouldRetry && retryCount > 0) {
      await new Promise((resolve) => setTimeout(resolve, retryDelay));
      return makeCall({
        userId,
        phone,
        message,
        retryCount: retryCount - 1,
        retryDelay: Math.min(
          retryDelay * SETTINGS.ERROR_HANDLING.BACKOFF.MULTIPLIER,
          SETTINGS.ERROR_HANDLING.BACKOFF.MAX_DELAY
        ),
        isEmergency,
        shouldFallbackToSMS,
        bypassCooldown,
        bypassDailyLimit,
      });
    }

    if (shouldFallbackToSMS) {
      return sendSMS({ userId, phone, message, isEmergency, bypassLimits: bypassDailyLimit });
    }

    return {
      error: error instanceof Error ? error.message : 'Failed to make call',
    };
  }
}

// Generate HMAC signature for webhook validation
export function generateWebhookSignature(payload: string, timestamp: string): string {
  const message = timestamp + payload;
  return crypto
    .createHmac('sha256', process.env.BULKVS_WEBHOOK_SECRET!)
    .update(message)
    .digest('hex');
}

// Add webhook handler
// Remove entire handleCallWebhook function 