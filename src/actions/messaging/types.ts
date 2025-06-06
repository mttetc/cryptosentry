export type MessageType = 'sms' | 'call' | 'both';

export interface NotificationPayload {
  userId: string;
  message: string;
  type: MessageType;
}

export interface NotificationResponse {
  success: boolean;
  error?: string;
  messageId?: string; // For backward compatibility
  smsMessageId?: string;
  callId?: string;
}

export interface MessageCarrier {
  phone_number: string;
  carrier: string;
  line_type: string;
}

export interface MessageRecipient extends MessageCarrier {
  status: 'queued' | 'sending' | 'sent' | 'delivered' | 'failed';
}

export interface MessageMedia {
  url: string;
  content_type: string | null;
  sha256: string | null;
  size: number | null;
}

export interface TelnyxMessageResponse {
  record_type: 'message';
  direction: 'outbound' | 'inbound';
  id: string;
  type: 'SMS' | 'MMS';
  messaging_profile_id: string;
  organization_id: string;
  from: MessageCarrier;
  to: MessageRecipient[];
  text: string;
  subject?: string;
  media?: MessageMedia[];
  webhook_url?: string;
  webhook_failover_url?: string;
  encoding: string;
  parts: number;
  tags?: string[];
  cost: number | null;
  received_at: string;
  sent_at: string | null;
  completed_at: string | null;
  valid_until: string | null;
  errors: any[];
}

export interface CallOptions {
  userId: string;
  phone: string;
  message: string;
  bypassDailyLimit?: boolean;
  isEmergency?: boolean;
  recipientType?: 'human_residence' | 'human_business' | 'machine';
  amdConfig?: {
    totalAnalysisTimeMillis?: number;
    afterGreetingSilenceMillis?: number;
    betweenWordsSilenceMillis?: number;
    greetingDurationMillis?: number;
    initialSilenceMillis?: number;
    maximumNumberOfWords?: number;
    maximumWordLengthMillis?: number;
    silenceThreshold?: number;
    greetingTotalAnalysisTimeMillis?: number;
    greetingSilenceDurationMillis?: number;
  };
}

export interface SMSOptions {
  userId: string;
  phone: string;
  message: string;
}

export interface CallResponse {
  success?: boolean;
  callId?: string;
  remainingCalls?: number;
  error?: string;
  blockRemaining?: number;
  blockReason?: string;
  amdResult?: {
    type: 'human_residence' | 'human_business' | 'machine' | 'silence' | 'fax_detected';
    beepDetected?: boolean;
  };
}

export interface SMSResponse {
  success?: boolean;
  messageId?: string;
  error?: string;
  remainingSMS?: number;
}

export interface AMDResult {
  type: 'human_residence' | 'human_business' | 'machine' | 'silence' | 'fax_detected';
  beepDetected?: boolean;
  callId: string;
  userId: string;
  phone: string;
  timestamp: string;
  messageDelivered: boolean;
  duration: number;
  cost?: number;
}

export interface AMDAnalytics {
  totalCalls: number;
  humanDetectionRate: number;
  machineDetectionRate: number;
  avgResponseTime: number;
  successRate: number;
  costPerCall: number;
}

export interface TelnyxPhoneNumber {
  id: string;
  record_type: 'phone_number';
  phone_number: string;
  status: string;
  connection_id?: string;
  connection_name?: string;
  messaging_profile_id?: string;
  emergency_enabled: boolean;
  emergency_address_id?: string;
  emergency_status?: string;
  call_forwarding_enabled: boolean;
  cnam_listing_enabled: boolean;
  caller_id_name_enabled: boolean;
  call_recording_enabled: boolean;
  t38_fax_gateway_enabled: boolean;
  hd_voice_enabled: boolean;
}

export interface TelnyxOutboundVoiceProfile {
  id: string;
  record_type: 'outbound_voice_profile';
  name: string;
  connections_count: number;
  traffic_type: 'conversational';
  service_plan: 'global';
  concurrent_call_limit: number | null;
  enabled: boolean;
  tags: string[];
  usage_payment_method: 'rate-deck';
  whitelisted_destinations: string[];
  max_destination_rate: number;
  daily_spend_limit: string;
  daily_spend_limit_enabled: boolean;
  call_recording?: {
    call_recording_type: 'by_caller_phone_number';
    call_recording_caller_phone_numbers: string[];
    call_recording_channels: 'dual';
    call_recording_format: 'mp3';
  };
  billing_group_id?: string;
  created_at: string;
  updated_at: string;
}

export type TelnyxCallEventType =
  | 'call.initiated'
  | 'call.answered'
  | 'call.completed'
  | 'call.machine.premium.detection.ended'
  | 'call.machine.premium.greeting.ended'
  | 'call.failed'
  | 'call.hangup'
  | 'call.recording.saved';

export interface TelnyxWebhookPayload {
  call_control_id: string;
  call_leg_id: string;
  event_type: TelnyxCallEventType;
  payload: {
    from: string;
    to: string;
    direction: 'inbound' | 'outbound';
    state: string;
    duration?: number;
    cost?: number;
    result?: 'human_residence' | 'human_business' | 'machine' | 'silence' | 'fax_detected';
    amd_result?: {
      type: 'human_residence' | 'human_business' | 'machine' | 'silence' | 'fax_detected';
      beep_detected?: boolean;
    };
    recorded?: boolean;
    custom_headers?: {
      'X-User-Id'?: string;
      [key: string]: string | undefined;
    };
  };
}

// Telegram-specific types
export interface TelegramUser {
  id: string;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_bot: boolean;
}

export interface TelegramChat {
  id: string;
  type: 'private' | 'group' | 'supergroup' | 'channel';
  title?: string;
  username?: string;
  first_name?: string;
  last_name?: string;
}

export interface TelegramMessage {
  message_id: number;
  from?: TelegramUser;
  date: number;
  chat: TelegramChat;
  text?: string;
  entities?: TelegramMessageEntity[];
}

export interface TelegramMessageEntity {
  type: string;
  offset: number;
  length: number;
  url?: string;
  user?: TelegramUser;
  language?: string;
}

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
}

export interface TelegramCallbackQuery {
  id: string;
  from: TelegramUser;
  message?: TelegramMessage;
  inline_message_id?: string;
  chat_instance: string;
  data?: string;
}

export interface TelegramWebhookPayload {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
}

export interface MessagingProvider {
  makeCall(options: CallOptions): Promise<CallResponse>;
  sendSMS(options: SMSOptions): Promise<SMSResponse>;
  validateWebhook(signature: string, payload: string, timestamp: string): boolean;
  handleCallWebhook(data: TelnyxWebhookPayload | TelegramWebhookPayload): Promise<void>;
  handleSMSWebhook(data: TelnyxWebhookPayload | TelegramWebhookPayload): Promise<void>;
  getAMDAnalytics?(userId: string, timeRange?: { start: Date; end: Date }): Promise<AMDAnalytics>;
  listPhoneNumbers?(): Promise<TelnyxPhoneNumber[]>;
  getRemainingUsage?(userId: string): Promise<{ remainingCalls: number; remainingSMS: number }>;
}
