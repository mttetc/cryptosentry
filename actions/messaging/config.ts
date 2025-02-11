export const SETTINGS = {
  CALL: {
    LIMITS: {
      DAILY: 30,
      CONCURRENT: 5,
      PER_MINUTE: 10,
    },
    DURATION: {
      MAX: 6, // Maximum 6 seconds
      MIN: 2, // Minimum duration to ensure message is heard
    },
    COOLDOWN: {
      DURATION: 60, // 60 seconds between calls
      CHECK_INTERVAL: 1000, // Check cooldown every second
    },
    SPEECH: {
      RATE: 1.3,
      VOICE: 'neural' as const,
      WORDS_PER_SECOND: 2.5,
      MAX_WORDS: Math.floor(2.5 * 1.3 * 6), // Based on duration and rate
      OPTIMIZATION: {
        REMOVE_PATTERNS: [
          /please|kindly|would you|could you/gi,
          /notification|alert|message/gi,
          /your|the|a|an/gi,
        ],
      },
    },
    TIMEOUTS: {
      ANSWER: 12,
      MACHINE: 3,
      DTMF: 2,
    },
  },
  SMS: {
    LIMITS: {
      DAILY: 50,
      PER_MINUTE: 20,
    },
    COOLDOWN: {
      DURATION: 30, // 30 seconds between SMS
      CHECK_INTERVAL: 1000,
    },
    MESSAGE: {
      MAX_LENGTH: 160,
      UNICODE_SUPPORT: true,
    },
  },
  ERROR_HANDLING: {
    AUTO_RETRY_CODES: [408, 500, 502, 503, 504],
    MAX_RETRIES: 2,
    BACKOFF: {
      INITIAL_DELAY: 60000, // 1 minute
      MULTIPLIER: 2,
      MAX_DELAY: 300000, // 5 minutes
    },
  },
  DID_ROTATION: {
    STRATEGY: 'round-robin' as const,
    BACKUP_NUMBER: process.env.BULKVS_FROM_NUMBER!,
    MAX_CONSECUTIVE_USES: 10,
  },
} as const; 