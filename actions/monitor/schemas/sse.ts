import { z } from 'zod';

// Event-specific schemas
export const priceUpdateSchema = z.object({
  type: z.literal('price_update'),
  data: z.object({
    symbol: z.string(),
    price: z.number(),
    timestamp: z.number(),
  }),
});

export const socialUpdateSchema = z.object({
  type: z.literal('social_update'),
  data: z.object({
    platform: z.string(),
    content: z.string(),
    timestamp: z.number(),
  }),
});

// Main SSE event schema
export const sseEventSchema = z.discriminatedUnion('type', [
  priceUpdateSchema,
  socialUpdateSchema,
]);

// Type exports
export type SSEEvent = z.infer<typeof sseEventSchema>;
export type SSEEventType = SSEEvent['type']; 