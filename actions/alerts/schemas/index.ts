import { z } from 'zod';

export const alertConditionSchema = z.enum(['above', 'below', 'between', 'change']);
export const logicOperatorSchema = z.enum(['AND', 'OR']);

export const assetConditionSchema = z.object({
  symbol: z.string().min(1),
  condition: alertConditionSchema,
  value: z.number(),
  value2: z.number().optional(),
});

export const alertTypeSchema = z.enum(['price', 'social']);

export type AlertCondition = z.infer<typeof alertConditionSchema>;
export type LogicOperator = z.infer<typeof logicOperatorSchema>;
export type AssetCondition = z.infer<typeof assetConditionSchema>;
export type AlertType = z.infer<typeof alertTypeSchema>;

export type AlertState = {
  error?: string;
  success: boolean;
};

export const initialAlertState: AlertState = {
  error: undefined,
  success: false,
};

export const priceAlertSchema = z.object({
  symbol: z.string().min(1),
  targetPrice: z.number().positive(),
  condition: z.enum(['above', 'below']),
});

export const socialAlertSchema = z.object({
  account: z.string().min(1),
  keywords: z.array(z.string().min(1)),
});

export const alertDeliveryLogSchema = z.object({
  alert_id: z.string(),
  user_id: z.string(),
  type: z.enum(['price', 'social']),
  channel: z.enum(['sms', 'call']),
  message_id: z.string(),
  data: z.record(z.any()),
});

export type AlertDeliveryLog = z.infer<typeof alertDeliveryLogSchema>;

export interface AlertNotification {
  userId: string;
  alertId: string;
  type: AlertType;
  message: string;
  data: {
    symbol?: string;
    price?: number;
    account?: string;
    keywords?: string[];
    condition?: AlertCondition;
    targetPrice?: number;
  };
}

export interface NotificationResult {
  success: boolean;
  error?: string;
  smsMessageId?: string;
  callId?: string;
}
