import { test, expect } from '@playwright/test';
import prisma from '@/lib/prisma';

async function createMockJwt(sub: string, role = 'CITIZEN'): Promise<string> {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = btoa(
    JSON.stringify({
      sub,
      role,
      exp: Math.floor(Date.now() / 1000) + 3600,
    }),
  );
  return `${header}.${payload}.signature`;
}

test.describe('Priority 1: Citizen Session Suspension Enforcement', () => {
  test('Active citizen token fails immediately with 403 when user is suspended mid-session in DB', async ({ page }) => {
    // 1. Create a live citizen in database
    const mobileNumber = `98${Date.now().toString().slice(-8)}`;
    const citizen = await prisma.user.create({
      data: {
        name: 'Active Citizen Test',
        mobileNumber,
        role: 'CITIZEN',
        authProvider: 'MOBILE_OTP',
        isAuthorized: true,
        isSuspended: false,
      },
    });

    const citizenToken = await createMockJwt(citizen.id, 'CITIZEN');

    // 2. Make an API request while active -> expect 200 OK
    const activeRes = await page.request.get('/api/citizen/profile', {
      headers: { Cookie: `ic_access_token=${citizenToken}` },
    });
    expect(activeRes.status()).toBe(200);

    // 3. Suspend citizen in database mid-session
    await prisma.user.update({
      where: { id: citizen.id },
      data: { isSuspended: true },
    });

    // 4. Next API call with SAME valid token must fail with 403 Forbidden without waiting for token expiry or logout
    const suspendedRes = await page.request.get('/api/citizen/profile', {
      headers: { Cookie: `ic_access_token=${citizenToken}` },
    });
    expect(suspendedRes.status()).toBe(403);
    const body = await suspendedRes.json();
    expect(body.message).toContain('suspended');

    // 5. Cleanup
    await prisma.user.delete({ where: { id: citizen.id } });
  });

  test('Suspended citizen with a valid token cannot GET their own complaint detail (/api/complaints/[id])', async ({ page }) => {
    // 1. Create a live citizen in database
    const mobileNumber = `97${Date.now().toString().slice(-8)}`;
    const citizen = await prisma.user.create({
      data: {
        name: 'Detail Test Citizen',
        mobileNumber,
        role: 'CITIZEN',
        authProvider: 'MOBILE_OTP',
        isAuthorized: true,
        isSuspended: true, // Created as suspended
      },
    });

    const citizenToken = await createMockJwt(citizen.id, 'CITIZEN');

    // 2. Request complaint detail -> must return 403 Forbidden
    const detailRes = await page.request.get('/api/complaints/cmp-101', {
      headers: { Cookie: `ic_access_token=${citizenToken}` },
    });
    expect(detailRes.status()).toBe(403);
    const body = await detailRes.json();
    expect(body.message).toContain('suspended');

    // 3. Cleanup
    await prisma.user.delete({ where: { id: citizen.id } });
  });
});
