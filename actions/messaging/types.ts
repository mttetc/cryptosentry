export interface CallOptions {
  userId: string;
  phone: string;
  message: string;
  bypassDailyLimit?: boolean;
  isEmergency?: boolean;
  shouldFallbackToSMS?: boolean;
  retryCount?: number;
  retryDelay?: number;
}

export interface SMSOptions {
  userId: string;
  phone: string;
  message: string;
  bypassLimits?: boolean;
  isEmergency?: boolean;
}

export interface CallResponse {
  success?: boolean;
  callId?: string;
  error?: string;
  remainingCalls?: number;
  blockRemaining?: number;
  blockReason?: string;
}

export interface SMSResponse {
  success?: boolean;
  messageId?: string;
  error?: string;
  remainingSMS?: number;
}

export interface MessagingProvider {
  makeCall(options: CallOptions): Promise<CallResponse>;
  sendSMS(options: SMSOptions): Promise<SMSResponse>;
  validateWebhook(signature: string, payload: string, timestamp: string): boolean;
  handleCallWebhook(data: any): Promise<void>;
} 