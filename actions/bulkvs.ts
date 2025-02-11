'use server';

import crypto from 'crypto';

// Base URL for BulkVS API
const BASE_URL = 'https://api.bulkvs.com/v1';

// Strict duration and limit settings
export const SETTINGS = {
  CALL: {
    MAX_DURATION: 6, // Maximum 6 seconds
    COOLDOWN: 60, // 60 seconds cooldown between calls
    SPEECH_RATE: 1.3, // Slightly faster speech
    ANSWER_TIMEOUT: 12, // Reduced timeout
    MACHINE_TIMEOUT: 3, // Fast voicemail detection
    DAILY_LIMIT: 30, // Maximum calls per day
  },
  SMS: {
    COOLDOWN: 30, // 30 seconds between SMS
    DAILY_LIMIT: 50, // Maximum SMS per day
  }
} as const;

// Usage tracking
const callCooldowns = new Map<string, number>();
const smsCooldowns = new Map<string, number>();
const dailyCallCounts = new Map<string, { count: number; date: string }>();
const dailySMSCounts = new Map<string, { count: number; date: string }>();

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

// Get next DID from pool (round-robin)
function getNextDID(): string {
  if (DID_POOL.length === 0) {
    return process.env.BULKVS_FROM_NUMBER!;
  }
  const did = DID_POOL[currentDidIndex];
  currentDidIndex = (currentDidIndex + 1) % DID_POOL.length;
  return did;
}

interface CallOptions {
  phone: string;
  message: string;
  retryCount?: number;
  retryDelay?: number;
  isEmergency?: boolean;
  shouldFallbackToSMS?: boolean;
  bypassCooldown?: boolean;
  bypassDailyLimit?: boolean;
}

// Get today's date in YYYY-MM-DD format
function getTodayDate(): string {
  return new Date().toISOString().split('T')[0];
}

interface MessageLimits {
  count: number;
  date: string;
}

// Check if user has reached daily limit
function hasReachedDailyLimit(
  phone: string,
  type: 'call' | 'sms'
): boolean {
  const today = getTodayDate();
  const counts = type === 'call' ? dailyCallCounts : dailySMSCounts;
  const limit = type === 'call' ? SETTINGS.CALL.DAILY_LIMIT : SETTINGS.SMS.DAILY_LIMIT;
  const usage = counts.get(phone);

  // Reset count if it's a new day
  if (!usage || usage.date !== today) {
    counts.set(phone, { count: 0, date: today });
    return false;
  }

  return usage.count >= limit;
}

// Update daily count
function incrementDailyCount(
  phone: string,
  type: 'call' | 'sms'
): void {
  const today = getTodayDate();
  const counts = type === 'call' ? dailyCallCounts : dailySMSCounts;
  const usage = counts.get(phone);

  if (!usage || usage.date !== today) {
    counts.set(phone, { count: 1, date: today });
  } else {
    counts.set(phone, {
      count: usage.count + 1,
      date: today,
    });
  }

  // Cleanup old entries (10% chance)
  if (Math.random() < 0.1) {
    for (const [number, data] of counts.entries()) {
      if (data.date !== today) {
        counts.delete(number);
      }
    }
  }
}

// Check cooldown
function isInCooldown(
  phone: string,
  type: 'call' | 'sms'
): boolean {
  const cooldowns = type === 'call' ? callCooldowns : smsCooldowns;
  const cooldownTime = type === 'call' ? SETTINGS.CALL.COOLDOWN : SETTINGS.SMS.COOLDOWN;
  const lastTime = cooldowns.get(phone);
  
  if (!lastTime) return false;

  const timeSince = Date.now() - lastTime;
  return timeSince < cooldownTime * 1000;
}

// Update cooldown
function updateCooldown(
  phone: string,
  type: 'call' | 'sms'
): void {
  const cooldowns = type === 'call' ? callCooldowns : smsCooldowns;
  const cooldownTime = type === 'call' ? SETTINGS.CALL.COOLDOWN : SETTINGS.SMS.COOLDOWN;
  
  cooldowns.set(phone, Date.now());

  // Cleanup old entries (10% chance)
  if (Math.random() < 0.1) {
    const now = Date.now();
    for (const [number, timestamp] of cooldowns.entries()) {
      if (now - timestamp > cooldownTime * 1000) {
        cooldowns.delete(number);
      }
    }
  }
}

// Get remaining messages
function getRemaining(
  phone: string,
  type: 'call' | 'sms'
): number {
  const today = getTodayDate();
  const counts = type === 'call' ? dailyCallCounts : dailySMSCounts;
  const limit = type === 'call' ? SETTINGS.CALL.DAILY_LIMIT : SETTINGS.SMS.DAILY_LIMIT;
  const usage = counts.get(phone);

  if (!usage || usage.date !== today) {
    return limit;
  }

  return Math.max(0, limit - usage.count);
}

// Optimize message for short duration
function optimizeMessage(message: string): string {
  // Remove unnecessary words and shorten the message
  const optimized = message
    .replace(/please|kindly|would you|could you/gi, '')
    .replace(/notification|alert|message/gi, '')
    .replace(/your|the|a|an/gi, '')
    .replace(/\s+/g, ' ') // Remove extra spaces
    .trim();

  // Ensure message can be spoken within duration limit
  // Assuming average speech rate of 150 words per minute
  const wordsPerSecond = 2.5 * SETTINGS.CALL.SPEECH_RATE;
  const maxWords = Math.floor(wordsPerSecond * SETTINGS.CALL.MAX_DURATION);
  
  return optimized.split(' ').slice(0, maxWords).join(' ');
}

