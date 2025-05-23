import { z } from 'zod';

// Regex for country code validation (ISO 3166-1 alpha-2)
const countryCodeRegex = /^[A-Z]{2}$/;

// Regex for alphanumeric sender ID
const alphanumericSenderRegex = /^[A-Za-z0-9 ]{1,11}$/;

// Regex for daily spend limit
const dailySpendLimitRegex = /^[0-9]+(?:\.[0-9]+)?$/;

export const numberPoolSettingsSchema = z
  .object({
    toll_free_weight: z.number().min(0).optional(),
    long_code_weight: z.number().min(0).optional(),
    skip_unhealthy: z.boolean().optional(),
    sticky_sender: z.boolean().optional(),
    geomatch: z.boolean().optional(),
  })
  .nullable();

export const urlShortenerSettingsSchema = z
  .object({
    domain: z.string().nullable(),
    prefix: z.string().optional(),
    replace_blacklist_only: z.boolean().optional(),
    send_webhooks: z.boolean().optional(),
  })
  .nullable();

export const messagingProfileSchema = z.object({
  name: z.string().min(1),
  whitelisted_destinations: z.array(z.string().regex(countryCodeRegex)).min(1),
  enabled: z.boolean().default(true),
  webhook_url: z.string().url().nullable(),
  webhook_failover_url: z.string().url().nullable(),
  webhook_api_version: z.enum(['1', '2', '2010-04-01']).default('2'),
  number_pool_settings: numberPoolSettingsSchema,
  url_shortener_settings: urlShortenerSettingsSchema,
  alpha_sender: z.string().regex(alphanumericSenderRegex).nullable(),
  daily_spend_limit: z.string().regex(dailySpendLimitRegex).optional(),
  daily_spend_limit_enabled: z.boolean().optional(),
  mms_fall_back_to_sms: z.boolean().optional(),
  mms_transcoding: z.boolean().optional(),
});

export const messageTypeSchema = z.enum(['sms', 'call', 'both']);

export const notificationPayloadSchema = z.object({
  userId: z.string().min(1),
  message: z.string().min(1),
  type: messageTypeSchema,
  phone: z
    .string()
    .regex(/^\+[1-9]\d{1,14}$/, 'Must be an E.164 phone number')
    .optional(),
});

export const notificationResponseSchema = z.object({
  success: z.boolean(),
  error: z.string().optional(),
  messageId: z.string().optional(), // For backward compatibility
  smsMessageId: z.string().optional(),
  callId: z.string().optional(),
  provider: z.enum(['telnyx', 'telegram']).optional(), // Removed 'whatsapp'
});

export const telnyxSMSResponseSchema = z.object({
  success: z.boolean(),
  messageId: z.string().optional(),
  error: z.string().optional(),
});

export const telnyxCallResponseSchema = z.object({
  success: z.boolean(),
  callId: z.string().optional(),
  error: z.string().optional(),
});

export const telnyxCallPayloadSchema = z.object({
  to: z.string().regex(/^\+[1-9]\d{1,14}$/, 'Must be an E.164 phone number'),
  from: z.string().regex(/^\+[1-9]\d{1,14}$/, 'Must be an E.164 phone number'),
  webhook_url: z.string().url(),
  record_audio: z.boolean(),
  timeout_secs: z.number().int().positive(),
  answering_machine_detection: z.enum(['basic', 'premium']),
  custom_headers: z.record(z.string(), z.string()),
  tts_voice: z.string(),
  tts_payload: z.string().min(1),
});

export const messageRequestSchema = z.object({
  from: z
    .string()
    .regex(
      /^\+?[1-9]\d{1,14}$|^[A-Za-z0-9]{1,11}$/,
      'Must be an E.164 phone number or alphanumeric sender ID'
    ),
  messaging_profile_id: z.string().min(1, 'Messaging profile ID is required'),
  to: z.string().regex(/^\+[1-9]\d{1,14}$/, 'Must be an E.164 phone number'),
  text: z.string().min(1, 'Message cannot be empty').max(1600, 'Message too long'),
  type: z.enum(['SMS', 'MMS']).default('SMS'),
  media_urls: z.array(z.string().url()).optional(),
  subject: z.string().optional(),
});

// Telegram-specific schemas
export const telegramMessageSchema = z.object({
  chat_id: z.string().min(1, 'Chat ID is required'),
  text: z.string().min(1, 'Message cannot be empty'),
  parse_mode: z.enum(['HTML', 'Markdown', 'MarkdownV2']).optional(),
  disable_web_page_preview: z.boolean().optional(),
  disable_notification: z.boolean().optional(),
  reply_to_message_id: z.number().optional(),
  allow_sending_without_reply: z.boolean().optional(),
});

export const telegramCallPayloadSchema = z.object({
  chat_id: z.string().min(1, 'Chat ID is required'),
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  start_date: z.number().optional(),
});

// Removed WhatsApp-specific schemas

export type MessageType = z.infer<typeof messageTypeSchema>;
export type NotificationPayload = z.infer<typeof notificationPayloadSchema>;
export type NotificationResponse = z.infer<typeof notificationResponseSchema>;
export type TelnyxSMSResponse = z.infer<typeof telnyxSMSResponseSchema>;
export type TelnyxCallResponse = z.infer<typeof telnyxCallResponseSchema>;
export type TelnyxCallPayload = z.infer<typeof telnyxCallPayloadSchema>;
export type TelegramMessagePayload = z.infer<typeof telegramMessageSchema>;
export type TelegramCallPayload = z.infer<typeof telegramCallPayloadSchema>;
// Removed WhatsApp type exports
