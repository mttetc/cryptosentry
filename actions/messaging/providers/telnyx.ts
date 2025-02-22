'use server';

import { MessagingProvider, CallOptions, SMSOptions, CallResponse, SMSResponse, TelnyxMessageResponse, AMDResult, AMDAnalytics, TelnyxWebhookPayload, TelnyxPhoneNumber, TelnyxOutboundVoiceProfile } from '../types';
import { SETTINGS } from '../config';
import { createPublicKey, verify } from 'crypto';
import { Buffer } from 'buffer';
import { createServerSupabaseClient } from '@/lib/supabase';

// Telnyx client setup
const TELNYX_API_KEY = process.env.TELNYX_API_KEY!;
const TELNYX_PUBLIC_KEY = process.env.TELNYX_PUBLIC_KEY!;
const TELNYX_API_BASE = process.env.TELNYX_API_BASE || 'https://api.telnyx.com/v2';

// Optimize message for TTS based on recipient type
function optimizeMessage(message: string, recipientType?: 'human_residence' | 'human_business' | 'machine'): string {
  let optimized = message;
  let rate = SETTINGS.CALL.SPEECH.RATE;
  
  // Adjust rate based on recipient type
  switch (recipientType) {
    case 'human_residence':
      rate = SETTINGS.CALL.SPEECH.RATE * 0.9; // Slightly slower for residential
      break;
    case 'human_business':
      rate = SETTINGS.CALL.SPEECH.RATE * 1.1; // Slightly faster for business
      break;
    case 'machine':
      rate = SETTINGS.CALL.SPEECH.RATE * 1.2; // Faster for machines
      break;
  }

  // Format crypto alerts
  optimized = optimized.replace(
    /(\w+) price (\w+) \$?([\d,.]+)/gi,
    '$1 is now $3 dollars'
  );

  // Format social alerts
  optimized = optimized.replace(
    /@(\w+) posted: (.*)/gi,
    '$1 just posted: $2'
  );

  // Add pauses between different alerts
  optimized = optimized.replace(/\. /g, '. <break time="0.8s"/> ');

  // Ensure proper SSML formatting with dynamic rate
  optimized = `<speak><prosody rate="${rate}">${optimized}</prosody></speak>`;

  return optimized;
}