// Helper function for API calls
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

interface SMSOptions {
  phone: string;
  message: string;
  isEmergency?: boolean;
  bypassLimits?: boolean;
}

export async function sendSMS({
  phone,
  message,
  isEmergency = false,
  bypassLimits = false,
}: SMSOptions) {
  try {
    // Check daily limit
    if (!bypassLimits && !isEmergency && hasReachedDailyLimit(phone, 'sms')) {
      return {
        error: `Daily SMS limit (${SETTINGS.SMS.DAILY_LIMIT}) reached for ${phone}. Please try again tomorrow.`,
        remainingSMS: 0,
        nextResetTime: `${getTodayDate()}T23:59:59Z`,
      };
    }

    // Check cooldown
    if (!bypassLimits && !isEmergency && isInCooldown(phone, 'sms')) {
      return {
        error: `SMS to ${phone} is in cooldown. Please wait ${SETTINGS.SMS.COOLDOWN} seconds.`,
        cooldownRemaining: Math.ceil(
          (smsCooldowns.get(phone)! + SETTINGS.SMS.COOLDOWN * 1000 - Date.now()) / 1000
        ),
      };
    }

    const response = await bulkvsRequest<{ id: string }>('/messages', 'POST', {
      to: phone,
      from: getNextDID(),
      text: message,
      custom_params: {
        emergency: isEmergency.toString(),
      },
    });

    // Update tracking unless bypassed
    if (!bypassLimits) {
      updateCooldown(phone, 'sms');
      incrementDailyCount(phone, 'sms');
    }

    return {
      success: true,
      messageId: response.id,
      remainingSMS: getRemaining(phone, 'sms'),
    };
  } catch (error) {
    console.error('Error sending SMS:', error);
    return {
      error: error instanceof Error ? error.message : 'Failed to send SMS',
    };
  }
}

// Update makeCall to use new helper functions
export async function makeCall({
  phone,
  message,
  retryCount = 1,
  retryDelay = 60000,
  isEmergency = false,
  shouldFallbackToSMS = true,
  bypassCooldown = false,
  bypassDailyLimit = false,
}: CallOptions) {
  try {
    // Check daily limit
    if (!bypassDailyLimit && !isEmergency && hasReachedDailyLimit(phone, 'call')) {
      return {
        error: `Daily call limit (${SETTINGS.CALL.DAILY_LIMIT}) reached for ${phone}. Please try again tomorrow.`,
        remainingCalls: 0,
        nextResetTime: `${getTodayDate()}T23:59:59Z`,
      };
    }

    // Check cooldown
    if (!bypassCooldown && !isEmergency && isInCooldown(phone, 'call')) {
      return {
        error: `Call to ${phone} is in cooldown. Please wait ${SETTINGS.CALL.COOLDOWN} seconds.`,
        cooldownRemaining: Math.ceil(
          (callCooldowns.get(phone)! + SETTINGS.CALL.COOLDOWN * 1000 - Date.now()) / 1000
        ),
      };
    }

    const optimizedMessage = optimizeMessage(message);
    
    const response = await bulkvsRequest<{ id: string }>('/calls', 'POST', {
      to: phone,
      from: getNextDID(),
      webhook_url: process.env.BULKVS_WEBHOOK_URL,
      settings: {
        max_duration: SETTINGS.CALL.MAX_DURATION,
        answer_timeout: SETTINGS.CALL.ANSWER_TIMEOUT,
        machine_detection: {
          enabled: true,
          mode: 'fast',
          timeout: SETTINGS.CALL.MACHINE_TIMEOUT,
        },
        dtmf_timeout: 2,
        speech: {
          voice: 'neural',
          speed: SETTINGS.CALL.SPEECH_RATE,
          text: optimizedMessage,
        },
        hangup: {
          after_speak: true,
          max_duration: SETTINGS.CALL.MAX_DURATION,
        },
      },
      custom_params: {
        emergency: isEmergency.toString(),
        message: Buffer.from(optimizedMessage).toString('base64'),
      },
    });

    // Update tracking unless bypassed
    if (!bypassCooldown) {
      updateCooldown(phone, 'call');
    }
    if (!bypassDailyLimit) {
      incrementDailyCount(phone, 'call');
    }

    return {
      success: true,
      callId: response.id,
      message: optimizedMessage,
      remainingCalls: getRemaining(phone, 'call'),
    };
  } catch (error) {
    console.error('Error making call:', error);

    if (retryCount > 0) {
      await new Promise((resolve) => setTimeout(resolve, retryDelay));
      return makeCall({
        phone,
        message,
        retryCount: retryCount - 1,
        retryDelay: retryDelay * 2,
        isEmergency,
        shouldFallbackToSMS,
        bypassCooldown,
        bypassDailyLimit,
      });
    }

    if (shouldFallbackToSMS) {
      return sendSMS({ phone, message, isEmergency, bypassLimits: bypassDailyLimit });
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