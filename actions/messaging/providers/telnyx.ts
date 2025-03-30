'use server';

import {
  CallOptions,
  SMSOptions,
  CallResponse,
  SMSResponse,
  TelnyxMessageResponse,
  TelnyxWebhookPayload,
} from '../types';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { messageRequestSchema, telnyxCallPayloadSchema } from '../schemas';
import { createPublicKey, verify } from 'crypto';
import { Buffer } from 'buffer';
import { SETTINGS } from '@/config/messaging';
import { TELNYX_CONFIG } from '@/config/constants';

// Telnyx client setup
const TELNYX_API_KEY = process.env.TELNYX_API_KEY!;
const TELNYX_PUBLIC_KEY = process.env.TELNYX_PUBLIC_KEY!;
const TELNYX_API_BASE = TELNYX_CONFIG.API_BASE;

// Optimize message for TTS based on recipient type
function optimizeMessage(
  message: string,
  recipientType?: 'human_residence' | 'human_business' | 'machine'
): string {
  let optimized = message;

  // Format crypto alerts
  optimized = optimized.replace(/(\w+) price (\w+) \$?([\d,.]+)/gi, '$1 is now $3 dollars');

  // Format social alerts
  optimized = optimized.replace(/@(\w+) posted: (.*)/gi, '$1 just posted: $2');

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
        Authorization: `Bearer ${TELNYX_API_KEY}`,
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

export async function makeCall(options: CallOptions): Promise<CallResponse> {
  try {
    const optimizedMessage = optimizeMessage(options.message, options.recipientType);

    const callPayload = {
      to: options.phone,
      from: process.env.TELNYX_VOICE_NUMBER!,
      webhook_url: process.env.TELNYX_WEBHOOK_URL!,
      record_audio: false,
      timeout_secs: SETTINGS.CALL.TIMEOUTS.ANSWER,
      answering_machine_detection: 'premium' as const,
      custom_headers: {
        'X-User-ID': options.userId,
      },
      tts_voice: SETTINGS.CALL.SPEECH.VOICE,
      tts_payload: optimizedMessage,
    };

    const validatedPayload = telnyxCallPayloadSchema.parse(callPayload);
    const response = await telnyxRequest<{ data: { id: string } }>(
      '/calls',
      'POST',
      validatedPayload
    );

    return {
      success: true,
      callId: response.data.id,
    };
  } catch (error) {
    console.error('Failed to make call:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to make call',
    };
  }
}

export async function sendSMS(options: SMSOptions): Promise<SMSResponse> {
  try {
    const messagePayload = {
      from: process.env.TELNYX_SENDER_ID!,
      to: options.phone,
      text: options.message,
      messaging_profile_id: process.env.TELNYX_MESSAGING_PROFILE_ID!,
      custom_headers: {
        'X-User-ID': options.userId,
      },
    };

    const validatedPayload = messageRequestSchema.parse(messagePayload);
    const response = await telnyxRequest<{ data: { id: string } }>(
      '/messages',
      'POST',
      validatedPayload
    );

    return {
      success: true,
      messageId: response.data.id,
    };
  } catch (error) {
    console.error('Failed to send SMS:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send SMS',
    };
  }
}

export async function verifyWebhookSignature(
  payload: string,
  signature: string,
  timestamp: string
): Promise<boolean> {
  try {
    const publicKey = createPublicKey({
      key: Buffer.from(TELNYX_PUBLIC_KEY, 'base64'),
      format: 'pem',
      type: 'spki',
    });

    const isValid = verify(
      'sha256',
      Buffer.from(payload),
      {
        key: publicKey,
        padding: 1,
      },
      Buffer.from(signature, 'base64')
    );

    // Verify timestamp is within 5 minutes
    const webhookTimestamp = parseInt(timestamp, 10);
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const isRecent = Math.abs(currentTimestamp - webhookTimestamp) < 300;

    return isValid && isRecent;
  } catch (error) {
    console.error('Failed to verify webhook signature:', error);
    return false;
  }
}
