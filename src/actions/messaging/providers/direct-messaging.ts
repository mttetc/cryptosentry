'use server';

import {
  notificationPayloadSchema,
  type NotificationPayload,
  type NotificationResponse,
} from '../schemas';
import { checkUserPreferences } from '@/actions/messaging/utils/notification-utils';
import { sendSMS } from '@/actions/messaging/providers/telnyx';

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

    const response = await sendSMS({
      userId: validatedPayload.userId,
      phone: validatedPayload.phone || prefs.phone,
      message: validatedPayload.message,
    });

    if (!response.messageId) {
      throw new Error('Failed to get message ID from SMS provider');
    }

    return { success: true, smsMessageId: response.messageId };
  } catch (error) {
    console.error('Failed to send direct message:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send message',
    };
  }
}
