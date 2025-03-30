import {
  type RateLimitInfo,
  type RateLimitConfig,
  RATE_LIMITS,
  MAX_ENTRIES,
  CLEANUP_INTERVAL,
  INACTIVE_THRESHOLD,
  SUSPICIOUS_UA_PATTERNS,
} from './rate-limit-config';

// Global limits with dynamic adjustment
export const globalLimits = {
  lastMinute: new Map<number, number>(),
  lastHour: new Map<number, number>(),
  maxPerMinute: 6000,
  maxPerHour: 100000,
  adjustmentFactor: 0.8, // Reduce limits by 20% when under attack
  isUnderAttack: false,
  attackThreshold: 0.9, // 90% of max limit triggers attack mode
};

export const rateLimits = new Map<string, RateLimitInfo>();

// Export MAX_ENTRIES for use in rate-limit.ts
export { MAX_ENTRIES };

// Clean up old global limit entries
setInterval(() => {
  const now = Date.now();
  const currentMinute = Math.floor(now / 60000);
  const currentHour = Math.floor(now / 3600000);

  // Clean up minute counters older than 2 minutes
  for (const [minute] of globalLimits.lastMinute) {
    if (minute < currentMinute - 1) {
      globalLimits.lastMinute.delete(minute);
    }
  }

  // Clean up hour counters older than 2 hours
  for (const [hour] of globalLimits.lastHour) {
    if (hour < currentHour - 1) {
      globalLimits.lastHour.delete(hour);
    }
  }

  // Check if we're under attack
  const minuteCount = globalLimits.lastMinute.get(currentMinute) || 0;
  const hourCount = globalLimits.lastHour.get(currentHour) || 0;

  const minuteLoad = minuteCount / globalLimits.maxPerMinute;
  const hourLoad = hourCount / globalLimits.maxPerHour;

  globalLimits.isUnderAttack =
    minuteLoad > globalLimits.attackThreshold || hourLoad > globalLimits.attackThreshold;
}, 60000);

// Clean up old entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, info] of rateLimits.entries()) {
    if (now - info.lastUsed > INACTIVE_THRESHOLD) {
      rateLimits.delete(key);
    }
  }
}, CLEANUP_INTERVAL);

export function isUserAgentSuspicious(userAgent: string): boolean {
  return SUSPICIOUS_UA_PATTERNS.some((pattern) => pattern.test(userAgent));
}

export function generateKey(ip: string, path: string, userAgent: string): string {
  return `${ip}:${path}:${userAgent}`;
}

export function getRateLimitConfig(path: string): RateLimitConfig {
  // Find matching route pattern
  const matchingPattern = Object.keys(RATE_LIMITS).find((pattern) => {
    if (pattern === 'default') return false;
    return new RegExp(pattern).test(path);
  });

  return RATE_LIMITS[matchingPattern || 'default'];
}
