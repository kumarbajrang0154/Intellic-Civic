import { test, expect } from '@playwright/test';
import { SignJWT } from 'jose';
import prisma from '../src/lib/prisma';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'intellicivic-super-secret-jwt-key-2026');

// 1x1 valid red PNG data URI (or a larger base64 image)
const TINY_RED_PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const TEST_DATA_URI = `data:image/png;base64,${TINY_RED_PNG_BASE64}`;

// A larger simulated avatar (~50 KB base64 string) to test size reduction
const LARGE_DATA_URI = `data:image/png;base64,${TINY_RED_PNG_BASE64}${'A'.repeat(50000)}`;

async function createAdminToken(userId: string) {
  return new SignJWT({
    sub: userId,
    role: 'SUPER_ADMIN',
    name: 'Super Admin Avatar Tester',
    email: 'avatar-test-admin@example.com',
    isAuthorized: true,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('2h')
    .sign(JWT_SECRET);
}

test.describe('Auth Me & Cached Avatar Route (/api/auth/me + /api/users/[id]/avatar)', () => {
  let testAdminId: string;
  let originalAvatarUrl: string | null = null;

  test.beforeAll(async () => {
    // Find an existing admin or super admin
    const admin = await prisma.user.findFirst({
      where: { role: { in: ['SUPER_ADMIN', 'ADMIN'] } },
    });
    if (!admin) {
      throw new Error('No admin user found in database');
    }
    testAdminId = admin.id;
    originalAvatarUrl = admin.avatarUrl;

    // Set large base64 data-URI avatar
    await prisma.user.update({
      where: { id: testAdminId },
      data: { avatarUrl: LARGE_DATA_URI },
    });
  });

  test.afterAll(async () => {
    // Restore original avatar
    if (testAdminId) {
      await prisma.user.update({
        where: { id: testAdminId },
        data: { avatarUrl: originalAvatarUrl },
      });
    }
  });

  test('1. /api/auth/me returns /api/users/[id]/avatar URL instead of base64 data-URI, drastically reducing payload size', async ({ request }) => {
    const token = await createAdminToken(testAdminId);

    const res = await request.get('/api/auth/me', {
      headers: {
        Cookie: `ic_access_token=${token}`,
      },
    });

    expect(res.status()).toBe(200);
    const bodyText = await res.text();
    const data = JSON.parse(bodyText);

    // Assert avatarUrl is NOT a base64 data URI
    expect(data.user.avatarUrl).not.toContain('data:image/');
    expect(data.user.avatarUrl).toBe(`/api/users/${testAdminId}/avatar`);

    // Verify response size: must be under 1 KB (compared to >50 KB with base64 data URI)
    const payloadBytes = Buffer.byteLength(bodyText, 'utf8');
    console.log(`[AVATAR_TEST] /api/auth/me payload size with cached URL: ${payloadBytes} bytes (vs ~50,000+ bytes before)`);
    expect(payloadBytes).toBeLessThan(1024);
  });

  test('2. GET /api/users/[id]/avatar serves binary image with session auth and private cache-control', async ({ request }) => {
    // Update to valid PNG data URI so binary decode is a real image
    await prisma.user.update({
      where: { id: testAdminId },
      data: { avatarUrl: TEST_DATA_URI },
    });

    // Unauthenticated: no cookie -> 401
    const unauthRes = await request.get(`/api/users/${testAdminId}/avatar`);
    expect(unauthRes.status()).toBe(401);

    // Authenticated with valid session cookie -> 200
    const token = await createAdminToken(testAdminId);
    const res = await request.get(`/api/users/${testAdminId}/avatar`, {
      headers: {
        Cookie: `ic_access_token=${token}`,
      },
    });
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toBe('image/png');
    expect(res.headers()['cache-control']).toContain('private');
    expect(res.headers()['cache-control']).toContain('max-age=86400');

    const imageBuffer = await res.body();
    expect(imageBuffer.length).toBeGreaterThan(0);
    // Compare decoded buffer length with expected base64 decode
    const expectedBuffer = Buffer.from(TINY_RED_PNG_BASE64, 'base64');
    expect(imageBuffer.length).toBe(expectedBuffer.length);
  });

  test('3. Topbar avatar image renders and is visible in AppShell', async ({ page, context }) => {
    // Ensure test user has valid image data URI
    await prisma.user.update({
      where: { id: testAdminId },
      data: { avatarUrl: TEST_DATA_URI },
    });

    const token = await createAdminToken(testAdminId);
    await context.addCookies([
      {
        name: 'ic_access_token',
        value: token,
        domain: 'localhost',
        path: '/',
      },
    ]);

    await page.goto('/admin');
    await page.waitForLoadState('domcontentloaded');

    // AppShell renders avatar img with selector or alt
    const avatarImg = page.locator(`img[src*="/api/users/${testAdminId}/avatar"]`).first();
    await expect(avatarImg).toBeVisible({ timeout: 15000 });

    // Verify the image was successfully loaded by browser
    const isLoaded = await avatarImg.evaluate((el: HTMLImageElement) => {
      if (el.complete && el.naturalWidth > 0) return true;
      return new Promise<boolean>((resolve) => {
        el.addEventListener('load', () => resolve(el.naturalWidth > 0));
        el.addEventListener('error', () => resolve(false));
        // Fallback timeout in case already loaded
        setTimeout(() => resolve(el.naturalWidth > 0), 2000);
      });
    });
    expect(isLoaded).toBe(true);
  });
});