// Reusable fetch wrapper with error handling
async function telnyxRequest<T>(
  endpoint: string,
  method: string,
  requestData?: any,
  retryCount = 2
): Promise<T> {
  try {
    const response: Response = await fetch(`${TELNYX_API_BASE}${endpoint}`, {
      method,
      headers: {
        'Authorization': `Bearer ${TELNYX_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: requestData ? JSON.stringify(requestData) : undefined,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ errors: [{ detail: 'Unknown error' }] }));
      const errorDetail = error.errors?.[0]?.detail || `HTTP error! status: ${response.status}`;
      
      // Check if we should retry based on error code
      const statusCode = response.status as 408 | 500 | 502 | 503 | 504;
      if (retryCount > 0 && SETTINGS.ERROR_HANDLING.AUTO_RETRY_CODES.includes(statusCode)) {
        const delay = SETTINGS.ERROR_HANDLING.BACKOFF.INITIAL_DELAY * Math.pow(SETTINGS.ERROR_HANDLING.BACKOFF.MULTIPLIER, SETTINGS.ERROR_HANDLING.MAX_RETRIES - retryCount);
        await new Promise(resolve => setTimeout(resolve, Math.min(delay, SETTINGS.ERROR_HANDLING.BACKOFF.MAX_DELAY)));
        return telnyxRequest(endpoint, method, requestData, retryCount - 1);
      }

      throw new Error(errorDetail);
    }

    const responseData: T = await response.json();
    return responseData;
  } catch (error) {
    if (error instanceof Error) {
      error.message = `Telnyx API Error (${method} ${endpoint}): ${error.message}`;
    }
    throw error;
  }
}

// Function to list phone numbers with settings
async function listPhoneNumbers(): Promise<TelnyxPhoneNumber[]> {
  try {
    const response = await telnyxRequest<{ data: TelnyxPhoneNumber[] }>('/phone_numbers', 'GET');
    return response.data;
  } catch (error) {
    console.error('Error listing phone numbers:', error);
    throw error;
  }
}

// Function to update phone number settings
async function updatePhoneNumber(
  id: string,
  settings: {
    connection_id?: string;
    emergency_enabled?: boolean;
    emergency_address_id?: string;
    call_forwarding_enabled?: boolean;
    cnam_listing_enabled?: boolean;
    caller_id_name_enabled?: boolean;
    call_recording_enabled?: boolean;
    t38_fax_gateway_enabled?: boolean;
    hd_voice_enabled?: boolean;
    tags?: string[];
  }
): Promise<TelnyxPhoneNumber> {
  try {
    const response = await telnyxRequest<{ data: TelnyxPhoneNumber }>(
      `/phone_numbers/${id}`,
      'PATCH',
      settings
    );
    return response.data;
  } catch (error) {
    console.error('Error updating phone number:', error);
    throw error;
  }
}

// Function to optimize phone number settings
async function optimizePhoneNumberSettings(): Promise<void> {
  try {
    const numbers = await listPhoneNumbers();
    
    for (const number of numbers) {
      // Skip numbers that aren't active
      if (number.status !== 'active') continue;

      // Optimal settings for voice and messaging
      const optimalSettings = {
        hd_voice_enabled: true,
        call_recording_enabled: false, // Enable only if needed for compliance
        caller_id_name_enabled: true,
        cnam_listing_enabled: true,
        t38_fax_gateway_enabled: true, // For fax support
        emergency_enabled: true, // Important for compliance
        tags: ['optimized', 'voice-messaging'],
      };

      // Update the number with optimal settings
      await updatePhoneNumber(number.id, optimalSettings);
      
      console.log(`Optimized settings for number ${number.phone_number}`);
    }
  } catch (error) {
    console.error('Error optimizing phone number settings:', error);
    throw error;
  }
}

// Function to create an outbound voice profile
async function createOutboundVoiceProfile(
  name: string,
  settings: {
    concurrent_call_limit?: number;
    whitelisted_destinations?: string[];
    max_destination_rate?: number;
    daily_spend_limit?: string;
    daily_spend_limit_enabled?: boolean;
    tags?: string[];
  }
): Promise<TelnyxOutboundVoiceProfile> {
  try {
    const response = await telnyxRequest<{ data: TelnyxOutboundVoiceProfile }>(
      '/outbound_voice_profiles',
      'POST',
      {
        name,
        traffic_type: 'conversational',
        service_plan: 'global',
        usage_payment_method: 'rate-deck',
        enabled: true,
        ...settings,
      }
    );
    return response.data;
  } catch (error) {
    console.error('Error creating outbound voice profile:', error);
    throw error;
  }
}

// Function to get all outbound voice profiles
async function listOutboundVoiceProfiles(): Promise<TelnyxOutboundVoiceProfile[]> {
  try {
    const response = await telnyxRequest<{ data: TelnyxOutboundVoiceProfile[] }>(
      '/outbound_voice_profiles',
      'GET'
    );
    return response.data;
  } catch (error) {
    console.error('Error listing outbound voice profiles:', error);
    throw error;
  }
}

// Function to update an outbound voice profile
async function updateOutboundVoiceProfile(
  id: string,
  settings: {
    name?: string;
    concurrent_call_limit?: number;
    enabled?: boolean;
    whitelisted_destinations?: string[];
    max_destination_rate?: number;
    daily_spend_limit?: string;
    daily_spend_limit_enabled?: boolean;
    tags?: string[];
  }
): Promise<TelnyxOutboundVoiceProfile> {
  try {
    const response = await telnyxRequest<{ data: TelnyxOutboundVoiceProfile }>(
      `/outbound_voice_profiles/${id}`,
      'PATCH',
      settings
    );
    return response.data;
  } catch (error) {
    console.error('Error updating outbound voice profile:', error);
    throw error;
  }
}

// Function to setup default outbound voice profile
async function setupDefaultOutboundVoiceProfile(): Promise<void> {
  try {
    // Check if we already have a default profile
    const profiles = await listOutboundVoiceProfiles();
    const defaultProfile = profiles.find(p => p.tags.includes('default'));

    const settings = {
      concurrent_call_limit: SETTINGS.CALL.LIMITS.CONCURRENT,
      whitelisted_destinations: ['US', 'CA', 'FR', 'CN'], // Added France (FR) and China (CN)
      max_destination_rate: 0.25, // Increased rate limit for international calls
      daily_spend_limit: '250.00', // Increased daily limit for international calls
      daily_spend_limit_enabled: true,
      tags: ['default', 'optimized', 'international', new Date().toISOString().split('T')[0]],
    };

    if (defaultProfile) {
      // Update existing profile with optimal settings
      await updateOutboundVoiceProfile(defaultProfile.id, settings);
    } else {
      // Create new default profile
      await createOutboundVoiceProfile('Default Voice Profile', settings);
    }
  } catch (error) {
    console.error('Error setting up default outbound voice profile:', error);
    throw error;
  }
}

// Function to get remaining usage from Telnyx
async function getRemainingUsage(userId: string): Promise<{ remainingCalls: number; remainingSMS: number }> {
  try {
    // Get the default voice profile
    const profiles = await listOutboundVoiceProfiles();
    const defaultProfile = profiles.find(p => p.tags.includes('default'));
    
    if (!defaultProfile) {
      return {
        remainingCalls: SETTINGS.CALL.LIMITS.DAILY,
        remainingSMS: SETTINGS.SMS.LIMITS.DAILY
      };
    }

    // Get today's usage
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    
    const usageResponse = await telnyxRequest<{ data: { total_cost: string; call_count: number; message_count: number } }>(
      `/usage_reports?start_time=${startOfDay}&profile_id=${defaultProfile.id}`,
      'GET'
    );

    const { call_count = 0, message_count = 0 } = usageResponse.data;

    return {
      remainingCalls: Math.max(0, SETTINGS.CALL.LIMITS.DAILY - call_count),
      remainingSMS: Math.max(0, SETTINGS.SMS.LIMITS.DAILY - message_count)
    };
  } catch (error) {
    console.error('Error getting remaining usage:', error);
    // Return default limits if we can't get actual usage
    return {
      remainingCalls: SETTINGS.CALL.LIMITS.DAILY,
      remainingSMS: SETTINGS.SMS.LIMITS.DAILY
    };
  }
}

export const telnyxProvider: MessagingProvider = {
  async makeCall(options: CallOptions): Promise<CallResponse> {
    try {
      const optimizedMessage = optimizeMessage(options.message, options.recipientType);

      // Get a number from our pool based on destination country
      const numbers = await listPhoneNumbers();
      let fromNumber: TelnyxPhoneNumber | undefined;

      if (options.phone.startsWith('+1')) { // US/CA
        fromNumber = numbers.find(n => n.status === 'active' && n.phone_number.startsWith('+1'));
      } else if (options.phone.startsWith('+33')) { // France
        fromNumber = numbers.find(n => n.status === 'active' && n.phone_number.startsWith('+33'));
      } else if (options.phone.startsWith('+86')) { // China
        fromNumber = numbers.find(n => n.status === 'active' && n.phone_number.startsWith('+86'));
      }

      if (!fromNumber) {
        throw new Error(`No available phone number found for destination ${options.phone}`);
      }

      // Prepare AMD configuration
      const amdConfig = {
        total_analysis_time_millis: options.amdConfig?.totalAnalysisTimeMillis || SETTINGS.CALL.AMD.DEFAULT_CONFIG.TOTAL_ANALYSIS_TIME,
        after_greeting_silence_millis: options.amdConfig?.afterGreetingSilenceMillis || SETTINGS.CALL.AMD.DEFAULT_CONFIG.AFTER_GREETING_SILENCE,
        between_words_silence_millis: options.amdConfig?.betweenWordsSilenceMillis || SETTINGS.CALL.AMD.DEFAULT_CONFIG.BETWEEN_WORDS_SILENCE,
        greeting_duration_millis: options.amdConfig?.greetingDurationMillis || SETTINGS.CALL.AMD.DEFAULT_CONFIG.GREETING_DURATION,
        initial_silence_millis: options.amdConfig?.initialSilenceMillis || SETTINGS.CALL.AMD.DEFAULT_CONFIG.INITIAL_SILENCE,
        maximum_number_of_words: options.amdConfig?.maximumNumberOfWords || SETTINGS.CALL.AMD.DEFAULT_CONFIG.MAX_WORDS,
        maximum_word_length_millis: options.amdConfig?.maximumWordLengthMillis || SETTINGS.CALL.AMD.DEFAULT_CONFIG.MAX_WORD_LENGTH,
        silence_threshold: options.amdConfig?.silenceThreshold || SETTINGS.CALL.AMD.DEFAULT_CONFIG.SILENCE_THRESHOLD,
        greeting_total_analysis_time_millis: options.amdConfig?.greetingTotalAnalysisTimeMillis || SETTINGS.CALL.AMD.DEFAULT_CONFIG.GREETING_TOTAL_ANALYSIS_TIME,
        greeting_silence_duration_millis: options.amdConfig?.greetingSilenceDurationMillis || SETTINGS.CALL.AMD.DEFAULT_CONFIG.GREETING_SILENCE_DURATION,
      };

      // Make the call with premium AMD
      const response = await telnyxRequest<{ data: { id: string } }>('/calls', 'POST', {
        to: options.phone,
        from: fromNumber.phone_number,
        webhook_url: process.env.TELNYX_WEBHOOK_URL,
        record_audio: false,
        timeout_secs: SETTINGS.CALL.TIMEOUTS.ANSWER,
        answering_machine_detection: 'premium',
        answering_machine_detection_config: amdConfig,
        custom_headers: {
          'X-User-Id': options.userId,
        },
        tts_voice: SETTINGS.CALL.SPEECH.VOICE,
        tts_language: options.phone.startsWith('+33') ? 'fr-FR' : 
                     options.phone.startsWith('+86') ? 'cmn-CN' : 
                     'en-US', // Set language based on destination
        tts_payload: optimizedMessage
      });

      return {
        success: true,
        callId: response.data.id,
      };
    } catch (error) {
      console.error('Error making call:', error);
      return {
        error: error instanceof Error ? error.message : 'Failed to make call',
      };
    }
  },

  async sendSMS(options: SMSOptions): Promise<SMSResponse> {
    try {
      // Use alphanumeric sender for international numbers, use number pool for US/CA
      let from: string;
      
      if (options.phone.startsWith('+1')) { // US/CA
        const numbers = await listPhoneNumbers();
        const usNumber = numbers.find(n => n.status === 'active' && n.phone_number.startsWith('+1'));
        from = usNumber?.phone_number || process.env.TELNYX_SENDER_ID!;
      } else if (options.phone.startsWith('+33')) { // France
        const numbers = await listPhoneNumbers();
        const frNumber = numbers.find(n => n.status === 'active' && n.phone_number.startsWith('+33'));
        from = frNumber?.phone_number || process.env.TELNYX_SENDER_ID!;
      } else if (options.phone.startsWith('+86')) { // China
        const numbers = await listPhoneNumbers();
        const cnNumber = numbers.find(n => n.status === 'active' && n.phone_number.startsWith('+86'));
        from = cnNumber?.phone_number || process.env.TELNYX_SENDER_ID!;
      } else {
        from = process.env.TELNYX_SENDER_ID!; // Default to alphanumeric sender for other countries
      }

      const response = await telnyxRequest<{ data: { id: string } }>('/messages', 'POST', {
        to: options.phone,
        from,
        text: options.message.slice(0, SETTINGS.SMS.MESSAGE.MAX_LENGTH),
        messaging_profile_id: process.env.TELNYX_MESSAGING_PROFILE_ID,
        webhook_url: process.env.TELNYX_WEBHOOK_URL,
        custom_headers: {
          'X-User-Id': options.userId,
        },
      });

      return {
        success: true,
        messageId: response.data.id,
      };
    } catch (error) {
      console.error('Error sending SMS:', error);
      return {
        error: error instanceof Error ? error.message : 'Failed to send SMS',
      };
    }
  },

  async handleCallWebhook(payload: TelnyxWebhookPayload): Promise<void> {
    try {
      const supabase = await createServerSupabaseClient();
      const userId = payload.payload.custom_headers?.['X-User-Id'];

      if (!userId) {
        console.warn('Missing userId in webhook payload');
        return;
      }

      // Store analytics
      await supabase.from('call_analytics').insert({
        user_id: userId,
        call_id: payload.call_control_id,
        event_type: payload.event_type,
        duration: payload.payload.duration,
        direction: payload.payload.direction,
        from: payload.payload.from,
        to: payload.payload.to,
        status: payload.payload.state,
        result: payload.payload.result,
        amd_result: payload.payload.amd_result,
        cost: payload.payload.cost,
        recorded: payload.payload.recorded,
        created_at: new Date().toISOString(),
      });

    } catch (error) {
      console.error('Error handling call webhook:', error);
    }
  },

  async handleSMSWebhook(payload: TelnyxWebhookPayload): Promise<void> {
    try {
      const supabase = await createServerSupabaseClient();
      const userId = payload.payload.custom_headers?.['X-User-Id'];

      if (!userId) {
        console.warn('Missing userId in webhook payload');
        return;
      }

      // Store analytics
      await supabase.from('sms_analytics').insert({
        user_id: userId,
        message_id: payload.call_control_id,
        event_type: payload.event_type,
        direction: payload.payload.direction,
        from: payload.payload.from,
        to: payload.payload.to,
        status: payload.payload.state,
        cost: payload.payload.cost,
        created_at: new Date().toISOString(),
      });

    } catch (error) {
      console.error('Error handling SMS webhook:', error);
    }
  },

  validateWebhook(signature: string, payload: string, timestamp: string): boolean {
    try {
      const publicKey = createPublicKey({
        key: TELNYX_PUBLIC_KEY,
        format: 'pem',
        type: 'spki',
      });

      return verify(
        'sha256',
        Buffer.from(payload),
        publicKey,
        Buffer.from(signature, 'base64')
      );
    } catch (error) {
      console.error('Error verifying webhook signature:', error);
      return false;
    }
  },

  // Add back the utility functions
  listPhoneNumbers,
  updatePhoneNumber,
  optimizePhoneNumberSettings,
  createOutboundVoiceProfile,
  listOutboundVoiceProfiles,
  updateOutboundVoiceProfile,
  setupDefaultOutboundVoiceProfile,
  getRemainingUsage,
}; 