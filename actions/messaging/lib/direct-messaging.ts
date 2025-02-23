'use server';

import { telnyxProvider } from '../providers/telnyx';
import { 
  notificationPayloadSchema,
  type NotificationPayload,
  type NotificationResponse
} from '../schemas';
import { checkUserPreferences } from '@/lib/notification-utils';

export async function sendDirectMessage(payload: NotificationPayload): Promise<NotificationResponse> {
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

    // Handle different notification types
    switch (validatedPayload.type) {
      case 'sms':
        return await sendSMS(validatedPayload, prefs.phone);

      case 'call':
        return await makeCall(validatedPayload, prefs.phone);

      case 'both':
        return await sendBoth(validatedPayload, prefs.phone);

      default:
        return {
          success: false,
          error: 'Invalid notification type'
        };
    }
  } catch (error) {
    console.error('Failed to send direct message:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send message'
    };
  }
}

async function sendSMS(payload: NotificationPayload, phone: string): Promise<NotificationResponse> {
  const response = await telnyxProvider.sendSMS({
    userId: payload.userId,
    phone,
    message: payload.message
  });
  return { 
    success: true, 
    messageId: response.messageId,
    smsMessageId: response.messageId 
  };
}

async function makeCall(payload: NotificationPayload, phone: string): Promise<NotificationResponse> {
  const response = await telnyxProvider.makeCall({
    userId: payload.userId,
    phone,
    message: payload.message,
    recipientType: 'human_residence'
  });
  return { 
    success: true, 
    messageId: response.callId,
    callId: response.callId 
  };
}

async function sendBoth(payload: NotificationPayload, phone: string): Promise<NotificationResponse> {
  const [sms, call] = await Promise.all([
    telnyxProvider.sendSMS({
      userId: payload.userId,
      phone,
      message: payload.message
    }),
    telnyxProvider.makeCall({
      userId: payload.userId,
      phone,
      message: payload.message,
      recipientType: 'human_residence'
    })
  ]);

  return {
    success: true,
    messageId: sms.messageId, // Use SMS ID as primary for backward compatibility
    smsMessageId: sms.messageId,
    callId: call.callId
  };
} 