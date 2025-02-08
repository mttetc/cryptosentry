'use server';

import twilio from 'twilio';
import { z } from 'zod';
import { createServerSupabaseClient } from '@/lib/supabase';

// Validate required environment variables
const requiredEnvVars = {
  TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID!,
  TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN!,
  TWILIO_PHONE_NUMBER: process.env.TWILIO_PHONE_NUMBER!,
  TWILIO_STATUS_CALLBACK_URL: process.env.TWILIO_STATUS_CALLBACK_URL!,
} as const;

// Check for missing environment variables
Object.entries(requiredEnvVars).forEach(([key, value]) => {
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
});

const client = twilio(requiredEnvVars.TWILIO_ACCOUNT_SID, requiredEnvVars.TWILIO_AUTH_TOKEN);

// Enhanced validation schema with E.164 format
const phoneSchema = z.string().regex(/^\+[1-9]\d{1,14}$/, {
  message: 'Phone number must be in E.164 format (e.g., +33612345678)',
});

const callSchema = z.object({
  phone: phoneSchema,
  message: z.string().min(1),
  soundUrl: z.string().url().optional(),
  isEmergency: z.boolean().optional().default(false),
  retryCount: z.number().optional().default(3),
  retryDelay: z.number().optional().default(30000), // 30 seconds
  shouldFallbackToSMS: z.boolean().optional().default(true),
});

const smsSchema = z.object({
  phone: phoneSchema,
  message: z.string().min(1),
});

export type CallResult = {
  success?: boolean;
  callSid?: string;
  smsSid?: string;
  error?: string;
  fallbackToSMS?: boolean;
};

// Error codes that indicate we should retry
const RETRYABLE_ERROR_CODES = [
  'ECONNRESET',
  'ETIMEDOUT',
  'ECONNREFUSED',
  'ESOCKETTIMEDOUT',
  '429', // Rate limit
  '500', // Server error
  '503', // Service unavailable
];

// Calculate exponential backoff delay
function getBackoffDelay(attempt: number, baseDelay: number): number {
  return Math.min(baseDelay * Math.pow(2, attempt), 300000); // Max 5 minutes
}

async function getCustomSound(soundId: string) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: sound, error } = await supabase
      .from('custom_sounds')
      .select('*')
      .eq('id', soundId)
      .single();

    if (error) throw error;
    return sound;
  } catch (error) {
    console.error('Error fetching custom sound:', error);
    return null;
  }
}

export async function makeCall(data: z.infer<typeof callSchema>): Promise<CallResult> {
  const { phone, message, soundUrl, retryCount, retryDelay, shouldFallbackToSMS } =
    callSchema.parse(data);
  let lastError: any;
  let isEmergencyCall = data.isEmergency || false;

  // Try calling first
  for (let attempt = 0; attempt < retryCount; attempt++) {
    try {
      if (attempt > 0) {
        const delay = getBackoffDelay(attempt, retryDelay);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }

      // Build TwiML with optional custom sound
      let twiml = '<Response>';

      // If soundUrl is a UUID, fetch custom sound from database
      if (
        soundUrl &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(soundUrl)
      ) {
        const customSound = await getCustomSound(soundUrl);
        if (customSound) {
          // Play custom sound with specified options
          twiml += `<Play loop="${customSound.is_loopable ? '2' : '1'}">${customSound.public_url}</Play>`;
          if (customSound.is_emergency) {
            isEmergencyCall = true; // Set emergency flag if sound is marked as emergency
          }
        }
      } else if (soundUrl) {
        // Use provided sound URL directly
        twiml += `<Play loop="2">${soundUrl}</Play>`;
      }

      // Add message with appropriate voice and language
      twiml += `
        <Say voice="alice" language="en-US">${message}</Say>
        <Pause length="1"/>
        <Say voice="alice" language="en-US">Press any key to acknowledge this alert.</Say>
        <Gather numDigits="1" timeout="10"/>
      `;

      if (isEmergencyCall) {
        // For emergency alerts, repeat the message
        twiml += `
          <Say voice="alice" language="en-US">Emergency Alert. ${message}</Say>
          <Gather numDigits="1" timeout="10"/>
        `;
      }

      twiml += '</Response>';

      const call = await client.calls.create({
        twiml,
        to: phone,
        from: requiredEnvVars.TWILIO_PHONE_NUMBER,
        statusCallback: requiredEnvVars.TWILIO_STATUS_CALLBACK_URL,
        statusCallbackEvent: ['completed', 'failed'],
        machineDetection: 'DetectMessageEnd',
      });

      return { success: true, callSid: call.sid };
    } catch (error: any) {
      lastError = error;
      console.error(`Call attempt ${attempt + 1} failed:`, error);

      // If error is not retryable, break the loop
      if (!RETRYABLE_ERROR_CODES.some((code) => error.code === code || error.status === code)) {
        break;
      }
    }
  }

  // If calls failed and SMS fallback is enabled, try SMS
  if (shouldFallbackToSMS) {
    try {
      const sms = await sendSMS({
        phone,
        message: `URGENT: ${message}\n\nNote: This SMS was sent because we couldn't reach you via phone call.`,
      });

      if (sms.success) {
        return {
          success: true,
          smsSid: sms.callSid,
          fallbackToSMS: true,
          error: `Call failed but SMS sent: ${lastError?.message}`,
        };
      }
    } catch (smsError) {
      console.error('SMS fallback failed:', smsError);
    }
  }

  return {
    error: `Failed to reach user after ${retryCount} call attempts: ${lastError?.message}`,
    success: false,
  };
}

export async function sendSMS(data: z.infer<typeof smsSchema>): Promise<CallResult> {
  try {
    const { phone, message } = smsSchema.parse(data);

    const sms = await client.messages.create({
      body: message,
      to: phone, // The user's phone number to send to
      from: requiredEnvVars.TWILIO_PHONE_NUMBER, // Our Twilio number to send from
      statusCallback: requiredEnvVars.TWILIO_STATUS_CALLBACK_URL,
    });

    return { success: true, callSid: sms.sid };
  } catch (error: any) {
    console.error('Error sending SMS:', error);
    return { error: `Failed to send SMS: ${error.message}` };
  }
}
