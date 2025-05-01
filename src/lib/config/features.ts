export const FEATURES = {
  // Control whether the app is in waitlist mode or not
  isWaitlistMode: process.env.NEXT_PUBLIC_WAITLIST_MODE === 'true',
  // Control whether to bypass authentication in dev mode
  isDevMode: process.env.NODE_ENV === 'development',
} as const;
