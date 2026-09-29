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
});
