import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { NextRequest, NextResponse } from 'next/server';
import { reportRateLimitFailOpen } from '@/lib/error-monitoring';

export type RateLimitPreset =
  | 'auth'            // Strict: OTP send, OTP verify, staff-login, dev-login
  | 'complaintCreate' // Complaint creation
  | 'ai'              // Voice parsing, AI health diagnostics
  | 'upload'          // Cloudinary signature, evidence upload
  | 'general';        // General endpoints

export interface PresetConfig {
  requests: number;
  windowSec: number;
  description: string;
}

export const RATE_LIMIT_PRESETS: Record<RateLimitPreset, PresetConfig> = {
  auth: { requests: 10, windowSec: 60, description: '10 requests per 60s' },
  complaintCreate: { requests: 10, windowSec: 60, description: '10 requests per 60s' },
  ai: { requests: 20, windowSec: 60, description: '20 requests per 60s' },
  upload: { requests: 20, windowSec: 60, description: '20 requests per 60s' },
  general: { requests: 60, windowSec: 60, description: '60 requests per 60s' },
};

export interface RateLimitResult {
  success: boolean;
  failedClosed?: boolean;
  limit: number;
  remaining: number;
  reset: number; // Unix timestamp in ms
  retryAfterSeconds: number;
}

// ---------------------------------------------------------------------------
// In-Memory Fallback Store (for Local Development & Testing)
// ---------------------------------------------------------------------------
interface InMemoryEntry {
  timestamps: number[];
}

const memoryStore: Map<string, InMemoryEntry> =
  (globalThis as any).__icRateLimitMemoryStore || new Map<string, InMemoryEntry>();
(globalThis as any).__icRateLimitMemoryStore = memoryStore;

function checkInMemoryLimit(key: string, config: PresetConfig): RateLimitResult {
  const now = Date.now();
  const windowMs = config.windowSec * 1000;
  const cutoff = now - windowMs;

  // Prune old timestamps
  let entry = memoryStore.get(key);
  if (!entry) {
    entry = { timestamps: [] };
    memoryStore.set(key, entry);
  }

  entry.timestamps = entry.timestamps.filter((ts) => ts > cutoff);

  if (entry.timestamps.length >= config.requests) {
    const oldest = entry.timestamps[0];
    const retryAfterSeconds = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
    return {
      success: false,
      failedClosed: false,
      limit: config.requests,
      remaining: 0,
      reset: oldest + windowMs,
      retryAfterSeconds,
    };
  }

  entry.timestamps.push(now);
  const remaining = config.requests - entry.timestamps.length;
  return {
    success: true,
    failedClosed: false,
    limit: config.requests,
    remaining,
    reset: now + windowMs,
    retryAfterSeconds: 0,
  };
}

// ---------------------------------------------------------------------------
// Upstash Redis Client & Limiters Cache
// ---------------------------------------------------------------------------
let upstashRedisClient: Redis | null = null;
const upstashLimiters: Map<RateLimitPreset, Ratelimit> = new Map();

function getUpstashRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();

  if (!url || !token || url === 'your_upstash_redis_rest_url_here' || token === 'your_upstash_redis_rest_token_here') {
    return null;
  }

  if (!upstashRedisClient) {
    upstashRedisClient = new Redis({
      url,
      token,
    });
  }

  return upstashRedisClient;
}

function getRatelimiter(preset: RateLimitPreset): Ratelimit | null {
  const redis = getUpstashRedis();
  if (!redis) return null;

  let limiter = upstashLimiters.get(preset);
  if (!limiter) {
    const config = RATE_LIMIT_PRESETS[preset];
    limiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(config.requests, `${config.windowSec} s`),
      prefix: `intellicivic:rl:${preset}`,
      analytics: false,
    });
    upstashLimiters.set(preset, limiter);
  }

  return limiter;
}

// ---------------------------------------------------------------------------
// Helpers: Client IP Resolution & Response Construction
// ---------------------------------------------------------------------------
export function getClientIp(req: Request | NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  const realIp = req.headers.get('x-real-ip');
  if (realIp) {
    return realIp.trim();
  }
  return '127.0.0.1';
}

export function resolveRateLimitKey(
  req: Request | NextRequest,
  preset: RateLimitPreset,
  userIdOrKey?: string,
): string {
  if (userIdOrKey && userIdOrKey.trim()) {
    return `${preset}:user:${userIdOrKey.trim()}`;
  }
  const ip = getClientIp(req);
  return `${preset}:ip:${ip}`;
}

