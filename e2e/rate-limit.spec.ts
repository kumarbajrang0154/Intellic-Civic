import { test, expect } from '@playwright/test';
import {
  checkRateLimit,
  resolveRateLimitKey,
  rateLimitErrorResponse,
  RATE_LIMIT_PRESETS,
  checkSendOtpRateLimit,
  checkPostgresLimit,
  SEND_OTP_PHONE_LIMIT,
  SEND_OTP_IP_LIMIT,
} from '../src/lib/rate-limit';
import prisma from '../src/lib/prisma';

test.describe('Rate Limiter Unit & Integration Test Suite', () => {
  test('1. resolveRateLimitKey correctly distinguishes user keys and IP addresses', () => {
    const dummyReq = new Request('http://localhost:3000/api/test', {
      headers: { 'x-forwarded-for': '203.0.113.19, 10.0.0.1' },
    });

    const userKey = resolveRateLimitKey(dummyReq, 'complaintCreate', 'user_123');
    expect(userKey).toBe('complaintCreate:user:user_123');

    const ipKey = resolveRateLimitKey(dummyReq, 'auth');
    expect(ipKey).toBe('auth:ip:203.0.113.19');
  });

  test('2. Normal requests within limit are allowed and decrease remaining count', async () => {
    const testKey = `test_normal_${Date.now()}`;
    const dummyReq = new Request('http://localhost:3000/api/test');

    const first = await checkRateLimit(dummyReq, 'general', testKey);
    expect(first.success).toBe(true);
    expect(first.remaining).toBe(RATE_LIMIT_PRESETS.general.requests - 1);
    expect(first.retryAfterSeconds).toBe(0);

    const second = await checkRateLimit(dummyReq, 'general', testKey);
    expect(second.success).toBe(true);
    expect(second.remaining).toBe(RATE_LIMIT_PRESETS.general.requests - 2);
  });

  test('3. Exceeding preset limit returns success: false with 429 and Retry-After header', async () => {
    const testKey = `test_exhaust_${Date.now()}`;
    const dummyReq = new Request('http://localhost:3000/api/test');
    const limit = RATE_LIMIT_PRESETS.auth.requests; // 5

    // Send exactly 5 requests (all should succeed)
    for (let i = 0; i < limit; i++) {
      const res = await checkRateLimit(dummyReq, 'auth', testKey);
      expect(res.success).toBe(true);
    }

    // 6th request should fail
    const blocked = await checkRateLimit(dummyReq, 'auth', testKey);
    expect(blocked.success).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);

    // Convert to response
    const httpRes = rateLimitErrorResponse(blocked);
    expect(httpRes.status).toBe(429);
    expect(httpRes.headers.get('Retry-After')).toBeTruthy();

    const body = await httpRes.json();
    expect(body.statusCode).toBe(429);
    expect(body.error).toBe('Too Many Requests');
    expect(body.message).toContain('Rate limit exceeded');
  });

  test('4. Rate limits are isolated per key (exhausting key A does not affect key B)', async () => {
    const keyA = `key_isolated_a_${Date.now()}`;
    const keyB = `key_isolated_b_${Date.now()}`;
    const dummyReq = new Request('http://localhost:3000/api/test');
    const limit = RATE_LIMIT_PRESETS.auth.requests;

    // Exhaust key A
    for (let i = 0; i <= limit; i++) {
      await checkRateLimit(dummyReq, 'auth', keyA);
    }

    const blockedA = await checkRateLimit(dummyReq, 'auth', keyA);
    expect(blockedA.success).toBe(false);

    // Key B must be completely unaffected
    const freshB = await checkRateLimit(dummyReq, 'auth', keyB);
    expect(freshB.success).toBe(true);
    expect(freshB.remaining).toBe(limit - 1);
  });

  test('5. Production auth without Upstash uses Postgres limiter and does not fail closed when Postgres is healthy', async () => {
    const originalEnv = process.env.NODE_ENV;
    const originalUrl = process.env.UPSTASH_REDIS_REST_URL;
    const originalToken = process.env.UPSTASH_REDIS_REST_TOKEN;

    try {
      // Simulate production with missing Redis credentials
      (process.env as any).NODE_ENV = 'production';
      delete process.env.UPSTASH_REDIS_REST_URL;
      delete process.env.UPSTASH_REDIS_REST_TOKEN;

      const testKey = `prod_pg_auth_${Date.now()}`;
      const dummyReq = new Request('http://localhost:3000/api/auth/staff-login');
      const authResult = await checkRateLimit(dummyReq, 'auth', testKey);

      // In production without Upstash, healthy Postgres limiter handles requests without failing closed
      expect(authResult.success).toBe(true);
      expect(authResult.source).toBe('postgres');
      expect(authResult.remaining).toBe(RATE_LIMIT_PRESETS.auth.requests - 1);
    } finally {
      (process.env as any).NODE_ENV = originalEnv;
      if (originalUrl) process.env.UPSTASH_REDIS_REST_URL = originalUrl;
      if (originalToken) process.env.UPSTASH_REDIS_REST_TOKEN = originalToken;
    }
  });

  test('5b. Production auth fails closed (503) when the Postgres limiter throws', async () => {
    const originalEnv = process.env.NODE_ENV;
    const originalUrl = process.env.UPSTASH_REDIS_REST_URL;
    const originalToken = process.env.UPSTASH_REDIS_REST_TOKEN;
    const originalQueryRaw = prisma.$queryRaw;

    try {
      // Simulate production with missing Redis credentials and broken Postgres
      (process.env as any).NODE_ENV = 'production';
      delete process.env.UPSTASH_REDIS_REST_URL;
      delete process.env.UPSTASH_REDIS_REST_TOKEN;

      // Inject failing Prisma client
      (prisma as any).$queryRaw = async () => {
        throw new Error('Simulated database network failure in rate limiter');
      };

      const dummyReq = new Request('http://localhost:3000/api/auth/staff-login');
      const authResult = await checkRateLimit(dummyReq, 'auth', `prod_failing_pg_${Date.now()}`);

      // Auth routes MUST fail closed for security when Postgres limiter throws
      expect(authResult.success).toBe(false);
      expect(authResult.failedClosed).toBe(true);
      expect(authResult.source).toBe('postgres');

      const res = rateLimitErrorResponse(authResult);
      expect(res.status).toBe(503);
      const body = await res.json();
      expect(body.statusCode).toBe(503);
      expect(body.error).toBe('Service Unavailable');
    } finally {
      (prisma as any).$queryRaw = originalQueryRaw;
      (process.env as any).NODE_ENV = originalEnv;
      if (originalUrl) process.env.UPSTASH_REDIS_REST_URL = originalUrl;
      if (originalToken) process.env.UPSTASH_REDIS_REST_TOKEN = originalToken;
    }
  });

  test('6. HTTP endpoint verification: /api/auth/send-otp enforces security posture', async ({ request }) => {
    const randomIp = `198.51.100.${Math.floor(Math.random() * 200) + 10}`;

    const res = await request.post('/api/auth/send-otp', {
      headers: {
        'x-forwarded-for': randomIp,
      },
      data: {
        mobileNumber: '9876543210',
      },
    });

    // In production without Upstash credentials configured, auth routes fail closed with 503 for defense in depth.
    // In development or when Upstash Redis is active, requests succeed with 200 or hit 429 when the limit is exceeded.
    expect([200, 429, 503]).toContain(res.status());

    if (res.status() === 503) {
      const body = await res.json();
      expect(body.statusCode).toBe(503);
      expect(body.error).toBe('Service Unavailable');
    } else if (res.status() === 429) {
      const body = await res.json();
      expect(body.statusCode).toBe(429);
      expect(res.headers()['retry-after']).toBeTruthy();
    }
  });

  test('7. Per-phone limit blocks the 4th send-otp for the same number even from different IPs', async () => {
    const uniquePhone = `98${Date.now().toString().slice(-8)}`;
    // 3 requests from different IPs
    for (let i = 1; i <= 3; i++) {
      const req = new Request('http://localhost:3000/api/auth/send-otp', {
        headers: { 'x-forwarded-for': `198.51.100.${i + 30}` },
      });
      const res = await checkSendOtpRateLimit(req, uniquePhone);
      expect(res.success).toBe(true);
    }

    // 4th request from a completely different IP for the same phone must be blocked (SEND_OTP_PHONE_LIMIT = 3)
    const req4 = new Request('http://localhost:3000/api/auth/send-otp', {
      headers: { 'x-forwarded-for': '198.51.100.99' },
    });
    const blockedRes = await checkSendOtpRateLimit(req4, uniquePhone);
    expect(blockedRes.success).toBe(false);
    expect(blockedRes.remaining).toBe(0);
    expect(blockedRes.retryAfterSeconds).toBeGreaterThan(0);
  });

  test('8. Per-IP limit blocks after the threshold regardless of phone number', async () => {
    const testIp = `192.0.2.${Math.floor(Math.random() * 200) + 10}`;
    const limit = SEND_OTP_IP_LIMIT; // 10

    // Send 10 requests from the same IP with distinct phone numbers
    for (let i = 1; i <= limit; i++) {
      const distinctPhone = `91${String(i).padStart(8, '0')}`;
      const req = new Request('http://localhost:3000/api/auth/send-otp', {
        headers: { 'x-forwarded-for': testIp },
      });
      const res = await checkSendOtpRateLimit(req, distinctPhone);
      expect(res.success).toBe(true);
    }

    // 11th request from same IP with another new phone number must be blocked by IP limit
    const req11 = new Request('http://localhost:3000/api/auth/send-otp', {
      headers: { 'x-forwarded-for': testIp },
    });
    const blockedRes = await checkSendOtpRateLimit(req11, '9199999999');
    expect(blockedRes.success).toBe(false);
    expect(blockedRes.remaining).toBe(0);
  });

  test('9. Postgres limiter: counts persist across two separate Prisma client calls', async () => {
    const key = `pg_persist_test_${Date.now()}`;
    const config = { requests: 5, windowSec: 60, description: '5 per 60s' };

    // First call inserts/increments count to 1
    const res1 = await checkPostgresLimit(key, config);
    expect(res1.success).toBe(true);
    expect(res1.remaining).toBe(4);

    // Verify row in database via separate Prisma query
    const dbRow1 = await prisma.rateLimitBucket.findUnique({ where: { key } });
    expect(dbRow1).not.toBeNull();
    expect(dbRow1?.count).toBe(1);

    // Second call increments count to 2
    const res2 = await checkPostgresLimit(key, config);
    expect(res2.success).toBe(true);
    expect(res2.remaining).toBe(3);

    // Verify persisted count in database
    const dbRow2 = await prisma.rateLimitBucket.findUnique({ where: { key } });
    expect(dbRow2?.count).toBe(2);
  });

  test('10. Limit resets after the window using an injectable clock', async () => {
    const key = `clock_reset_test_${Date.now()}`;
    const config = { requests: 2, windowSec: 600, description: '2 per 10m' };
    let currentTime = new Date('2026-10-14T12:00:00.000Z');
    const clock = () => currentTime;

    // Call 1 at T=0
    const res1 = await checkPostgresLimit(key, config, clock);
    expect(res1.success).toBe(true);
    expect(res1.remaining).toBe(1);

    // Call 2 at T=0 (hits limit)
    const res2 = await checkPostgresLimit(key, config, clock);
    expect(res2.success).toBe(true);
    expect(res2.remaining).toBe(0);

    // Call 3 at T=0 (blocked)
    const res3 = await checkPostgresLimit(key, config, clock);
    expect(res3.success).toBe(false);

    // Advance clock past 10-minute window (T = +601 seconds)
    currentTime = new Date(currentTime.getTime() + 601 * 1000);

    // Call 4 at T=+601s (window has reset, request must succeed)
    const res4 = await checkPostgresLimit(key, config, clock);
    expect(res4.success).toBe(true);
    expect(res4.remaining).toBe(1);
  });

  test('11. Production mode with no Upstash uses the Postgres limiter', async () => {
    const originalEnv = process.env.NODE_ENV;
    const originalUrl = process.env.UPSTASH_REDIS_REST_URL;
    const originalToken = process.env.UPSTASH_REDIS_REST_TOKEN;

    try {
      (process.env as any).NODE_ENV = 'production';
      delete process.env.UPSTASH_REDIS_REST_URL;
      delete process.env.UPSTASH_REDIS_REST_TOKEN;

      const testKey = `prod_pg_test_${Date.now()}`;
      const dummyReq = new Request('http://localhost:3000/api/auth/staff-login');

      // In production with Upstash absent, Postgres limiter is used (does not fail closed)
      const result = await checkRateLimit(dummyReq, 'auth', testKey);
      expect(result.success).toBe(true);
      expect(result.failedClosed).toBe(false);

      // Verify row was written to Postgres rate_limit_buckets table
      const bucket = await prisma.rateLimitBucket.findUnique({
        where: { key: `auth:user:${testKey}` },
      });
      expect(bucket).not.toBeNull();
      expect(bucket?.count).toBeGreaterThanOrEqual(1);
    } finally {
      (process.env as any).NODE_ENV = originalEnv;
      if (originalUrl) process.env.UPSTASH_REDIS_REST_URL = originalUrl;
      if (originalToken) process.env.UPSTASH_REDIS_REST_TOKEN = originalToken;
    }
  });
});
