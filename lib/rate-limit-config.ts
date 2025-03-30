export interface RateLimitInfo {
  count: number;
  resetAt: number;
  lastUsed: number;
  userAgent: string;
  consecutiveFailures: number;
  blockedUntil?: number;
  ipCountry?: string;
  routePattern?: string;
}

// Rate limit configuration by route pattern
export interface RateLimitConfig {
  limit: number;
  window: number;
  blockDuration: number;
  maxConsecutiveFailures: number;
}

export const RATE_LIMITS: Record<string, RateLimitConfig> = {
  // Authentication routes
  '^/auth/.*': {
    limit: 10,
    window: 60000, // 1 minute
    blockDuration: 3600000, // 1 hour
    maxConsecutiveFailures: 5,
  },
  // API routes
  '^/api/webhooks/.*': {
    limit: 100,
    window: 60000,
    blockDuration: 1800000, // 30 minutes
    maxConsecutiveFailures: 10,
  },
  // Dashboard routes
  '^/dashboard/.*': {
    limit: 60,
    window: 60000,
    blockDuration: 900000, // 15 minutes
    maxConsecutiveFailures: 20,
  },
  // Default rate limit
  default: {
    limit: 30,
    window: 60000,
    blockDuration: 1800000,
    maxConsecutiveFailures: 10,
  },
};

export const MAX_ENTRIES = 10000;
export const CLEANUP_INTERVAL = 3600000; // 1 hour
export const INACTIVE_THRESHOLD = 86400000; // 24 hours

// Suspicious patterns in user agents
export const SUSPICIOUS_UA_PATTERNS = [
  /curl/i,
  /python-requests/i,
  /postman/i,
  /insomnia/i,
  /axios/i,
  /node-fetch/i,
  /wget/i,
  /go-http-client/i,
  /^$/, // Empty user agent
];
