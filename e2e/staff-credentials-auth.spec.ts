import { test, expect, APIRequestContext } from '@playwright/test';
import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { getDefaultMunicipality, ensureSuperAdminUser } from '@/lib/staff-dept-store';

const BASE = 'http://localhost:3000';

async function getAdminContext(request: APIRequestContext): Promise<{ cookie: string; adminUser: any }> {
  const mun = await getDefaultMunicipality();
  const adminEmail = 'test.admin.credentials@smartcity.gov.in';

  let admin = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (!admin) {
    admin = await prisma.user.create({
      data: {
        name: 'Test Municipal Admin',
        email: adminEmail,
        role: 'ADMIN',
        municipalityId: mun.id,
        isAuthorized: true,
        isSuspended: false,
        authProvider: 'GOOGLE',
      },
    });
  } else {
    admin = await prisma.user.update({
      where: { id: admin.id },
      data: {
        role: 'ADMIN',
        municipalityId: mun.id,
        isAuthorized: true,
        isSuspended: false,
      },
    });
  }

  const res = await request.post(`${BASE}/api/auth/dev-login`, {
    data: { email: 'kumarbajrang325@gmail.com', role: 'ADMIN' },
  });
  if (!res.ok()) {
    throw new Error(`dev-login failed: ${await res.text()}`);
  }
  const setCookies = res.headersArray().filter(h => h.name.toLowerCase() === 'set-cookie').map(h => h.value);
  for (const c of setCookies) {
    const match = c.match(/ic_access_token=([^;]+)/);
    if (match) return { cookie: `ic_access_token=${match[1]}`, adminUser: admin };
  }
  const fallback = res.headers()['set-cookie'] ?? '';
  const match = fallback.match(/ic_access_token=([^;]+)/);
  return { cookie: match ? `ic_access_token=${match[1]}` : '', adminUser: admin };
}

async function getNonAdminContext(request: APIRequestContext): Promise<string> {
  const res = await request.post(`${BASE}/api/auth/dev-login`, {
    data: { email: 'officer.roads@smartcity.gov.in', role: 'DEPARTMENT_OFFICER' },
  });
  const cookies = res.headers()['set-cookie'] ?? '';
  const match = cookies.match(/ic_access_token=([^;]+)/);
  return match ? `ic_access_token=${match[1]}` : '';
}

