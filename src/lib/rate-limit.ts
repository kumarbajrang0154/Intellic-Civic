import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { reportRateLimitFailOpen, captureException } from '@/lib/error-monitoring';

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

// ---------------------------------------------------------------------------
// OTP-Specific Rate Limit Named Constants (Configurable through code, not env)
// ---------------------------------------------------------------------------
export const SEND_OTP_PHONE_LIMIT = 3;
export const SEND_OTP_PHONE_WINDOW_SEC = 600; // 3 requests per 10 minutes per phone
export const SEND_OTP_IP_LIMIT = 10;
export const SEND_OTP_IP_WINDOW_SEC = 600;    // 10 requests per 10 minutes per IP
export const VERIFY_OTP_PHONE_LIMIT = 5;
export const VERIFY_OTP_PHONE_WINDOW_SEC = 600; // 5 verification attempts per 10 minutes per phone

export interface RateLimitResult {
  success: boolean;
  failedClosed?: boolean;
  limit: number;
  remaining: number;
  reset: number; // Unix timestamp in ms
  retryAfterSeconds: number;
  source?: 'memory' | 'postgres' | 'upstash';
}

// ---------------------------------------------------------------------------
// PII-Free HMAC Hashing for Phone Numbers in Rate Limit Keys
// ---------------------------------------------------------------------------
export function hashMobileNumber(mobile: string): string {
  const rawSecret = process.env.RATE_LIMIT_HMAC_SECRET;
  const isProduction =
    process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';

  if (!rawSecret) {
    if (isProduction) {
      const err = new Error('RATE_LIMIT_HMAC_SECRET is required in production for OTP rate limiting');
      captureException(err);
      throw err;
    }
  }

  const secret = rawSecret || 'intellicivic-dev-rate-limit-hmac-secret-2026';
  return crypto.createHmac('sha256', secret).update(mobile.trim()).digest('hex');
}

// ---------------------------------------------------------------------------
// In-Memory Fallback Store (for Local Development & Fast Testing)
// ---------------------------------------------------------------------------
interface InMemoryEntry {
  timestamps: number[];
}

const memoryStore: Map<string, InMemoryEntry> =
  (globalThis as any).__icRateLimitMemoryStore || new Map<string, InMemoryEntry>();
(globalThis as any).__icRateLimitMemoryStore = memoryStore;

export function checkInMemoryLimit(
  key: string,
  config: PresetConfig,
  clock: () => Date = () => new Date(),
): RateLimitResult {
  const now = clock().getTime();
  const windowMs = config.windowSec * 1000;
  const cutoff = now - windowMs;

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
      source: 'memory',
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
    source: 'memory',
  };
}

