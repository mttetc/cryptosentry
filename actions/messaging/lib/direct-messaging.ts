'use server';

import { sendDirectMessage as messagingService } from '@/lib/services/messaging';
import {
  notificationPayloadSchema,
  type NotificationPayload,
  type NotificationResponse,
} from '../schemas';
import { checkUserPreferences } from '@/lib/notification-utils';

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

    return await messagingService(validatedPayload, prefs.phone);
  } catch (error) {
    console.error('Failed to send direct message:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send message',
    };
  }
}
