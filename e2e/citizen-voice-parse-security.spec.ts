import { test, expect } from '@playwright/test';
import { SignJWT } from 'jose';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'intellicivic-super-secret-jwt-key-2026');

async function createCitizenJwt(customSub?: string, customMobile?: string) {
  return new SignJWT({
    sub: customSub || 'citizen_9876543210',
    role: 'CITIZEN',
    name: 'Voice Tester Citizen',
    mobileNumber: customMobile || '9876543210',
    email: 'voicetester@example.com',
    isProfileComplete: true,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('2h')
    .sign(JWT_SECRET);
}

import prisma from '../src/lib/prisma';

async function createAdminJwt() {
  const admin = await prisma.user.findFirst({
    where: { role: { in: ['SUPER_ADMIN', 'ADMIN'] } },
  });
  return new SignJWT({
    sub: admin?.id || 'usr_super_admin',
    role: admin?.role || 'SUPER_ADMIN',
    name: admin?.name || 'Admin Tester',
    email: admin?.email || 'admintester@example.com',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('2h')
    .sign(JWT_SECRET);
}

test.describe('/api/citizen/voice-parse Auth & Rate Limiting Security Suite', () => {
  let rateLimitCitizenId = 'citizen_rate_limit_test';

  test.beforeAll(async () => {
    // Ensure dedicated citizen user exists for rate limit test
    await prisma.user.upsert({
      where: { id: rateLimitCitizenId },
      update: { isSuspended: false, deletedAt: null },
      create: {
        id: rateLimitCitizenId,
        name: 'Rate Limit Test Citizen',
        mobileNumber: '9999900001',
        authProvider: 'MOBILE_OTP',
        role: 'CITIZEN',
        isAuthorized: true,
        isSuspended: false,
      },
    });
  });

  test.afterAll(async () => {
    await prisma.user.delete({
      where: { id: rateLimitCitizenId },
    }).catch(() => {});
  });

  test('1. Unauthenticated request (no cookie) is rejected with 401', async ({ request }) => {
    const res = await request.post('/api/citizen/voice-parse', {
      data: { transcript: 'There is garbage in my street', language: 'en-IN' },
    });
    expect(res.status()).toBe(401);
  });

  test('2. Non-citizen role (ADMIN) is rejected with 403 Forbidden', async ({ request }) => {
    const adminToken = await createAdminJwt();
    const res = await request.post('/api/citizen/voice-parse', {
      headers: {
        Cookie: `ic_access_token=${adminToken}`,
      },
      data: { transcript: 'There is garbage in my street', language: 'en-IN' },
    });
    expect(res.status()).toBe(403);
  });

  test('3. Authenticated citizen with missing transcript reaches handler logic and receives 400', async ({ request }) => {
    const citizenToken = await createCitizenJwt();
    const res = await request.post('/api/citizen/voice-parse', {
      headers: {
        Cookie: `ic_access_token=${citizenToken}`,
      },
      data: { transcript: '' },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Transcript is required');
  });

  test('4. Exceeding rate limit triggers 429 Too Many Requests with Retry-After header', async ({ request }) => {
    const rateCitizenToken = await createCitizenJwt(rateLimitCitizenId, '9999900001');

    let rateLimited = false;
    let rateLimitStatus = 0;
    let retryAfterHeader = '';

    // Fire 22 quick requests on the dedicated user (limit is 20 per minute per citizen)
    for (let i = 0; i < 22; i++) {
      const res = await request.post('/api/citizen/voice-parse', {
        headers: {
          Cookie: `ic_access_token=${rateCitizenToken}`,
        },
        data: { transcript: '' },
      });

      if (res.status() === 429) {
        rateLimited = true;
        rateLimitStatus = res.status();
        retryAfterHeader = res.headers()['retry-after'] || '';
        break;
      }
    }

    expect(rateLimited).toBe(true);
    expect(rateLimitStatus).toBe(429);
    expect(retryAfterHeader).toBe('60');
  });
});
