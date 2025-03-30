'use server';

import {
  globalLimits,
  rateLimits,
  isUserAgentSuspicious,
  generateKey,
  getRateLimitConfig,
  MAX_ENTRIES,
} from './rate-limit-store';

export async function rateLimit(
  ip: string,
  path: string,
  userAgent: string = 'unknown',
  ipCountry?: string
): Promise<{ success: boolean; remaining: number; resetAt: number }> {
  const now = Date.now();

  // Get rate limit config for this route
  const config = getRateLimitConfig(path);

  // Check global limits
  const currentMinute = Math.floor(now / 60000);
  const currentHour = Math.floor(now / 3600000);

  const minuteCount = (globalLimits.lastMinute.get(currentMinute) || 0) + 1;
  const hourCount = (globalLimits.lastHour.get(currentHour) || 0) + 1;

  // Adjust limits if under attack
  const adjustedMinuteLimit = globalLimits.isUnderAttack
    ? globalLimits.maxPerMinute * globalLimits.adjustmentFactor
    : globalLimits.maxPerMinute;

  const adjustedHourLimit = globalLimits.isUnderAttack
    ? globalLimits.maxPerHour * globalLimits.adjustmentFactor
    : globalLimits.maxPerHour;

  if (minuteCount > adjustedMinuteLimit || hourCount > adjustedHourLimit) {
    return { success: false, remaining: 0, resetAt: (currentMinute + 1) * 60000 };
  }

  globalLimits.lastMinute.set(currentMinute, minuteCount);
  globalLimits.lastHour.set(currentHour, hourCount);

  // Generate key based on IP, path and user agent
  const key = generateKey(ip, path, userAgent);

  // Get or create rate limit info
  let info = rateLimits.get(key);

  if (!info) {
    info = {
      count: 0,
      resetAt: now + config.window,
      lastUsed: now,
      userAgent,
      consecutiveFailures: 0,
      ipCountry,
      routePattern: path,
    };
  }

  // Check if blocked
  if (info.blockedUntil && now < info.blockedUntil) {
    return {
      success: false,
      remaining: 0,
      resetAt: info.blockedUntil,
    };
  }

  // Reset if window has passed
  if (now > info.resetAt) {
    info.count = 0;
    info.resetAt = now + config.window;
    info.consecutiveFailures = 0;
    info.blockedUntil = undefined;
  }

  // Apply stricter limits for suspicious user agents
  const adjustedLimit = isUserAgentSuspicious(userAgent)
    ? Math.floor(config.limit / 2)
    : config.limit;

  // Update last used time
  info.lastUsed = now;

  // Check if under limit
  if (info.count < adjustedLimit) {
    info.count++;

    // Ensure Map doesn't grow too large
    if (rateLimits.size >= MAX_ENTRIES) {
      // Remove oldest entries based on lastUsed
      const entries = Array.from(rateLimits.entries()).sort(
        (a, b) => a[1].lastUsed - b[1].lastUsed
      );

      // Remove oldest 10% of entries
      const entriesToRemove = Math.floor(MAX_ENTRIES * 0.1);
      for (let i = 0; i < entriesToRemove; i++) {
        rateLimits.delete(entries[i][0]);
      }
    }

    rateLimits.set(key, info);

    return {
      success: true,
      remaining: adjustedLimit - info.count,
      resetAt: info.resetAt,
    };
  }

  // Increment consecutive failures
  info.consecutiveFailures++;

  // Block if too many consecutive failures
  if (info.consecutiveFailures >= config.maxConsecutiveFailures) {
    info.blockedUntil = now + config.blockDuration;
  }

  rateLimits.set(key, info);

  return {
    success: false,
    remaining: 0,
    resetAt: info.resetAt,
  };
}

// Usage example:
// const { success, remaining, resetAt } = await rateLimit('user_123', 10, 60000);
// if (!success) throw new Error('Rate limit exceeded');
