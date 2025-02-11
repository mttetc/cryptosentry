'use server';

import crypto from 'crypto';
import {
  getNextDID,
  updateDIDPerformance,
  handleSuspiciousActivity,
} from '../security';
import { 
  MessagingProvider, 
  CallOptions, 
  SMSOptions, 
  CallResponse, 
  SMSResponse 
} from '../types';
import { SETTINGS } from '../config';
import { getUsageLimits, incrementUsage } from '../usage';

const BASE_URL = 'https://api.bulkvs.com/v1';

function validateEnvVars() {
  const requiredEnvVars = {
    BULKVS_API_KEY: process.env.BULKVS_API_KEY!,
    BULKVS_API_SECRET: process.env.BULKVS_API_SECRET!,
    BULKVS_FROM_NUMBER: process.env.BULKVS_FROM_NUMBER!,
    BULKVS_WEBHOOK_URL: process.env.BULKVS_WEBHOOK_URL!,
  };

  Object.entries(requiredEnvVars).forEach(([key, value]) => {
    if (!value) {
      throw new Error(`Missing required environment variable: ${key}`);
    }
  });
}

function getAuthHeader() {
  validateEnvVars();
  return Buffer.from(
    `${process.env.BULKVS_API_KEY}:${process.env.BULKVS_API_SECRET}`
  ).toString('base64');
}

async function request<T>(endpoint: string, method: string, data?: any): Promise<T> {
  const response = await fetch(`${BASE_URL}${endpoint}`, {
    method,
    headers: {
      'Authorization': `Basic ${getAuthHeader()}`,
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

function optimizeMessage(message: string): string {
  let optimized = message;
  
  SETTINGS.CALL.SPEECH.OPTIMIZATION.REMOVE_PATTERNS.forEach(pattern => {
    optimized = optimized.replace(pattern, '');
  });
  
  optimized = optimized.replace(/\s+/g, ' ').trim();

  return optimized.split(' ')
    .slice(0, SETTINGS.CALL.SPEECH.MAX_WORDS)
    .join(' ');
}

export async function makeCall(options: CallOptions): Promise<CallResponse> {
  try {
    if (!options.bypassDailyLimit && !options.isEmergency) {
      const usage = await getUsageLimits(options.userId, options.phone, 'call');
      
      if (usage.isBlocked) {
        return {
          error: `This number is temporarily blocked. Reason: ${usage.blockReason}. Try again in ${usage.blockRemaining} seconds.`,
          blockRemaining: usage.blockRemaining,
          blockReason: usage.blockReason,
        };
      }

      if (usage.riskScore >= 0.7) {
        console.warn(`High risk activity detected for user ${options.userId} and phone ${options.phone}`);
      }

      if (usage.remainingToday <= 0) {
        return {
          error: `Daily call limit reached. Please try again tomorrow.`,
          remainingCalls: 0,
        };
      }

      if (!options.bypassCooldown && usage.isInCooldown) {
        return {
          error: `Call is in cooldown. Please wait ${usage.cooldownRemaining} seconds.`,
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

    const didNumber = await getNextDID();
    const optimizedMessage = optimizeMessage(options.message);
    
    const response = await request<{ id: string }>('/calls', 'POST', {
      to: options.phone,
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
        emergency: options.isEmergency?.toString(),
        message: Buffer.from(optimizedMessage).toString('base64'),
        user_id: options.userId,
        did_number: didNumber,
      },
    });

    await updateDIDPerformance(didNumber, 'initiated', 0, false);

    if (!options.bypassDailyLimit) {
      await incrementUsage(options.userId, options.phone, 'call');
    }

    const usage = await getUsageLimits(options.userId, options.phone, 'call');

    return {
      success: true,
      callId: response.id,
      message: optimizedMessage,
      remainingCalls: usage.remainingToday,
    };
  } catch (error) {
    await handleSuspiciousActivity(options.userId, options.phone, 'consecutive_failures');

    const errorCode = error instanceof Error && 'code' in error ? (error as any).code : null;
    const shouldRetry = errorCode ? SETTINGS.ERROR_HANDLING.AUTO_RETRY_CODES.includes(errorCode) : true;

    if (shouldRetry && options.retryCount && options.retryCount > 0) {
      await new Promise((resolve) => setTimeout(resolve, options.retryDelay));
      return makeCall({
        ...options,
        retryCount: options.retryCount - 1,
        retryDelay: Math.min(
          (options.retryDelay || SETTINGS.ERROR_HANDLING.BACKOFF.INITIAL_DELAY) * SETTINGS.ERROR_HANDLING.BACKOFF.MULTIPLIER,
          SETTINGS.ERROR_HANDLING.BACKOFF.MAX_DELAY
        ),
      });
    }

    if (options.shouldFallbackToSMS) {
      return sendSMS({
        userId: options.userId,
        phone: options.phone,
        message: options.message,
        isEmergency: options.isEmergency,
        bypassLimits: options.bypassDailyLimit,
      });
    }

    return {
      error: error instanceof Error ? error.message : 'Failed to make call',
    };
  }
}

export async function sendSMS(options: SMSOptions): Promise<SMSResponse> {
  try {
    if (!options.bypassLimits && !options.isEmergency) {
      const usage = await getUsageLimits(options.userId, options.phone, 'sms');
      
      if (usage.remainingToday <= 0) {
        return {
          error: `Daily SMS limit reached. Please try again tomorrow.`,
          remainingSMS: 0,
        };
      }

      if (usage.isInCooldown) {
        return {
          error: `SMS is in cooldown. Please wait ${usage.cooldownRemaining} seconds.`,
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

    const truncatedMessage = SETTINGS.SMS.MESSAGE.UNICODE_SUPPORT
      ? options.message.slice(0, SETTINGS.SMS.MESSAGE.MAX_LENGTH)
      : options.message.slice(0, SETTINGS.SMS.MESSAGE.MAX_LENGTH).replace(/[^\x00-\x7F]/g, '?');

    const response = await request<{ id: string }>('/messages', 'POST', {
      to: options.phone,
      from: await getNextDID(),
      text: truncatedMessage,
      custom_params: {
        emergency: options.isEmergency?.toString(),
        user_id: options.userId,
      },
    });

    if (!options.bypassLimits) {
      await incrementUsage(options.userId, options.phone, 'sms');
    }

    const usage = await getUsageLimits(options.userId, options.phone, 'sms');

    return {
      success: true,
      messageId: response.id,
      remainingSMS: usage.remainingToday,
      truncated: truncatedMessage.length < options.message.length,
    };
  } catch (error) {
    console.error('Error sending SMS:', error);
    return {
      error: error instanceof Error ? error.message : 'Failed to send SMS',
    };
  }
}

export function validateWebhook(signature: string, payload: string, timestamp: string): boolean {
  const message = timestamp + payload;
  const expectedSignature = crypto
    .createHmac('sha256', process.env.BULKVS_WEBHOOK_SECRET!)
    .update(message)
    .digest('hex');
  
  return signature === expectedSignature;
}

export async function handleCallWebhook(data: any): Promise<void> {
  const {
    call_id: callId,
    status,
    duration,
    to: phone,
    from: didNumber,
    user_id: userId,
  } = data;

  await updateDIDPerformance(
    didNumber,
    status,
    parseInt(duration || '0'),
    false
  );

  if (status === 'failed' && userId && phone) {
    await handleSuspiciousActivity(userId, phone, 'consecutive_failures', 0.4);
  }
} 