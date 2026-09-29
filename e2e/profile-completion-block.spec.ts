import { test, expect } from '@playwright/test';
import prisma from '@/lib/prisma';

async function createMockJwt(sub: string, role = 'CITIZEN', isProfileComplete = false): Promise<string> {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = btoa(
    JSON.stringify({
      sub,
      role,
      isProfileComplete,
      exp: Math.floor(Date.now() / 1000) + 3600,
    }),
  );
  return `${header}.${payload}.signature`;
}

test.describe('Phase 2c (C3): Profile Completion Block', () => {
  test('Incomplete-profile citizen hitting /citizen dashboard gets redirected to profile completion', async ({ page }) => {
    // 1. Create a citizen with incomplete profile in database (missing address)
    const mobileNumber = `96${Date.now().toString().slice(-8)}`;
    const citizen = await prisma.user.create({
      data: {
        name: 'Incomplete Citizen',
        mobileNumber,
        role: 'CITIZEN',
        authProvider: 'MOBILE_OTP',
        address: '', // empty address -> incomplete
        isAuthorized: true,
        isSuspended: false,
      },
    });

    const token = await createMockJwt(citizen.id, 'CITIZEN', false);

    // 2. Set auth cookie and navigate to /citizen
    await page.context().addCookies([
      {
        name: 'ic_access_token',
        value: token,
        domain: 'localhost',
        path: '/',
      },
    ]);

    await page.goto('/citizen');

    // 3. Expect redirection to profile page
    await expect(page).toHaveURL(/\/citizen\/profile/);

    // 4. Cleanup
    await prisma.user.delete({ where: { id: citizen.id } });
  });

  test('Citizen with incomplete profile saves it -> immediately navigates to /citizen dashboard (same session) -> NOT redirected', async ({ page }) => {
    const mobileNumber = `95${Date.now().toString().slice(-8)}`;
    const citizen = await prisma.user.create({
      data: {
        name: 'Draft Citizen',
        mobileNumber,
        role: 'CITIZEN',
        authProvider: 'MOBILE_OTP',
        email: null,
        address: null,
        isAuthorized: true,
        isSuspended: false,
      },
    });

    const token = await createMockJwt(citizen.id, 'CITIZEN', false);

    await page.context().addCookies([
      {
        name: 'ic_access_token',
        value: token,
        domain: 'localhost',
        path: '/',
      },
    ]);

    // 1. Incomplete user hits /citizen and is redirected to profile page
    await page.goto('/citizen');
    await expect(page).toHaveURL(/\/citizen\/profile/);

    // 2. Submit profile completion (filling name, email & address)
    await page.fill('#name', 'Complete Citizen');
    await page.fill('#email', `complete_${Date.now()}@example.com`);
    await page.fill('#address', '456 Innovation Way, Ward 12');

    const [putRes] = await Promise.all([
      page.waitForResponse((res) => res.url().includes('/api/citizen/profile') && res.request().method() === 'PUT'),
      page.click('button:has-text("Save & Continue"), button[type="submit"]'),
    ]);

    expect(putRes.status()).toBe(200);

    // 3. Navigate directly to /citizen dashboard in the same session without re-authenticating
    await page.goto('/citizen');

    // 4. Assert URL stays on /citizen (NOT redirected to profile page)
    await expect(page).toHaveURL('http://localhost:3000/citizen');

    // 5. Cleanup
    await prisma.user.delete({ where: { id: citizen.id } }).catch(() => {});
  });
});
