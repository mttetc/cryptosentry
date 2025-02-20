'use server';

import { MessagingProvider, CallOptions, SMSOptions, CallResponse, SMSResponse } from '../types';
import { getUsageLimits, incrementUsage } from '../usage';
import { getNextDID, updateDIDPerformance } from '../security';
import { SETTINGS } from '../config';

// Telnyx client setup
const TELNYX_API_KEY = process.env.TELNYX_API_KEY!;
const TELNYX_API_BASE = 'https://api.telnyx.com/v2';

// Cache DID performance metrics
const didPerformanceCache = new Map<string, {
  successCount: number;
  failureCount: number;
  lastUsed: number;
}>();

// Optimize message for TTS
function optimizeMessage(message: string): string {
  let optimized = message;
  
  // Remove unnecessary words
  SETTINGS.CALL.SPEECH.OPTIMIZATION.REMOVE_PATTERNS.forEach(pattern => {
    optimized = optimized.replace(pattern, '');
  });

  // Ensure proper SSML formatting
  optimized = `<speak><prosody rate="${SETTINGS.CALL.SPEECH.RATE}">${optimized}</prosody></speak>`;

  return optimized;
}

// Reusable fetch wrapper with error handling
async function telnyxRequest<T>(
  endpoint: string,
  method: string,
  data?: any,
  retryCount = 2
): Promise<T> {
  try {
    const response = await fetch(`${TELNYX_API_BASE}${endpoint}`, {
      method,
      headers: {
        'Authorization': `Bearer ${TELNYX_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: data ? JSON.stringify(data) : undefined,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ errors: [{ detail: 'Unknown error' }] }));
      throw new Error(error.errors?.[0]?.detail || `HTTP error! status: ${response.status}`);
    }

    return response.json();
  } catch (error) {
    if (retryCount > 0 && SETTINGS.ERROR_HANDLING.AUTO_RETRY_CODES.includes((error as any).status)) {
      await new Promise(resolve => setTimeout(resolve, SETTINGS.ERROR_HANDLING.BACKOFF.INITIAL_DELAY));
      return telnyxRequest(endpoint, method, data, retryCount - 1);
    }
    throw error;
  }
}

export const telnyxProvider: MessagingProvider = {
  async makeCall(options: CallOptions): Promise<CallResponse> {
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

        if (usage.remainingToday <= 0) {
          return {
            error: `Daily call limit reached. Please try again tomorrow.`,
            remainingCalls: 0,
          };
        }
      }

      const didNumber = await getNextDID();
      const optimizedMessage = optimizeMessage(options.message);

      // Get cached DID performance
      const didPerformance = didPerformanceCache.get(didNumber) || {
        successCount: 0,
        failureCount: 0,
        lastUsed: Date.now(),
      };

      // Make the call
      const response = await telnyxRequest<{ data: { id: string } }>('/calls', 'POST', {
        to: options.phone,
        from: didNumber,
        answer_url: process.env.TELNYX_ANSWER_URL,
        webhook_url: process.env.TELNYX_WEBHOOK_URL,
        record_audio: false, // Optimize by disabling recording
        timeout_secs: SETTINGS.CALL.TIMEOUTS.ANSWER,
        answering_machine_detection: {
          enabled: true,
          timeout: SETTINGS.CALL.TIMEOUTS.MACHINE,
        },
        custom_headers: {
          'X-Message': Buffer.from(optimizedMessage).toString('base64'),
          'X-User-Id': options.userId,
        },
      });

      // Update DID performance cache
      didPerformance.successCount++;
      didPerformance.lastUsed = Date.now();
      didPerformanceCache.set(didNumber, didPerformance);

      if (!options.bypassDailyLimit) {
        await incrementUsage(options.userId, options.phone, 'call');
      }

      const usage = await getUsageLimits(options.userId, options.phone, 'call');

      return {
        success: true,
        callId: response.data.id,
        remainingCalls: usage.remainingToday,
      };
    } catch (error) {
      console.error('Error making call:', error);

      // Update DID performance on failure
      const didNumber = await getNextDID();
      const didPerformance = didPerformanceCache.get(didNumber);
      if (didPerformance) {
        didPerformance.failureCount++;
        didPerformanceCache.set(didNumber, didPerformance);
      }

      return {
        error: error instanceof Error ? error.message : 'Failed to make call',
      };
    }
  },

  async sendSMS(options: SMSOptions): Promise<SMSResponse> {
    try {
      if (!options.bypassLimits && !options.isEmergency) {
        const usage = await getUsageLimits(options.userId, options.phone, 'sms');
        
        if (usage.remainingToday <= 0) {
          return {
            error: `Daily SMS limit reached. Please try again tomorrow.`,
            remainingSMS: 0,
          };
        }
      }

      const didNumber = await getNextDID();
      
      // Optimize message length
      const message = options.message.slice(0, SETTINGS.SMS.MESSAGE.MAX_LENGTH);

      const response = await telnyxRequest<{ data: { id: string } }>('/messages', 'POST', {
        to: options.phone,
        from: didNumber,
        text: message,
        use_profile_webhooks: true,
        webhook_url: process.env.TELNYX_WEBHOOK_URL,
        webhook_failover_url: process.env.TELNYX_WEBHOOK_FAILOVER_URL,
      });

      if (!options.bypassLimits) {
        await incrementUsage(options.userId, options.phone, 'sms');
      }

      const usage = await getUsageLimits(options.userId, options.phone, 'sms');

      return {
        success: true,
        messageId: response.data.id,
        remainingSMS: usage.remainingToday,
      };
    } catch (error) {
      console.error('Error sending SMS:', error);
      return {
        error: error instanceof Error ? error.message : 'Failed to send SMS',
      };
    }
  },

  validateWebhook(signature: string, payload: string, timestamp: string): boolean {
    try {
      // Implement Telnyx webhook validation
      // This is a placeholder - implement actual validation logic
      return true;
    } catch (error) {
      console.error('Error validating webhook:', error);
      return false;
    }
  },

  async handleCallWebhook(data: any): Promise<void> {
    try {
      const {
        call_control_id: callId,
        call_leg_id: legId,
        event_type: status,
        payload,
      } = data;

      const didNumber = payload.from;
      const duration = payload.duration || 0;

      await updateDIDPerformance(
        didNumber,
        status,
        duration,
        payload.answering_machine_detection?.result === 'machine'
      );

      // Update cache
      const didPerformance = didPerformanceCache.get(didNumber);
      if (didPerformance && status === 'call.completed') {
        didPerformance.successCount++;
        didPerformanceCache.set(didNumber, didPerformance);
      }
    } catch (error) {
      console.error('Error handling call webhook:', error);
    }
  },
}; 