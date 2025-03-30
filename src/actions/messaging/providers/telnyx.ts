'use server';

import { SETTINGS } from '@/lib/config/messaging';
import { Buffer } from 'buffer';
import { createPublicKey, verify } from 'crypto';
import { messageRequestSchema, telnyxCallPayloadSchema } from '../schemas';
import { CallOptions, CallResponse, SMSOptions, SMSResponse } from '../types';
import { TELNYX_CONFIG } from './telnyx-config';
import { optimizeMessage } from './telnyx-utils';

// Telnyx client setup
const TELNYX_API_KEY = process.env.TELNYX_API_KEY!;
const TELNYX_PUBLIC_KEY = process.env.TELNYX_PUBLIC_KEY!;
const TELNYX_API_BASE = TELNYX_CONFIG.API_BASE;

// Reusable fetch wrapper with error handling
async function telnyxRequest<T>(endpoint: string, method: string, requestData?: any): Promise<T> {
  const maxRetries = 3;
  const baseDelay = 1000; // 1 second

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
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
        const error = await response
          .json()
          .catch(() => ({ errors: [{ detail: 'Unknown error' }] }));
        const errorDetail = error.errors?.[0]?.detail || `HTTP error! status: ${response.status}`;

        // Don't retry on 4xx errors except 429 (rate limit)
        if (response.status >= 400 && response.status < 500 && response.status !== 429) {
          throw new Error(errorDetail);
        }

        // If we've exhausted retries, throw the error
        if (attempt === maxRetries) {
          throw new Error(errorDetail);
        }

        // Wait with exponential backoff before retrying
        await new Promise((resolve) => setTimeout(resolve, baseDelay * Math.pow(2, attempt)));
        continue;
      }

      const responseData: T = await response.json();
      return responseData;
    } catch (error) {
      // If we've exhausted retries, throw the error
      if (attempt === maxRetries) {
        if (error instanceof Error) {
          error.message = `Telnyx API Error (${method} ${endpoint}): ${error.message}`;
        }
        throw error;
      }

      // Wait with exponential backoff before retrying
      await new Promise((resolve) => setTimeout(resolve, baseDelay * Math.pow(2, attempt)));
    }
  }

  throw new Error(`Failed after ${maxRetries} retries`);
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