export function rateLimitErrorResponse(result: RateLimitResult): NextResponse {
  if (result.failedClosed) {
    return NextResponse.json(
      {
        statusCode: 503,
        error: 'Service Unavailable',
        message: 'Rate limiting is currently unavailable. Authentication is temporarily locked for security.',
      },
      {
        status: 503,
        headers: {
          'Retry-After': '60',
          'Content-Type': 'application/json',
        },
      },
    );
  }

  return NextResponse.json(
    {
      statusCode: 429,
      error: 'Too Many Requests',
      message: 'Rate limit exceeded. Please try again later.',
    },
    {
      status: 429,
      headers: {
        'Retry-After': '60',
        'Content-Type': 'application/json',
      },
    },
  );
}

// ---------------------------------------------------------------------------
// Main Rate Limit Enforcement Function
// ---------------------------------------------------------------------------
export async function checkRateLimit(
  req: Request | NextRequest,
  preset: RateLimitPreset,
  userIdOrKey?: string,
): Promise<RateLimitResult> {
  const config = RATE_LIMIT_PRESETS[preset];
  const key = resolveRateLimitKey(req, preset, userIdOrKey);
  const isProduction = process.env.NODE_ENV === 'production';
  const limiter = getRatelimiter(preset);

  // If Redis credentials are NOT configured:
  if (!limiter) {
    if (!isProduction) {
      // In development / non-production: fall back to in-memory with a console warning
      console.warn(
        `[RATE LIMIT DEV WARNING] Upstash Redis credentials not configured. Falling back to in-memory limiter for preset "${preset}" (${key}).`,
      );
      return checkInMemoryLimit(key, config);
    }

    // In production:
    // Auth/OTP routes MUST fail closed for security against credential stuffing / brute force.
    if (preset === 'auth') {
      console.error(
        `[RATE LIMIT FAIL-CLOSED] Upstash Redis missing in production! Rejecting auth request for key "${key}" to preserve defense-in-depth.`,
      );
      return {
        success: false,
        failedClosed: true,
        limit: config.requests,
        remaining: 0,
        reset: Date.now() + config.windowSec * 1000,
        retryAfterSeconds: config.windowSec,
      };
    }

    // Other non-auth routes fail open with a logged warning and Sentry telemetry
    reportRateLimitFailOpen(preset, 'Upstash Redis credentials missing in production environment');
    return {
      success: true,
      failedClosed: false,
      limit: config.requests,
      remaining: 1,
      reset: Date.now() + config.windowSec * 1000,
      retryAfterSeconds: 0,
    };
  }

  // If Redis IS configured, query Upstash Redis:
  try {
    const upstashResult = await limiter.limit(key);
    const retryAfterSeconds = upstashResult.reset
      ? Math.max(1, Math.ceil((upstashResult.reset - Date.now()) / 1000))
      : 60;

    return {
      success: upstashResult.success,
      failedClosed: false,
      limit: upstashResult.limit,
      remaining: upstashResult.remaining,
      reset: upstashResult.reset,
      retryAfterSeconds: upstashResult.success ? 0 : retryAfterSeconds,
    };
  } catch (err: any) {
    console.error(`[RATE LIMIT ERROR] Upstash Redis call failed for key "${key}":`, err?.message || err);

    if (!isProduction) {
      console.warn(`[RATE LIMIT DEV FALLBACK] Upstash query failed, falling back to in-memory limiter.`);
      return checkInMemoryLimit(key, config);
    }

    // In production on network/Redis error:
    if (preset === 'auth') {
      console.error(`[RATE LIMIT FAIL-CLOSED] Redis call error in production on auth route. Failing closed.`);
      return {
        success: false,
        failedClosed: true,
        limit: config.requests,
        remaining: 0,
        reset: Date.now() + config.windowSec * 1000,
        retryAfterSeconds: config.windowSec,
      };
    }

    // Non-auth routes fail open
    reportRateLimitFailOpen(preset, `Upstash Redis call threw error: ${err?.message || 'unknown error'}`);
    return {
      success: true,
      failedClosed: false,
      limit: config.requests,
      remaining: 1,
      reset: Date.now() + config.windowSec * 1000,
      retryAfterSeconds: 0,
    };
  }
}
