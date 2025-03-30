import {
  makeCall as telnyxMakeCall,
  sendSMS as telnyxSendSMS,
} from '@/actions/messaging/providers/telnyx';
import {
  notificationPayloadSchema,
  type NotificationPayload,
  type NotificationResponse,
} from '@/actions/messaging/schemas';
import { checkUserPreferences } from '@/lib/notification-utils';

export async function sendSMS(
  payload: NotificationPayload,
  phone: string
): Promise<NotificationResponse> {
  const response = await telnyxSendSMS({
    userId: payload.userId,
    phone,
    message: payload.message,
  });
  return {
    success: true,
    messageId: response.messageId,
    smsMessageId: response.messageId,
  };
}

export async function makeCall(
  payload: NotificationPayload,
  phone: string
): Promise<NotificationResponse> {
  const response = await telnyxMakeCall({
    userId: payload.userId,
    phone,
    message: payload.message,
    recipientType: 'human_residence',
  });
  return {
    success: true,
    messageId: response.callId,
    callId: response.callId,
  };
}

export async function sendBoth(
  payload: NotificationPayload,
  phone: string
): Promise<NotificationResponse> {
  const [sms, call] = await Promise.all([
    telnyxSendSMS({
      userId: payload.userId,
      phone,
      message: payload.message,
    }),
    telnyxMakeCall({
      userId: payload.userId,
      phone,
      message: payload.message,
      recipientType: 'human_residence',
    }),
  ]);

  return {
    success: true,
    messageId: sms.messageId,
    smsMessageId: sms.messageId,
    callId: call.callId,
  };
}

export async function sendDirectMessage(
  payload: NotificationPayload,
  phone: string
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

    // Handle different notification types
    switch (validatedPayload.type) {
      case 'sms':
        return await sendSMS(validatedPayload, phone);

      case 'call':
        return await makeCall(validatedPayload, phone);

      case 'both':
        return await sendBoth(validatedPayload, phone);

      default:
        return {
          success: false,
          error: 'Invalid notification type',
        };
    }
  } catch (error) {
    console.error('Failed to send direct message:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send message',
    };
  }
}
