import { z } from 'zod';

export const SETTINGS = {
  CALL: {
    TIMEOUTS: {
      ANSWER: 12,
    },
    SPEECH: {
      RATE: 1.3,
      VOICE: 'female', // Default Telnyx TTS voice
    },
    LIMITS: {
      DAILY: 50,
      HOURLY: 10,
      PER_MINUTE: 2,
    },
    COOLDOWN: {
      DURATION: 30000, // 30 seconds in milliseconds
    }
  },
  SMS: {
    MESSAGE: {
      MAX_LENGTH: 160,
    },
    LIMITS: {
      DAILY: 100,
      HOURLY: 20,
      PER_MINUTE: 5,
    },
    COOLDOWN: {
      DURATION: 15000, // 15 seconds in milliseconds
    }
  }
};

const messagingConfigSchema = z.object({
  telnyx: z.object({
    apiKey: z.string().min(1),
    publicKey: z.string().min(1),
    voiceNumber: z.string().regex(/^\+[1-9]\d{1,14}$/),
    senderId: z.string().min(1),
    messagingProfileId: z.string().min(1),
    webhookUrl: z.string().url(),
  }),
});

function loadConfig() {
  const config = {
    telnyx: {
      apiKey: process.env.TELNYX_API_KEY!,
      publicKey: process.env.TELNYX_PUBLIC_KEY!,
      voiceNumber: process.env.TELNYX_VOICE_NUMBER!,
      senderId: process.env.TELNYX_SENDER_ID!,
      messagingProfileId: process.env.TELNYX_MESSAGING_PROFILE_ID!,
      webhookUrl: process.env.TELNYX_WEBHOOK_URL!,
    },
  };

  return messagingConfigSchema.parse(config);
}

export type MessagingConfig = z.infer<typeof messagingConfigSchema>;
export const messagingConfig = loadConfig(); 