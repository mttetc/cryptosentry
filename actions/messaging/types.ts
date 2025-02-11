export interface CallOptions {
  phone: string;
  message: string;
  retryCount?: number;
  retryDelay?: number;
  isEmergency?: boolean;
  shouldFallbackToSMS?: boolean;
  bypassCooldown?: boolean;
  bypassDailyLimit?: boolean;
  userId: string;
}

export interface SMSOptions {
  phone: string;
  message: string;
  isEmergency?: boolean;
  bypassLimits?: boolean;
  userId: string;
}

export interface CallResponse {
  success?: boolean;
  error?: string;
  callId?: string;
  message?: string;
  remainingCalls?: number;
  blockRemaining?: number;
  blockReason?: string;
  cooldownRemaining?: number;
  rateLimitReset?: number;
}

export interface SMSResponse {
  success?: boolean;
  error?: string;
  messageId?: string;
  remainingSMS?: number;
  truncated?: boolean;
  cooldownRemaining?: number;
  rateLimitReset?: number;
}

export interface MessagingProvider {
  makeCall(options: CallOptions): Promise<CallResponse>;
  sendSMS(options: SMSOptions): Promise<SMSResponse>;
  validateWebhook(signature: string, payload: string, timestamp: string): boolean;
  handleCallWebhook(data: any): Promise<void>;
} 