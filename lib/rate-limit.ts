'use server';

interface RateLimitInfo {
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
interface RateLimitConfig {
  limit: number;
  window: number;
  blockDuration: number;
  maxConsecutiveFailures: number;
}

const RATE_LIMITS: Record<string, RateLimitConfig> = {
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
  'default': {
    limit: 30,
    window: 60000,
    blockDuration: 1800000,
    maxConsecutiveFailures: 10,
  },
};

const MAX_ENTRIES = 10000;
const CLEANUP_INTERVAL = 3600000; // 1 hour
const INACTIVE_THRESHOLD = 86400000; // 24 hours

// Suspicious patterns in user agents
const SUSPICIOUS_UA_PATTERNS = [
  /curl/i,
  /python-requests/i,
  /postman/i,
  /insomnia/i,
  /axios/i,
  /node-fetch/i,
  /wget/i,
  /go-http-client/i,
  /^$/  // Empty user agent
];

// Global limits with dynamic adjustment
const globalLimits = {
  lastMinute: new Map<number, number>(),
  lastHour: new Map<number, number>(),
  maxPerMinute: 6000,
  maxPerHour: 100000,
  adjustmentFactor: 0.8, // Reduce limits by 20% when under attack
  isUnderAttack: false,
  attackThreshold: 0.9, // 90% of max limit triggers attack mode
};

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

  globalLimits.isUnderAttack = minuteLoad > globalLimits.attackThreshold || 
                               hourLoad > globalLimits.attackThreshold;
}, 60000);

const rateLimits = new Map<string, RateLimitInfo>();

// Clean up old entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, info] of rateLimits.entries()) {
    if (now - info.lastUsed > INACTIVE_THRESHOLD) {
      rateLimits.delete(key);
    }
  }
}, CLEANUP_INTERVAL);

function isUserAgentSuspicious(userAgent: string): boolean {
  return SUSPICIOUS_UA_PATTERNS.some(pattern => pattern.test(userAgent));
}

function generateKey(ip: string, path: string, userAgent: string): string {
  return `${ip}:${path}:${userAgent}`;
}

function getRateLimitConfig(path: string): RateLimitConfig {
  // Find matching route pattern
  const matchingPattern = Object.keys(RATE_LIMITS).find(pattern => {
    if (pattern === 'default') return false;
    return new RegExp(pattern).test(path);
  });

  return RATE_LIMITS[matchingPattern || 'default'];
}

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
      resetAt: info.blockedUntil 
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
  const adjustedLimit = isUserAgentSuspicious(userAgent) ? Math.floor(config.limit / 2) : config.limit;
  
  // Update last used time
  info.lastUsed = now;
  
  // Check if under limit
  if (info.count < adjustedLimit) {
    info.count++;
    
    // Ensure Map doesn't grow too large
    if (rateLimits.size >= MAX_ENTRIES) {
      // Remove oldest entries based on lastUsed
      const entries = Array.from(rateLimits.entries())
        .sort((a, b) => a[1].lastUsed - b[1].lastUsed);
      
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
      resetAt: info.resetAt
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
    resetAt: info.resetAt
  };
}

// Export types for middleware
export type { RateLimitInfo, RateLimitConfig };

// Usage example:
// const { success, remaining, resetAt } = await rateLimit('user_123', 10, 60000);
// if (!success) throw new Error('Rate limit exceeded'); 