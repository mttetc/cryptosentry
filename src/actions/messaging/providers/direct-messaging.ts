'use server';

import {
  notificationPayloadSchema,
  type NotificationPayload,
  type NotificationResponse,
} from '../schemas';
import { checkUserPreferences } from '@/actions/messaging/utils/notification-utils';
import { sendSMS } from '@/actions/messaging/providers/telnyx';
import { sendSMS as sendTelegramMessage } from '@/actions/messaging/providers/telegram';

export async function sendDirectMessage(
  payload: NotificationPayload
): Promise<NotificationResponse> {
  try {
    // Validate payload
    const validatedPayload = notificationPayloadSchema.parse(payload);

    const prefs = await checkUserPreferences(validatedPayload.userId);
    if (!prefs || !prefs.phone) {
      return { success: false, error: 'User preferences or phone number not found' };
    }

    if (!prefs.canSend) {
      return { success: true, error: prefs.reason };
    }

    // Check if the user has Telegram enabled in their preferences
    const hasTelegram = prefs.telegramEnabled;

    // If Telegram is enabled, try to send via Telegram first
    if (hasTelegram) {
      const telegramResponse = await sendTelegramMessage({
        userId: validatedPayload.userId,
        phone: validatedPayload.phone || prefs.phone,
        message: validatedPayload.message,
      });

      // If Telegram message was sent successfully, return the response
      if (telegramResponse.success && telegramResponse.messageId) {
        return {
          success: true,
          smsMessageId: telegramResponse.messageId,
          // Add a flag to indicate this was sent via Telegram
          // This can be used by the UI to show a Telegram icon
          provider: 'telegram',
        };
      }

      // If Telegram failed but it's not a critical error, fall back to SMS
      // For example, if the user doesn't have Telegram linked
      if (
        telegramResponse.error &&
        !telegramResponse.error.includes('does not have a Telegram account linked')
      ) {
        console.warn('Telegram message failed, falling back to SMS:', telegramResponse.error);
      }
    }

    // Fall back to SMS if Telegram is not enabled or failed
    const response = await sendSMS({
      userId: validatedPayload.userId,
      phone: validatedPayload.phone || prefs.phone,
      message: validatedPayload.message,
    });

    if (!response.messageId) {
      throw new Error('Failed to get message ID from SMS provider');
    }

    return {
      success: true,
      smsMessageId: response.messageId,
      provider: 'telnyx',
    };
  } catch (error) {
    console.error('Failed to send direct message:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send message',
    };
  }
}
