'use server';

import { createServerSupabaseClient } from '@/lib/supabase';
import { telnyxProvider } from '@/actions/messaging/providers/telnyx';
import { checkUserPreferences, formatAlertMessage } from '@/lib/notification-utils';
import type { AlertNotification, NotificationResult } from '../schemas';
import { z } from 'zod';

// Alert delivery specific schemas
export const alertDeliveryLogSchema = z.object({
  alert_id: z.string(),
  user_id: z.string(),
  type: z.enum(['price', 'social']),
  channel: z.enum(['sms', 'call']),
  message_id: z.string(),
  data: z.record(z.any())
});

export type AlertDeliveryLog = z.infer<typeof alertDeliveryLogSchema>;

export async function deliverAlert(alert: AlertNotification): Promise<NotificationResult> {
  try {
    const prefs = await checkUserPreferences(alert.userId);
    if (!prefs || !prefs.phone) {
      return { success: false, error: 'User contact preferences or phone number not found' };
    }

    if (!prefs.canSend) {
      return { success: true, error: prefs.reason };
    }

    const message = formatAlertMessage(alert.type, alert.data);

    // Deliver via SMS or Call based on user preference
    if (prefs.prefer_sms) {
      const response = await telnyxProvider.sendSMS({
        userId: alert.userId,
        phone: prefs.phone,
        message
      });

      if (!response.messageId) {
        throw new Error('Failed to get message ID from SMS provider');
      }

      // Log delivery
      await logAlertDelivery({
        alert_id: alert.alertId,
        user_id: alert.userId,
        type: alert.type,
        channel: 'sms',
        message_id: response.messageId,
        data: alert.data
      });

      return { success: true, notificationId: response.messageId };
    } else {
      const response = await telnyxProvider.makeCall({
        userId: alert.userId,
        phone: prefs.phone,
        message,
        recipientType: 'human_residence'
      });

      if (!response.callId) {
        throw new Error('Failed to get call ID from call provider');
      }

      // Log delivery
      await logAlertDelivery({
        alert_id: alert.alertId,
        user_id: alert.userId,
        type: alert.type,
        channel: 'call',
        message_id: response.callId,
        data: alert.data
      });

      return { success: true, notificationId: response.callId };
    }
  } catch (error) {
    console.error('Failed to deliver alert:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to deliver alert'
    };
  }
}

async function logAlertDelivery(data: AlertDeliveryLog): Promise<void> {
  const supabase = await createServerSupabaseClient();
  const validatedData = alertDeliveryLogSchema.parse(data);
  await supabase.from('alert_deliveries').insert(validatedData);
} 