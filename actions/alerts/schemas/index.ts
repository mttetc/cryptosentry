import { z } from 'zod';

export const alertConditionSchema = z.enum(['above', 'below', 'between', 'change']);
export const logicOperatorSchema = z.enum(['AND', 'OR']);

export const assetConditionSchema = z.object({
  symbol: z.string().min(1),
  condition: alertConditionSchema,
  value: z.number(),
  value2: z.number().optional(),
  percentageChange: z.number().optional(),
  isReference: z.boolean().optional(),
});

export const priceAlertSchema = z.object({
  symbol: z.string().min(1).toUpperCase(),
  targetPrice: z.number().positive(),
  condition: alertConditionSchema,
});

export const socialAlertSchema = z.object({
  account: z
    .string()
    .min(1)
    .toLowerCase()
    .transform((val) => val.replace('@', '')),
  keywords: z.array(z.string().min(1)),
});

export const alertTypeSchema = z.enum(['price', 'social']);

export type AlertCondition = z.infer<typeof alertConditionSchema>;
export type LogicOperator = z.infer<typeof logicOperatorSchema>;
export type AssetCondition = z.infer<typeof assetConditionSchema>;
export type AlertType = z.infer<typeof alertTypeSchema>;

// Notification related types
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
  notificationId?: string;
}
