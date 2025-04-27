'use server';

import { CallOptions, CallResponse, SMSOptions, SMSResponse } from '../../types';
import { telegramCallPayloadSchema, telegramMessageSchema } from '../../schemas';
import { createServerSupabaseClient } from '@/lib/supabase/server';

// Telegram client setup
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const TELEGRAM_API_BASE = 'https://api.telegram.org/bot';

// Reusable fetch wrapper with error handling
async function telegramRequest<T>(endpoint: string, method: string, requestData?: any): Promise<T> {
  const maxRetries = 3;
  const baseDelay = 1000; // 1 second

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response: Response = await fetch(
        `${TELEGRAM_API_BASE}${TELEGRAM_BOT_TOKEN}/${endpoint}`,
        {
          method,
          headers: {
            'Content-Type': 'application/json',
          },
          body: requestData ? JSON.stringify(requestData) : undefined,
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ description: 'Unknown error' }));
        const errorDetail = error.description || `HTTP error! status: ${response.status}`;

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
          error.message = `Telegram API Error (${method} ${endpoint}): ${error.message}`;
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
    // For Telegram, we'll use the Telegram Voice Chat API
    // This requires the user to have a Telegram account and be in a voice chat
    // We'll need to create a voice chat if it doesn't exist

    // First, check if the user has a Telegram chat ID associated with their account
    // This would be stored in the database and retrieved here
    const telegramChatId = await getTelegramChatId(options.userId);

    if (!telegramChatId) {
      return {
        success: false,
        error: 'User does not have a Telegram account linked',
      };
    }

    // Create a voice chat if it doesn't exist
    const voiceChatId = await createOrGetVoiceChat(telegramChatId);

    // Send a message to the user with a link to join the voice chat
    const voiceChatLink = `https://t.me/${process.env.TELEGRAM_BOT_USERNAME}?start=voice_${voiceChatId}`;

    const messagePayload = {
      chat_id: telegramChatId,
      text: `You have an incoming call. Click here to join: ${voiceChatLink}`,
      parse_mode: 'HTML',
    };

    const validatedPayload = telegramMessageSchema.parse(messagePayload);
    const response = await telegramRequest<{ ok: boolean; result: { message_id: string } }>(
      'sendMessage',
      'POST',
      validatedPayload
    );

    if (!response.ok) {
      throw new Error('Failed to send Telegram message');
    }

    // Start the voice chat
    const callPayload = {
      chat_id: voiceChatId,
      title: 'Incoming Call',
      description: options.message,
    };

    const validatedCallPayload = telegramCallPayloadSchema.parse(callPayload);
    const callResponse = await telegramRequest<{ ok: boolean; result: { id: string } }>(
      'createVideoChat',
      'POST',
      validatedCallPayload
    );

    if (!callResponse.ok) {
      throw new Error('Failed to create voice chat');
    }

    return {
      success: true,
      callId: callResponse.result.id,
    };
  } catch (error) {
    console.error('Failed to make Telegram call:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to make call',
    };
  }
}

export async function sendSMS(options: SMSOptions): Promise<SMSResponse> {
  try {
    // For Telegram, we'll send a message to the user's Telegram chat
    // First, check if the user has a Telegram chat ID associated with their account
    const telegramChatId = await getTelegramChatId(options.userId);

    if (!telegramChatId) {
      return {
        success: false,
        error: 'User does not have a Telegram account linked',
      };
    }

    const messagePayload = {
      chat_id: telegramChatId,
      text: options.message,
      parse_mode: 'HTML',
    };

    const validatedPayload = telegramMessageSchema.parse(messagePayload);
    const response = await telegramRequest<{ ok: boolean; result: { message_id: string } }>(
      'sendMessage',
      'POST',
      validatedPayload
    );

    if (!response.ok) {
      throw new Error('Failed to send Telegram message');
    }

    return {
      success: true,
      messageId: response.result.message_id.toString(),
    };
  } catch (error) {
    console.error('Failed to send Telegram message:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send message',
    };
  }
}

// Helper functions
async function getTelegramChatId(userId: string): Promise<string | null> {
  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from('user_notification_settings')
      .select('telegram_chat_id')
      .eq('user_id', userId)
      .single();

    if (error) {
      console.error('Failed to get Telegram chat ID:', error);
      return null;
    }

    return data?.telegram_chat_id || null;
  } catch (error) {
    console.error('Error getting Telegram chat ID:', error);
    return null;
  }
}

async function createOrGetVoiceChat(_chatId: string): Promise<string> {
  // This would be implemented to create a voice chat or get an existing one
  // For now, we'll return a dummy ID
  return 'voice_chat_123';
}

export async function verifyWebhookSignature(
  payload: string,
  signature: string,
  timestamp: string
): Promise<boolean> {
  try {
    // Telegram webhook verification is different from Telnyx
    // Telegram uses a secret token that you set when configuring the webhook
    const secretToken = process.env.TELEGRAM_WEBHOOK_SECRET!;

    // Verify the signature
    const isValid = signature === secretToken;

    // Verify timestamp is within 5 minutes
    const webhookTimestamp = parseInt(timestamp, 10);
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const isRecent = Math.abs(currentTimestamp - webhookTimestamp) < 300;

    return isValid && isRecent;
  } catch (error) {
    console.error('Failed to verify Telegram webhook signature:', error);
    return false;
  }
}