test.describe('Staff Credentials Authentication & Management', () => {
  test.setTimeout(90000);

  let defaultMunId: string;

  test.beforeAll(async () => {
    await ensureSuperAdminUser();
    const mun = await getDefaultMunicipality();
    defaultMunId = mun.id;
  });

  // 1. generate -> login works for each staff role and lands on the right portal
  test('1. Credentials generate -> login works for each staff role and lands on the right portal', async ({ request }) => {
    const { cookie } = await getAdminContext(request);

    const rolesToTest = [
      { role: 'DEPARTMENT_HEAD', portal: '/dept-head', email: 'test.dhead.cred@smartcity.gov.in' },
      { role: 'DEPARTMENT_OFFICER', portal: '/officer', email: 'test.officer.cred@smartcity.gov.in' },
      { role: 'FIELD_WORKER', portal: '/field-worker', email: 'test.fworker.cred@smartcity.gov.in' },
      { role: 'ADMIN', portal: '/admin', email: 'test.admin2.cred@smartcity.gov.in' },
    ];

    for (const item of rolesToTest) {
      // Setup or reset user
      const user = await prisma.user.upsert({
        where: { email: item.email },
        update: {
          name: `Test ${item.role}`,
          role: item.role as any,
          municipalityId: defaultMunId,
          isAuthorized: true,
          isSuspended: false,
          deletedAt: null,
          failedLoginCount: 0,
          lockedUntil: null,
        },
        create: {
          name: `Test ${item.role}`,
          email: item.email,
          role: item.role as any,
          municipalityId: defaultMunId,
          isAuthorized: true,
          isSuspended: false,
          authProvider: 'GOOGLE',
        },
      });

      // Generate credentials via admin endpoint
      const credRes = await request.post(`${BASE}/api/admin/staff/${user.id}/credentials`, {
        headers: { cookie },
        data: {},
      });

      expect(credRes.status()).toBe(200);
      const credData = await credRes.json();
      expect(credData.success).toBe(true);
      expect(credData.loginId).toBeDefined();
      expect(credData.loginId.length).toBeGreaterThan(4);
      expect(credData.password).toBeDefined();
      expect(credData.password.length).toBe(12);

      // Verify DB holds a hash, not the plaintext
      const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
      expect(dbUser?.loginId).toBe(credData.loginId);
      expect(dbUser?.passwordHash).toBeDefined();
      expect(dbUser?.passwordHash).not.toBe(credData.password);
      expect(dbUser?.passwordHash?.startsWith('$2')).toBe(true);
      expect(await bcrypt.compare(credData.password, dbUser!.passwordHash!)).toBe(true);

      // Now login via staff-login
      const loginRes = await request.post(`${BASE}/api/auth/staff-login`, {
        data: {
          loginId: credData.loginId,
          password: credData.password,
        },
      });

      expect(loginRes.status()).toBe(200);
      const loginData = await loginRes.json();
      expect(loginData.success).toBe(true);
      expect(loginData.role).toBe(item.role);
      expect(loginData.redirectUrl).toBe(item.portal);

      // Verify session cookies issued
      const setCookies = loginRes.headers()['set-cookie'] || '';
      expect(setCookies).toContain('ic_access_token=');
      expect(setCookies).toContain('ic_refresh_token=');
    }
  });

  // 2. DB holds a hash, not the plaintext
  test('2. DB holds a hash and never stores plaintext', async ({ request }) => {
    const { cookie } = await getAdminContext(request);

    const email = 'test.hashcheck@smartcity.gov.in';
    const user = await prisma.user.upsert({
      where: { email },
      update: {
        role: 'FIELD_WORKER',
        municipalityId: defaultMunId,
        isAuthorized: true,
        isSuspended: false,
      },
      create: {
        name: 'Hash Check Worker',
        email,
        role: 'FIELD_WORKER',
        municipalityId: defaultMunId,
        isAuthorized: true,
        isSuspended: false,
        authProvider: 'GOOGLE',
      },
    });

    const res = await request.post(`${BASE}/api/admin/staff/${user.id}/credentials`, {
      headers: { cookie },
      data: {},
    });
    expect(res.status()).toBe(200);
    const { password } = await res.json();

    const inDb = await prisma.user.findUnique({ where: { id: user.id } });
    expect(inDb?.passwordHash).not.toBeNull();
    expect(inDb?.passwordHash).not.toBe(password);
    expect(inDb?.passwordHash?.length).toBeGreaterThan(40);
    expect(inDb?.passwordHash?.startsWith('$2')).toBe(true);
  });

  // 3. wrong password -> 401 generic
  test('3. Wrong password returns 401 generic error', async ({ request }) => {
    const { cookie } = await getAdminContext(request);

    const email = 'test.wrongpass@smartcity.gov.in';
    const user = await prisma.user.upsert({
      where: { email },
      update: {
        role: 'DEPARTMENT_OFFICER',
        municipalityId: defaultMunId,
        isAuthorized: true,
        isSuspended: false,
        failedLoginCount: 0,
        lockedUntil: null,
      },
      create: {
        name: 'Wrong Pass Officer',
        email,
        role: 'DEPARTMENT_OFFICER',
        municipalityId: defaultMunId,
        isAuthorized: true,
        isSuspended: false,
        authProvider: 'GOOGLE',
      },
    });

    const credRes = await request.post(`${BASE}/api/admin/staff/${user.id}/credentials`, {
      headers: { cookie },
      data: {},
    });
    const { loginId } = await credRes.json();

    const loginRes = await request.post(`${BASE}/api/auth/staff-login`, {
      data: {
        loginId,
        password: 'IncorrectPassword999!',
      },
    });

    expect(loginRes.status()).toBe(401);
    const body = await loginRes.json();
    expect(body.statusCode).toBe(401);
    expect(body.message).toContain('Invalid login ID or password');
  });

  // 4. 5 wrong -> locked (15 min)
  test('4. Rate limit + lockout after 5 failures for 15 minutes', async ({ request }) => {
    const { cookie } = await getAdminContext(request);

    const email = 'test.lockout@smartcity.gov.in';
    const user = await prisma.user.upsert({
      where: { email },
      update: {
        role: 'DEPARTMENT_OFFICER',
        municipalityId: defaultMunId,
        isAuthorized: true,
        isSuspended: false,
        failedLoginCount: 0,
        lockedUntil: null,
      },
      create: {
        name: 'Lockout Test Officer',
        email,
        role: 'DEPARTMENT_OFFICER',
        municipalityId: defaultMunId,
        isAuthorized: true,
        isSuspended: false,
        authProvider: 'GOOGLE',
      },
    });

    const credRes = await request.post(`${BASE}/api/admin/staff/${user.id}/credentials`, {
      headers: { cookie },
      data: {},
    });
    const { loginId, password } = await credRes.json();

    // 5 failed login attempts
    for (let i = 1; i <= 5; i++) {
      const res = await request.post(`${BASE}/api/auth/staff-login`, {
        data: { loginId, password: 'WrongPassword!' },
      });
      expect(res.status()).toBe(401);
    }

    // Verify DB locked state
    const lockedUser = await prisma.user.findUnique({ where: { id: user.id } });
    expect(lockedUser?.failedLoginCount).toBeGreaterThanOrEqual(5);
    expect(lockedUser?.lockedUntil).not.toBeNull();
    const lockExpiry = new Date(lockedUser!.lockedUntil!).getTime();
    expect(lockExpiry).toBeGreaterThan(Date.now() + 10 * 60 * 1000); // ~15 min

    // Attempting login even with the CORRECT password is now rejected
    const tryCorrect = await request.post(`${BASE}/api/auth/staff-login`, {
      data: { loginId, password },
    });
    expect(tryCorrect.status()).toBe(401);
  });

  // 5. suspended and archived staff cannot login
  test('5. Suspended and archived staff cannot login', async ({ request }) => {
    const { cookie } = await getAdminContext(request);

    // 5a: Suspended staff
    const suspEmail = 'test.suspended.cred@smartcity.gov.in';
    const suspUser = await prisma.user.upsert({
      where: { email: suspEmail },
      update: {
        role: 'FIELD_WORKER',
        municipalityId: defaultMunId,
        isAuthorized: true,
        isSuspended: false,
        deletedAt: null,
        failedLoginCount: 0,
        lockedUntil: null,
      },
      create: {
        name: 'Suspended Worker',
        email: suspEmail,
        role: 'FIELD_WORKER',
        municipalityId: defaultMunId,
        isAuthorized: true,
        isSuspended: false,
        authProvider: 'GOOGLE',
      },
    });

    const suspCredRes = await request.post(`${BASE}/api/admin/staff/${suspUser.id}/credentials`, {
      headers: { cookie },
    });
    const { loginId: suspLoginId, password: suspPassword } = await suspCredRes.json();

    // Now suspend the user
    await prisma.user.update({
      where: { id: suspUser.id },
      data: { isSuspended: true },
    });

    const suspLoginRes = await request.post(`${BASE}/api/auth/staff-login`, {
      data: { loginId: suspLoginId, password: suspPassword },
    });
    expect(suspLoginRes.status()).toBe(401);

    // 5b: Archived (deletedAt) staff
    const archEmail = 'test.archived.cred@smartcity.gov.in';
    const archUser = await prisma.user.upsert({
      where: { email: archEmail },
      update: {
        role: 'DEPARTMENT_OFFICER',
        municipalityId: defaultMunId,
        isAuthorized: true,
        isSuspended: false,
        deletedAt: null,
        failedLoginCount: 0,
        lockedUntil: null,
      },
      create: {
        name: 'Archived Officer',
        email: archEmail,
        role: 'DEPARTMENT_OFFICER',
        municipalityId: defaultMunId,
        isAuthorized: true,
        isSuspended: false,
        authProvider: 'GOOGLE',
      },
    });

    const archCredRes = await request.post(`${BASE}/api/admin/staff/${archUser.id}/credentials`, {
      headers: { cookie },
    });
    const { loginId: archLoginId, password: archPassword } = await archCredRes.json();

    // Soft-delete / archive
    await prisma.user.update({
      where: { id: archUser.id },
      data: { deletedAt: new Date() },
    });

    const archLoginRes = await request.post(`${BASE}/api/auth/staff-login`, {
      data: { loginId: archLoginId, password: archPassword },
    });
    expect(archLoginRes.status()).toBe(401);
  });

  // 6. citizen cannot use staff-login
  test('6. Citizen cannot use staff-login endpoint', async ({ request }) => {
    const citEmail = 'test.citizen.cred@smartcity.gov.in';
    const citPassword = 'ValidPassword123!';
    const passwordHash = await bcrypt.hash(citPassword, 10);

    const citizen = await prisma.user.upsert({
      where: { email: citEmail },
      update: {
        role: 'CITIZEN',
        loginId: 'CITIZEN999999',
        passwordHash,
        isAuthorized: true,
        isSuspended: false,
        deletedAt: null,
      },
      create: {
        name: 'Test Citizen User',
        email: citEmail,
        role: 'CITIZEN',
        loginId: 'CITIZEN999999',
        passwordHash,
        isAuthorized: true,
        isSuspended: false,
        authProvider: 'MOBILE_OTP',
      },
    });

    const loginRes = await request.post(`${BASE}/api/auth/staff-login`, {
      data: {
        loginId: citizen.loginId,
        password: citPassword,
      },
    });
    expect(loginRes.status()).toBe(401);
  });

  // 7. non-admin and other-municipality admin get 403 on credentials
  test('7. Non-admin and other-municipality admin get 403 on credentials', async ({ request }) => {
    const nonAdminCookie = await getNonAdminContext(request);

    // 7a: Non-admin gets 403
    const targetUser = await prisma.user.findFirst({
      where: { role: 'FIELD_WORKER', municipalityId: defaultMunId },
    });
    expect(targetUser).not.toBeNull();

    const nonAdminRes = await request.post(`${BASE}/api/admin/staff/${targetUser!.id}/credentials`, {
      headers: { cookie: nonAdminCookie },
      data: {},
    });
    expect(nonAdminRes.status()).toBe(403);

    // 7b: Other municipality admin gets 403
    let otherMun = await prisma.municipality.findFirst({
      where: { OR: [{ code: 'OTHER-MUN-TEST' }, { name: 'Other Municipality Test' }] },
    });
    if (!otherMun) {
      otherMun = await prisma.municipality.create({
        data: {
          name: 'Other Municipality Test',
          code: 'OTHER-MUN-TEST',
          city: 'Chennai',
          state: 'Tamil Nadu',
        },
      });
    }

    const otherAdminEmail = 'admin.othermun@smartcity.gov.in';
    const otherPass = 'OtherMunAdmin123!';
    const otherHash = await bcrypt.hash(otherPass, 10);
    const otherAdmin = await prisma.user.upsert({
      where: { email: otherAdminEmail },
      update: {
        role: 'ADMIN',
        municipalityId: otherMun.id,
        loginId: 'OTHER_ADMIN_1',
        passwordHash: otherHash,
        isAuthorized: true,
        isSuspended: false,
        deletedAt: null,
      },
      create: {
        name: 'Other Mun Admin',
        email: otherAdminEmail,
        role: 'ADMIN',
        municipalityId: otherMun.id,
        loginId: 'OTHER_ADMIN_1',
        passwordHash: otherHash,
        isAuthorized: true,
        isSuspended: false,
        authProvider: 'GOOGLE',
      },
    });

    const otherLoginRes = await request.post(`${BASE}/api/auth/staff-login`, {
      data: { loginId: 'OTHER_ADMIN_1', password: otherPass },
    });
    expect(otherLoginRes.status()).toBe(200);
    const setCookie = otherLoginRes.headers()['set-cookie'] || '';
    const otherAdminToken = setCookie.match(/ic_access_token=([^;]+)/)?.[1] || '';

    // Attempt to manage credentials of a staff in defaultMun
    const crossMunRes = await request.post(`${BASE}/api/admin/staff/${targetUser!.id}/credentials`, {
      headers: { cookie: `ic_access_token=${otherAdminToken}` },
      data: {},
    });
    expect(crossMunRes.status()).toBe(403);
  });

  // 8. reset invalidates the old password
  test('8. Reset credentials invalidates old password and sets new one', async ({ request }) => {
    const { cookie } = await getAdminContext(request);

    const email = 'test.resetpass@smartcity.gov.in';
    const user = await prisma.user.upsert({
      where: { email },
      update: {
        role: 'DEPARTMENT_HEAD',
        municipalityId: defaultMunId,
        isAuthorized: true,
        isSuspended: false,
        failedLoginCount: 0,
        lockedUntil: null,
      },
      create: {
        name: 'Reset Password Dept Head',
        email,
        role: 'DEPARTMENT_HEAD',
        municipalityId: defaultMunId,
        isAuthorized: true,
        isSuspended: false,
        authProvider: 'GOOGLE',
      },
    });

    // 8a: Initial generation
    const credRes1 = await request.post(`${BASE}/api/admin/staff/${user.id}/credentials`, {
      headers: { cookie },
      data: {},
    });
    const { loginId, password: oldPassword } = await credRes1.json();

    // Verify initial login works
    const loginRes1 = await request.post(`${BASE}/api/auth/staff-login`, {
      data: { loginId, password: oldPassword },
    });
    expect(loginRes1.status()).toBe(200);

    // 8b: Reset password
    const resetRes = await request.post(`${BASE}/api/admin/staff/${user.id}/credentials`, {
      headers: { cookie },
      data: { reset: true },
    });
    expect(resetRes.status()).toBe(200);
    const { password: newPassword } = await resetRes.json();
    expect(newPassword).not.toBe(oldPassword);

    // Old password must fail
    const oldLoginRes = await request.post(`${BASE}/api/auth/staff-login`, {
      data: { loginId, password: oldPassword },
    });
    expect(oldLoginRes.status()).toBe(401);

    // New password must succeed
    const newLoginRes = await request.post(`${BASE}/api/auth/staff-login`, {
      data: { loginId, password: newPassword },
    });
    expect(newLoginRes.status()).toBe(200);
  });

  // 9. Google login still works
  test('9. Existing Google login endpoint still works alongside credentials', async ({ request }) => {
    const email = 'officer.roads@smartcity.gov.in';
    const res = await request.post(`${BASE}/api/auth/google-login`, {
      data: {
        email,
        name: 'Officer Roads',
      },
    });

    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.redirectUrl).toBe('/officer');
    const cookies = res.headers()['set-cookie'] || '';
    expect(cookies).toContain('ic_access_token=');
  });

  // 10. Passwords and hashes never appear in audit rows
  test('10. Passwords and hashes never appear in audit rows', async ({ request }) => {
    const { cookie } = await getAdminContext(request);

    const email = 'test.auditcheck@smartcity.gov.in';
    const user = await prisma.user.upsert({
      where: { email },
      update: {
        role: 'FIELD_WORKER',
        municipalityId: defaultMunId,
        isAuthorized: true,
        isSuspended: false,
      },
      create: {
        name: 'Audit Check Worker',
        email,
        role: 'FIELD_WORKER',
        municipalityId: defaultMunId,
        isAuthorized: true,
        isSuspended: false,
        authProvider: 'GOOGLE',
      },
    });

    const res = await request.post(`${BASE}/api/admin/staff/${user.id}/credentials`, {
      headers: { cookie },
      data: {},
    });
    const { password } = await res.json();

    // Check audit rows in DB for this target user
    const auditLogs = await prisma.auditLog.findMany({
      where: { entityId: user.id },
    });

    expect(auditLogs.length).toBeGreaterThan(0);
    for (const log of auditLogs) {
      const metaString = JSON.stringify(log.metadata || {});
      expect(metaString).not.toContain(password);
      expect(metaString).not.toContain('$2');
      expect(metaString).not.toContain('passwordHash');
      expect(metaString).not.toContain('password');
    }
  });

  // 11. UI tests: Staff login page & mobile responsiveness
  test('11. Staff login page: Google button + Login ID & Password form + mobile responsiveness', async ({ page }) => {
    // Test on 375px mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto(`${BASE}/login/staff`);
    await page.waitForLoadState('networkidle');

    // Verify Google button exists
    const googleBtn = page.locator('#google-login-button');
    await expect(googleBtn).toBeVisible();

    // Verify credentials form exists
    const form = page.locator('#staff-credentials-form');
    await expect(form).toBeVisible();

    const loginIdInput = page.locator('#staff-login-id');
    const passwordInput = page.locator('#staff-password');
    const submitBtn = page.locator('#staff-login-submit');

    await expect(loginIdInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
    await expect(submitBtn).toBeVisible();

    // Try invalid login in UI -> shared error popup displays
    await loginIdInput.fill('NONEXISTENT_ID');
    await passwordInput.fill('WrongPass123!');
    await submitBtn.click();

    // The shared error popup dialog must be visible
    const errorPopup = page.locator('[data-testid="global-error-popup"]');
    await expect(errorPopup).toBeVisible({ timeout: 10000 });

    // Verify no horizontal page overflow on 375px
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 2);
  });
});
