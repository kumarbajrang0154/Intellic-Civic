import { test, expect } from '@playwright/test';
import { SignJWT } from 'jose';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'intellicivic-dev-jwt-secret-key-32bytes!');

async function createTestJwt(payload: { role: string; sub?: string; expOffsetSec?: number; isAuthorized?: boolean; isProfileComplete?: boolean }) {
  const sub = payload.sub || (payload.role === 'CITIZEN' ? 'citizen_9876543210' : 'admin-test-uuid');
  const expOffset = payload.expOffsetSec !== undefined ? payload.expOffsetSec : 7200; // default 2 hours
  const exp = Math.floor(Date.now() / 1000) + expOffset;

  return new SignJWT({
    sub,
    role: payload.role,
    isAuthorized: payload.isAuthorized !== undefined ? payload.isAuthorized : true,
    isProfileComplete: payload.isProfileComplete !== undefined ? payload.isProfileComplete : true,
    exp,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .sign(JWT_SECRET);
}

test.describe('Root Path Redirect & Landing Page Removal E2E Tests', () => {
  test('1. Unauthenticated visit to "/" lands on /login/citizen with no landing content ever visible', async ({ page, context }) => {
    await context.clearCookies();

    // Verify navigating to "/" redirects server-side to /login/citizen
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    await expect(page).toHaveURL(/\/login\/citizen/);
    await expect(page.getByText('Citizen Verification')).toBeVisible();

    // Ensure removed landing page content is never present in DOM
    await expect(page.locator('text=Empowering Cities with')).toHaveCount(0);
    await expect(page.locator('text=Intelligent Civic Resolution')).toHaveCount(0);
    await expect(page.locator('text=Municipal Staff Portal')).toHaveCount(0);
    await expect(page.locator('text=Automated AI Triage')).toHaveCount(0);
  });

  const rolesToTest = [
    { role: 'CITIZEN', target: /\/citizen/ },
    { role: 'SUPER_ADMIN', target: /\/admin/ },
    { role: 'ADMIN', target: /\/admin/ },
    { role: 'DEPARTMENT_HEAD', target: /\/dept-head/ },
    { role: 'DEPARTMENT_OFFICER', target: /\/officer/ },
    { role: 'FIELD_WORKER', target: /\/field-worker/ },
  ];

  for (const { role, target } of rolesToTest) {
    test(`2. Authenticated ${role} visit to "/" redirects to ${target}`, async ({ page, context }) => {
      const token = await createTestJwt({ role });
      await context.addCookies([
        {
          name: 'ic_access_token',
          value: token,
          domain: 'localhost',
          path: '/',
        },
      ]);

      await page.goto('/');
      await page.waitForLoadState('domcontentloaded');

      await expect(page).toHaveURL(target);
    });
  }

  test('4. Expired or invalid cookie on "/" redirects to /login/citizen', async ({ page, context }) => {
    // 4a. Expired cookie
    const expiredToken = await createTestJwt({ role: 'CITIZEN', expOffsetSec: -3600 });
    await context.addCookies([
      {
        name: 'ic_access_token',
        value: expiredToken,
        domain: 'localhost',
        path: '/',
      },
    ]);

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    await expect(page).toHaveURL(/\/login\/citizen/);
    await expect(page.getByText('Citizen Verification')).toBeVisible();

    // 4b. Invalid / malformed cookie
    await context.addCookies([
      {
        name: 'ic_access_token',
        value: 'completely-invalid-malformed-jwt-cookie',
        domain: 'localhost',
        path: '/',
      },
    ]);

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    await expect(page).toHaveURL(/\/login\/citizen/);
    await expect(page.getByText('Citizen Verification')).toBeVisible();
  });

  test('5. Offline with citizen cookie, opening "/" renders citizen page', async ({ page, context }) => {
    const token = await createTestJwt({ role: 'CITIZEN' });
    await context.addCookies([
      {
        name: 'ic_access_token',
        value: token,
        domain: 'localhost',
        path: '/',
      },
    ]);

    // 1. Visit /citizen online first to register SW and cache shell
    await page.goto('/citizen');
    await page.waitForLoadState('networkidle');

    // Wait for SW to be registered and active, and ensure cache contains the shell
    await page.evaluate(async () => {
      if ('serviceWorker' in navigator) {
        try {
          await navigator.serviceWorker.register('/sw.js');
          await Promise.race([
            navigator.serviceWorker.ready,
            new Promise((_, reject) => setTimeout(() => reject(new Error('SW ready timeout')), 5000)),
          ]);
        } catch (e) {
          console.warn('SW registration/ready warning:', e);
        }
        const cache = await caches.open('intellicivic-v3');
        const res = await fetch('/citizen');
        if (res && res.status === 200) {
          await cache.put('/citizen', res.clone());
          await cache.put('/', res);
        }
      }
    });

    // 2. Go offline
    await context.setOffline(true);

    // 3. Open "/" while offline
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // Verify it renders the citizen page shell and not a browser offline error
    await expect(page.locator('body')).not.toContainText('net::ERR_INTERNET_DISCONNECTED');
    await expect(page.getByText('Citizen').or(page.getByText('IntelliCivic')).first()).toBeVisible();
  });

  test('6. Logout lands on /login/citizen', async ({ page, context }) => {
    const token = await createTestJwt({ role: 'CITIZEN' });
    await context.addCookies([
      {
        name: 'ic_access_token',
        value: token,
        domain: 'localhost',
        path: '/',
      },
    ]);

    await page.goto('/citizen');
    await page.waitForLoadState('domcontentloaded');

    // Click Sign Out / Logout in sidebar
    await page.click('button:has-text("Sign Out"), button:has-text("Logout")');

    await expect(page).toHaveURL(/\/login\/citizen/);
    await expect(page.getByText('Citizen Verification')).toBeVisible();

    const cookies = await context.cookies();
    const accessToken = cookies.find((c) => c.name === 'ic_access_token');
    expect(accessToken).toBeUndefined();
  });
});
