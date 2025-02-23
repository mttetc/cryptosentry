'use server';

import { MessagingProvider, CallOptions, SMSOptions, CallResponse, SMSResponse, TelnyxMessageResponse, TelnyxWebhookPayload } from '../types';
import { SETTINGS } from '../config';
import { createServerSupabaseClient } from '@/lib/supabase';
import { messageRequestSchema } from '../schemas';
import { createPublicKey, verify } from 'crypto';
import { Buffer } from 'buffer';

// Telnyx client setup
const TELNYX_API_KEY = process.env.TELNYX_API_KEY!;
const TELNYX_PUBLIC_KEY = process.env.TELNYX_PUBLIC_KEY!;
const TELNYX_API_BASE = process.env.TELNYX_API_BASE || 'https://api.telnyx.com/v2';

// Optimize message for TTS based on recipient type
function optimizeMessage(message: string, recipientType?: 'human_residence' | 'human_business' | 'machine'): string {
  let optimized = message;
  
  // Format crypto alerts
  optimized = optimized.replace(
    /(\w+) price (\w+) \$?([\d,.]+)/gi,
    '$1 is now $3 dollars'
  );

  // Format social alerts
  optimized = optimized.replace(
    /@(\w+) posted: (.*)/gi,
    '$1 just posted: $2'
  );

  // Add pauses between different alerts
  optimized = optimized.replace(/\. /g, '. <break time="0.8s"/> ');

  // Ensure proper SSML formatting
  optimized = `<speak><prosody rate="${SETTINGS.CALL.SPEECH.RATE}">${optimized}</prosody></speak>`;

  return optimized;
}

// Reusable fetch wrapper with error handling
async function telnyxRequest<T>(
  endpoint: string,
  method: string,
  requestData?: any,
  retryCount = 2
): Promise<T> {
  try {
    const response: Response = await fetch(`${TELNYX_API_BASE}${endpoint}`, {
      method,
      headers: {
        'Authorization': `Bearer ${TELNYX_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: requestData ? JSON.stringify(requestData) : undefined,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ errors: [{ detail: 'Unknown error' }] }));
      const errorDetail = error.errors?.[0]?.detail || `HTTP error! status: ${response.status}`;
      throw new Error(errorDetail);
    }

    const responseData: T = await response.json();
    return responseData;
  } catch (error) {
    if (error instanceof Error) {
      error.message = `Telnyx API Error (${method} ${endpoint}): ${error.message}`;
    }
    throw error;
  }
}

export const telnyxProvider: MessagingProvider = {
  async makeCall(options: CallOptions): Promise<CallResponse> {
    try {
      const optimizedMessage = optimizeMessage(options.message, options.recipientType);

      // Make the call using Telnyx's default AMD settings
      const response = await telnyxRequest<{ data: { id: string } }>('/calls', 'POST', {
        to: options.phone,
        from: process.env.TELNYX_VOICE_NUMBER,
        webhook_url: process.env.TELNYX_WEBHOOK_URL,
        record_audio: false,
        timeout_secs: SETTINGS.CALL.TIMEOUTS.ANSWER,
        answering_machine_detection: 'premium', // Use Telnyx's premium AMD
        custom_headers: {
          'X-User-Id': options.userId,
        },
        tts_voice: SETTINGS.CALL.SPEECH.VOICE,
        tts_language: options.phone.startsWith('+33') ? 'fr-FR' : 
                     options.phone.startsWith('+86') ? 'cmn-CN' : 
                     'en-US',
        tts_payload: optimizedMessage
      });

      return {
        success: true,
        callId: response.data.id
      };
    } catch (error) {
      console.error('Error making call:', error);
      return {
        error: error instanceof Error ? error.message : 'Failed to make call',
      };
    }
  },

  async sendSMS(options: SMSOptions): Promise<SMSResponse> {
    try {
      const messageRequest = {
        to: options.phone,
        from: process.env.TELNYX_SENDER_ID!,
        messaging_profile_id: process.env.TELNYX_MESSAGING_PROFILE_ID!,
        text: options.message.slice(0, SETTINGS.SMS.MESSAGE.MAX_LENGTH),
        type: 'SMS' as const,
      };

      const validationResult = messageRequestSchema.safeParse(messageRequest);

      if (!validationResult.success) {
        console.error('Validation error:', validationResult.error);
        return {
          error: 'Invalid message request: ' + validationResult.error.errors.map(e => e.message).join(', '),
        };
      }

      const response = await telnyxRequest<TelnyxMessageResponse>('/messages', 'POST', validationResult.data);

      return { 
        success: true, 
        messageId: response.id
      };
    } catch (error) {
      console.error('Error sending SMS:', error);
      return {
        error: error instanceof Error ? error.message : 'Failed to send SMS',
      };
    }
  },

  async handleCallWebhook(payload: TelnyxWebhookPayload): Promise<void> {
    try {
      const supabase = await createServerSupabaseClient();
      const userId = payload.payload.custom_headers?.['X-User-Id'];

      if (!userId) {
        console.warn('Missing userId in webhook payload');
        return;
      }

      // Store analytics
      await supabase.from('call_analytics').insert({
        user_id: userId,
        call_id: payload.call_control_id,
        event_type: payload.event_type,
        duration: payload.payload.duration,
        direction: payload.payload.direction,
        from: payload.payload.from,
        to: payload.payload.to,
        status: payload.payload.state,
        result: payload.payload.result,
        amd_result: payload.payload.amd_result,
        cost: payload.payload.cost,
        recorded: payload.payload.recorded,
        created_at: new Date().toISOString(),
      });

    } catch (error) {
      console.error('Error handling call webhook:', error);
    }
  },

  async handleSMSWebhook(payload: TelnyxWebhookPayload): Promise<void> {
    try {
      const supabase = await createServerSupabaseClient();
      const userId = payload.payload.custom_headers?.['X-User-Id'];

      if (!userId) {
        console.warn('Missing userId in webhook payload');
        return;
      }

      // Store analytics
      await supabase.from('sms_analytics').insert({
        user_id: userId,
        message_id: payload.call_control_id,
        event_type: payload.event_type,
        direction: payload.payload.direction,
        from: payload.payload.from,
        to: payload.payload.to,
        status: payload.payload.state,
        cost: payload.payload.cost,
        created_at: new Date().toISOString(),
      });

    } catch (error) {
      console.error('Error handling SMS webhook:', error);
    }
  },

  validateWebhook(signature: string, payload: string, timestamp: string): boolean {
    try {
      const publicKey = createPublicKey({
        key: TELNYX_PUBLIC_KEY,
        format: 'pem',
        type: 'spki',
      });

      return verify(
        'sha256',
        Buffer.from(payload),
        publicKey,
        Buffer.from(signature, 'base64')
      );
    } catch (error) {
      console.error('Error verifying webhook signature:', error);
      return false;
    }
  }
}; 