// ---------------------------------------------------------------------------
// Neon Postgres-Backed Atomic Rate Limiter (Production fallback when Upstash absent)
// ---------------------------------------------------------------------------
export async function checkPostgresLimit(
  key: string,
  config: PresetConfig,
  clock: () => Date = () => new Date(),
): Promise<RateLimitResult> {
  const now = clock();
  const cutoff = new Date(now.getTime() - config.windowSec * 1000);

  // Single-statement atomic upsert with window reset and increment via parameterized query
  const rows = await prisma.$queryRaw<Array<{ key: string; windowStart: Date; count: number; updatedAt: Date }>>`
    INSERT INTO "rate_limit_buckets" ("key", "windowStart", "count", "updatedAt")
    VALUES (${key}, ${now}, 1, ${now})
    ON CONFLICT ("key") DO UPDATE
    SET
      "count" = CASE
        WHEN "rate_limit_buckets"."windowStart" <= ${cutoff} THEN 1
        ELSE "rate_limit_buckets"."count" + 1
      END,
      "windowStart" = CASE
        WHEN "rate_limit_buckets"."windowStart" <= ${cutoff} THEN ${now}
        ELSE "rate_limit_buckets"."windowStart"
      END,
      "updatedAt" = ${now}
    RETURNING "key", "windowStart", "count", "updatedAt"
  `;

  if (!rows || rows.length === 0) {
    throw new Error(`Failed to upsert rate limit bucket for key "${key}"`);
  }

  const entry = rows[0];
  const count = Number(entry.count);
  const windowStartMs = new Date(entry.windowStart).getTime();
  const resetMs = windowStartMs + config.windowSec * 1000;
  const success = count <= config.requests;
  const remaining = Math.max(0, config.requests - count);
  const retryAfterSeconds = success ? 0 : Math.max(1, Math.ceil((resetMs - now.getTime()) / 1000));

  return {
    success,
    failedClosed: false,
    limit: config.requests,
    remaining,
    reset: resetMs,
    retryAfterSeconds,
    source: 'postgres',
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
  customConfig?: PresetConfig,
  clock?: () => Date,
): Promise<RateLimitResult> {
  const config = customConfig || RATE_LIMIT_PRESETS[preset];
  const key = resolveRateLimitKey(req, preset, userIdOrKey);
  const isProduction = process.env.NODE_ENV === 'production';
  const limiter = getRatelimiter(preset);

  // 1. Upstash configured -> use Upstash (unchanged)
  if (limiter) {
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
        source: 'upstash',
      };
    } catch (err: any) {
      console.error(`[RATE LIMIT ERROR] Upstash Redis call failed for key "${key}":`, err?.message || err);
      if (!isProduction) {
        return checkInMemoryLimit(key, config, clock);
      }
      // If Upstash fails in production, fall through to Postgres limiter below
    }
  }

  // 2. Upstash not configured AND NODE_ENV !== 'production' -> in-memory store
  if (!isProduction) {
    return checkInMemoryLimit(key, config, clock);
  }

  // 3. Upstash not configured AND production -> use Postgres limiter for all presets
  try {
    return await checkPostgresLimit(key, config, clock);
  } catch (dbErr: any) {
    console.error(`[RATE LIMIT POSTGRES ERROR] Postgres rate limit failed for key "${key}":`, dbErr?.message || dbErr);

    // 4. Postgres limiter itself errors:
    // Auth routes fail closed (503 with Retry-After)
    if (preset === 'auth') {
      captureException(dbErr);
      return {
        success: false,
        failedClosed: true,
        limit: config.requests,
        remaining: 0,
        reset: Date.now() + config.windowSec * 1000,
        retryAfterSeconds: config.windowSec,
        source: 'postgres',
      };
    }

    // Other non-auth routes fail open with Sentry warning
    reportRateLimitFailOpen(preset, `Postgres rate limiter error: ${dbErr?.message || 'unknown error'}`);
    return {
      success: true,
      failedClosed: false,
      limit: config.requests,
      remaining: 1,
      reset: Date.now() + config.windowSec * 1000,
      retryAfterSeconds: 0,
      source: 'postgres',
    };
  }
}

// ---------------------------------------------------------------------------
// OTP-Specific Route Helpers
// ---------------------------------------------------------------------------
export async function checkSendOtpRateLimit(
  req: Request | NextRequest,
  mobileNumber?: string,
  clock?: () => Date,
): Promise<RateLimitResult> {
  const ip = getClientIp(req);
  const ipConfig: PresetConfig = {
    requests: SEND_OTP_IP_LIMIT,
    windowSec: SEND_OTP_IP_WINDOW_SEC,
    description: '10 requests per 10 minutes per IP',
  };

  // 1. Enforce per-IP limit
  const ipResult = await checkRateLimit(req, 'auth', `otp:send:ip:${ip}`, ipConfig, clock);
  if (!ipResult.success) {
    return ipResult;
  }

  // 2. Enforce per-phone limit if mobileNumber is present
  if (mobileNumber) {
    const phoneHash = hashMobileNumber(mobileNumber);
    const phoneConfig: PresetConfig = {
      requests: SEND_OTP_PHONE_LIMIT,
      windowSec: SEND_OTP_PHONE_WINDOW_SEC,
      description: '3 requests per 10 minutes per phone number',
    };
    const phoneResult = await checkRateLimit(req, 'auth', `otp:send:phone:${phoneHash}`, phoneConfig, clock);
    if (!phoneResult.success) {
      return phoneResult;
    }
  }

  return ipResult;
}

export async function checkVerifyOtpRateLimit(
  req: Request | NextRequest,
  mobileNumber?: string,
  clock?: () => Date,
): Promise<RateLimitResult> {
  // 1. Enforce general auth IP rate limit
  const ipResult = await checkRateLimit(req, 'auth', undefined, undefined, clock);
  if (!ipResult.success) {
    return ipResult;
  }

  // 2. Enforce per-phone verification attempts limit if mobileNumber is present
  if (mobileNumber) {
    const phoneHash = hashMobileNumber(mobileNumber);
    const phoneConfig: PresetConfig = {
      requests: VERIFY_OTP_PHONE_LIMIT,
      windowSec: VERIFY_OTP_PHONE_WINDOW_SEC,
      description: '5 verification attempts per 10 minutes per phone number',
    };
    const phoneResult = await checkRateLimit(req, 'auth', `otp:verify:phone:${phoneHash}`, phoneConfig, clock);
    if (!phoneResult.success) {
      return phoneResult;
    }
  }

  return ipResult;
}
