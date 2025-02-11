'use server';

import twilio from 'twilio';
import { CallOptions, SMSOptions, CallResponse, SMSResponse } from '../types';
import { SETTINGS } from '../config';
import { getUsageLimits, incrementUsage } from '../usage';
import { getNextDID, updateDIDPerformance, handleSuspiciousActivity } from '../security';

const getTwilioClient = () => {
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
    throw new Error('Missing Twilio credentials');
  }
  return twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
};

export async function makeCall(options: CallOptions): Promise<CallResponse> {
  try {
    // Usage limits check
    if (!options.bypassDailyLimit && !options.isEmergency) {
      const usage = await getUsageLimits(options.userId, options.phone, 'call');
      
      if (usage.isBlocked) {
        return {
          error: `This number is temporarily blocked. Reason: ${usage.blockReason}. Try again in ${usage.blockRemaining} seconds.`,
          blockRemaining: usage.blockRemaining,
          blockReason: usage.blockReason,
        };
      }

      if (usage.remainingToday <= 0) {
        return {
          error: `Daily call limit reached. Please try again tomorrow.`,
          remainingCalls: 0,
        };
      }
    }

    const didNumber = await getNextDID();
    const client = getTwilioClient();
    
    const call = await client.calls.create({
      to: options.phone,
      from: didNumber,
      twiml: `<Response><Say voice="neural" rate="1.3">${options.message}</Say></Response>`,
      statusCallback: process.env.TWILIO_STATUS_CALLBACK_URL,
      statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
      machineDetection: 'DetectMessageEnd',
    });

    if (!options.bypassDailyLimit) {
      await incrementUsage(options.userId, options.phone, 'call');
    }

    const usage = await getUsageLimits(options.userId, options.phone, 'call');

    return {
      success: true,
      callId: call.sid,
      remainingCalls: usage.remainingToday,
    };
  } catch (error) {
    console.error('Error making call:', error);
    return {
      error: error instanceof Error ? error.message : 'Failed to make call',
    };
  }
}

export async function sendSMS(options: SMSOptions): Promise<SMSResponse> {
  try {
    if (!options.bypassLimits && !options.isEmergency) {
      const usage = await getUsageLimits(options.userId, options.phone, 'sms');
      
      if (usage.remainingToday <= 0) {
        return {
          error: `Daily SMS limit reached. Please try again tomorrow.`,
          remainingSMS: 0,
        };
      }
    }

    const client = getTwilioClient();
    const message = await client.messages.create({
      to: options.phone,
      from: await getNextDID(),
      body: options.message.slice(0, SETTINGS.SMS.MESSAGE.MAX_LENGTH),
    });

    if (!options.bypassLimits) {
      await incrementUsage(options.userId, options.phone, 'sms');
    }

    const usage = await getUsageLimits(options.userId, options.phone, 'sms');

    return {
      success: true,
      messageId: message.sid,
      remainingSMS: usage.remainingToday,
    };
  } catch (error) {
    console.error('Error sending SMS:', error);
    return {
      error: error instanceof Error ? error.message : 'Failed to send SMS',
    };
  }
}

export function validateWebhook(signature: string, payload: string, timestamp: string): boolean {
  const url = process.env.TWILIO_STATUS_CALLBACK_URL;
  if (!url || !process.env.TWILIO_AUTH_TOKEN) return false;
  
  return twilio.validateRequest(
    process.env.TWILIO_AUTH_TOKEN,
    signature,
    url,
    JSON.parse(payload)
  );
}

export async function handleCallWebhook(data: any): Promise<void> {
  const {
    CallSid: callId,
    CallStatus: status,
    CallDuration: duration,
    To: phone,
    From: didNumber,
  } = data;

  await updateDIDPerformance(
    didNumber,
    status,
    parseInt(duration || '0'),
    false
  );

  if (status === 'failed') {
    const userId = data.userId; // You'll need to pass this in your webhook
    if (userId && phone) {
      await handleSuspiciousActivity(userId, phone, 'consecutive_failures', 0.4);
    }
  }
}