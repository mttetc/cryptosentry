import { z } from 'zod';

// Base event data schemas
const baseEventData = z.object({
  timestamp: z.number(),
});

// Event-specific schemas
export const initEventSchema = z.object({
  type: z.literal('init'),
  data: baseEventData.extend({
    connectionId: z.string().uuid(),
    status: z.enum(['connected', 'reconnected']),
    userId: z.string().optional(),
  }),
});

export const pingEventSchema = z.object({
  type: z.literal('ping'),
  data: baseEventData.extend({
    connectionId: z.string().uuid().optional(),
  }),
});

export const priceUpdateSchema = z.object({
  type: z.literal('price_update'),
  data: baseEventData.extend({
    symbol: z.string(),
    price: z.number().positive(),
    change: z.number().optional(),
    changePercent: z.number().optional(),
  }),
});

export const socialUpdateSchema = z.object({
  type: z.literal('social_update'),
  data: baseEventData.extend({
    platform: z.string(),
    content: z.string(),
    author: z.string().optional(),
    sentiment: z.enum(['positive', 'negative', 'neutral']).optional(),
  }),
});

export const errorEventSchema = z.object({
  type: z.literal('error'),
  data: baseEventData.extend({
    code: z.string().optional(),
    message: z.string(),
    details: z.record(z.any()).optional(),
  }),
});

export const timeoutEventSchema = z.object({
  type: z.literal('timeout'),
  data: baseEventData.extend({
    reason: z.string(),
  }),
});

// Main SSE event schema
export const sseEventSchema = z.discriminatedUnion('type', [
  initEventSchema,
  pingEventSchema,
  priceUpdateSchema,
  socialUpdateSchema,
  errorEventSchema,
  timeoutEventSchema,
]);

// Type exports
export type SSEEvent = z.infer<typeof sseEventSchema>;
export type SSEEventType = SSEEvent['type'];
export type InitEvent = z.infer<typeof initEventSchema>;
export type PingEvent = z.infer<typeof pingEventSchema>;
export type PriceUpdateEvent = z.infer<typeof priceUpdateSchema>;
export type SocialUpdateEvent = z.infer<typeof socialUpdateSchema>;
export type ErrorEvent = z.infer<typeof errorEventSchema>;
export type TimeoutEvent = z.infer<typeof timeoutEventSchema>;
