import { z } from 'zod';

export const SUBSCRIPTION_TIERS = {
  BASIC: {
    name: 'Basic',
    price: 14.99,
    costPerUser: 0.342,
    grossMargin: 14.65,
  },
  PRO: {
    name: 'Pro',
    price: 24.99,
    costPerUser: 1.14,
    grossMargin: 23.85,
  }
} as const;

const subscriptionConfigSchema = z.object({
  stripe: z.object({
    secretKey: z.string().min(1),
    products: z.object({
      basic: z.string().min(1),
      pro: z.string().min(1),
    }),
    webhookSecret: z.string().min(1),
  }),
});

function loadConfig() {
  const config = {
    stripe: {
      secretKey: process.env.STRIPE_SECRET_KEY!,
      products: {
        basic: process.env.STRIPE_BASIC_PRODUCT_ID!,
        pro: process.env.STRIPE_PRO_PRODUCT_ID!,
      },
      webhookSecret: process.env.STRIPE_WEBHOOK_SECRET!,
    },
  };

  return subscriptionConfigSchema.parse(config);
}

export type SubscriptionConfig = z.infer<typeof subscriptionConfigSchema>;
export const subscriptionConfig = loadConfig();
export type SubscriptionTier = keyof typeof SUBSCRIPTION_TIERS; 