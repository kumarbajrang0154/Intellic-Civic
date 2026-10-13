import { test, expect } from '@playwright/test';
import { checkRateLimit, resolveRateLimitKey, rateLimitErrorResponse, RATE_LIMIT_PRESETS } from '../src/lib/rate-limit';

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

  test('5. Production fail-closed behavior for auth routes when Redis is absent', async () => {
    const originalEnv = process.env.NODE_ENV;
    const originalUrl = process.env.UPSTASH_REDIS_REST_URL;
    const originalToken = process.env.UPSTASH_REDIS_REST_TOKEN;

    try {
      // Simulate production with missing Redis credentials
      (process.env as any).NODE_ENV = 'production';
      delete process.env.UPSTASH_REDIS_REST_URL;
      delete process.env.UPSTASH_REDIS_REST_TOKEN;

      const dummyReq = new Request('http://localhost:3000/api/auth/staff-login');
      const authResult = await checkRateLimit(dummyReq, 'auth', 'unconfigured_prod_test');

      // Auth routes MUST fail closed for security
      expect(authResult.success).toBe(false);
      expect(authResult.failedClosed).toBe(true);

      const res = rateLimitErrorResponse(authResult);
      expect(res.status).toBe(503);
      const body = await res.json();
      expect(body.statusCode).toBe(503);
      expect(body.error).toBe('Service Unavailable');

      // Non-auth routes in production fail open
      const generalResult = await checkRateLimit(dummyReq, 'general', 'unconfigured_prod_general');
      expect(generalResult.success).toBe(true);
      expect(generalResult.failedClosed).toBe(false);
    } finally {
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
});
