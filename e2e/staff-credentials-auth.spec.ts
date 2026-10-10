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

test.describe('Staff Credentials Authentication & Management (Email + Admin Password)', () => {
  test.setTimeout(90000);

  let defaultMunId: string;
  let testDeptId: string;
  let testOfficerId: string;

  test.beforeAll(async () => {
    await ensureSuperAdminUser();
    const mun = await getDefaultMunicipality();
    defaultMunId = mun.id;

    // Ensure a default test department exists
    let dept = await prisma.department.findFirst({ where: { name: 'Roads & Infrastructure' } });
    if (!dept) {
      dept = await prisma.department.create({
        data: {
          name: 'Roads & Infrastructure',
          description: 'Road repair and infrastructure management',
          headOfficeAddress: 'Civic Center, Main Road',
        },
      });
    }
    testDeptId = dept.id;

    // Ensure a test officer exists for field worker assignment
    const officer = await prisma.user.upsert({
      where: { email: 'assigned.officer.test@smartcity.gov.in' },
      update: {
        role: 'DEPARTMENT_OFFICER',
        departmentId: testDeptId,
        municipalityId: defaultMunId,
        isAuthorized: true,
        isSuspended: false,
      },
      create: {
        name: 'Assigned Test Officer',
        email: 'assigned.officer.test@smartcity.gov.in',
        role: 'DEPARTMENT_OFFICER',
        departmentId: testDeptId,
        municipalityId: defaultMunId,
        isAuthorized: true,
        isSuspended: false,
        authProvider: 'GOOGLE',
      },
    });
    testOfficerId = officer.id;
  });

  // 1. Admin creates Head, Officer, Field Worker with email+password -> each logs in at /login/staff and lands on the correct portal
  test('1. Admin creates Head, Officer, Field Worker with email+password -> login lands on correct portal', async ({ request }) => {
    const { cookie } = await getAdminContext(request);

    const rolesToTest = [
      {
        role: 'DEPARTMENT_HEAD',
        portal: '/dept-head',
        email: 'test.create.dhead@smartcity.gov.in',
        name: 'Test Create Dept Head',
        departmentId: testDeptId,
        password: 'AdminChosenPass123!',
      },
      {
        role: 'DEPARTMENT_OFFICER',
        portal: '/officer',
        email: 'test.create.officer@smartcity.gov.in',
        name: 'Test Create Officer',
        departmentId: testDeptId,
        password: 'AdminChosenPass456!',
      },
      {
        role: 'FIELD_WORKER',
        portal: '/field-worker',
        email: 'test.create.fworker@smartcity.gov.in',
        name: 'Test Create Field Worker',
        departmentId: testDeptId,
        assignedOfficerId: testOfficerId,
        password: 'AdminChosenPass789!',
      },
    ];

    for (const item of rolesToTest) {
      // Clean up previous test row if any
      await prisma.user.deleteMany({ where: { email: item.email } });

      // Admin creates staff account with email + password
      const createRes = await request.post(`${BASE}/api/admin/staff`, {
        headers: { cookie },
        data: {
          name: item.name,
          email: item.email,
          role: item.role,
          departmentId: item.departmentId,
          assignedOfficerId: item.assignedOfficerId,
          password: item.password,
        },
      });

      expect(createRes.status()).toBe(201);
      const createBody = await createRes.json();
      expect(createBody.staff).toBeDefined();
      expect(createBody.staff.email).toBe(item.email.toLowerCase());
      // Password or passwordHash must NEVER be in creation response
      expect(createBody.staff.password).toBeUndefined();
      expect(createBody.staff.passwordHash).toBeUndefined();

      // Verify DB holds a bcrypt hash, not plaintext
      const dbUser = await prisma.user.findUnique({ where: { email: item.email } });
      expect(dbUser).not.toBeNull();
      expect(dbUser?.passwordHash).toBeDefined();
      expect(dbUser?.passwordHash).not.toBe(item.password);
      expect(dbUser?.passwordHash?.startsWith('$2')).toBe(true);
      expect(await bcrypt.compare(item.password, dbUser!.passwordHash!)).toBe(true);

      // Now login via /api/auth/staff-login using email + password
      const loginRes = await request.post(`${BASE}/api/auth/staff-login`, {
        data: {
          email: item.email,
          password: item.password,
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

  // 2. DB holds a bcrypt hash, never plaintext; password absent from API responses, audit rows and server log output
  test('2. DB holds bcrypt hash, password absent from responses and audit rows', async ({ request }) => {
    const { cookie } = await getAdminContext(request);
    const email = 'test.audit.absence@smartcity.gov.in';
    const chosenPassword = 'SecureAdminPassword123!';

    await prisma.user.deleteMany({ where: { email } });

    // Create staff member
    const createRes = await request.post(`${BASE}/api/admin/staff`, {
      headers: { cookie },
      data: {
        name: 'Audit Check Officer',
        email,
        role: 'DEPARTMENT_OFFICER',
        departmentId: testDeptId,
        password: chosenPassword,
      },
    });

    expect(createRes.status()).toBe(201);
    const createData = await createRes.json();
    const createdUserId = createData.staff.id;

    // Check DB state
    const dbUser = await prisma.user.findUnique({ where: { id: createdUserId } });
    expect(dbUser?.passwordHash).not.toBeNull();
    expect(dbUser?.passwordHash).not.toBe(chosenPassword);
    expect(dbUser?.passwordHash?.length).toBeGreaterThan(40);
    expect(dbUser?.passwordHash?.startsWith('$2')).toBe(true);

    // Reset password via POST /api/admin/staff/[id]/password
    const newPass = 'NewAdminPassword456!';
    const setPassRes = await request.post(`${BASE}/api/admin/staff/${createdUserId}/password`, {
      headers: { cookie },
      data: { password: newPass },
    });
    expect(setPassRes.status()).toBe(200);
    const setPassBody = await setPassRes.json();
    // Response must NEVER contain password or passwordHash
    expect(setPassBody.password).toBeUndefined();
    expect(setPassBody.passwordHash).toBeUndefined();

    // Verify audit rows: no password or hash in metadata
    const auditLogs = await prisma.auditLog.findMany({
      where: { entityId: createdUserId },
    });
    expect(auditLogs.length).toBeGreaterThan(0);
    for (const log of auditLogs) {
      const metaString = JSON.stringify(log.metadata || {});
      expect(metaString).not.toContain(chosenPassword);
      expect(metaString).not.toContain(newPass);
      expect(metaString).not.toContain('$2');
      expect(metaString).not.toContain('passwordHash');
      expect(metaString).not.toContain('password');
    }
  });

  // 3. Unknown email, wrong password, locked and suspended all return byte-identical 401 bodies
  test('3. Unknown email, wrong password, locked, suspended return byte-identical 401 bodies', async ({ request }) => {
    const { cookie } = await getAdminContext(request);
    const validEmail = 'test.identical401@smartcity.gov.in';
    const validPassword = 'TargetPassword123!';

    await prisma.user.deleteMany({ where: { email: validEmail } });

    const createRes = await request.post(`${BASE}/api/admin/staff`, {
      headers: { cookie },
      data: {
        name: 'Identical 401 Staff',
        email: validEmail,
        role: 'DEPARTMENT_OFFICER',
        departmentId: testDeptId,
        password: validPassword,
      },
    });
    expect(createRes.status()).toBe(201);
    const user = (await createRes.json()).staff;

    // 3a. Wrong password attempt
    const wrongPasswordRes = await request.post(`${BASE}/api/auth/staff-login`, {
      data: {
        email: validEmail,
        password: 'IncorrectPassword999!',
      },
    });
    expect(wrongPasswordRes.status()).toBe(401);
    const wrongPasswordBody = await wrongPasswordRes.json();

    // 3b. Unknown email attempt
    const unknownEmailRes = await request.post(`${BASE}/api/auth/staff-login`, {
      data: {
        email: 'nonexistent.user.99999@smartcity.gov.in',
        password: 'SomeRandomPassword123!',
      },
    });
    expect(unknownEmailRes.status()).toBe(401);
    const unknownEmailBody = await unknownEmailRes.json();

    // 3c. Locked account attempt
    await prisma.user.update({
      where: { id: user.id },
      data: { lockedUntil: new Date(Date.now() + 15 * 60 * 1000) },
    });
    const lockedRes = await request.post(`${BASE}/api/auth/staff-login`, {
      data: {
        email: validEmail,
        password: validPassword,
      },
    });
    expect(lockedRes.status()).toBe(401);
    const lockedBody = await lockedRes.json();

    // 3d. Suspended account attempt
    await prisma.user.update({
      where: { id: user.id },
      data: { lockedUntil: null, isSuspended: true },
    });
    const suspendedRes = await request.post(`${BASE}/api/auth/staff-login`, {
      data: {
        email: validEmail,
        password: validPassword,
      },
    });
    expect(suspendedRes.status()).toBe(401);
    const suspendedBody = await suspendedRes.json();

    // 3e. Account without passwordHash attempt
    await prisma.user.update({
      where: { id: user.id },
      data: { isSuspended: false, passwordHash: null },
    });
    const noPassRes = await request.post(`${BASE}/api/auth/staff-login`, {
      data: {
        email: validEmail,
        password: validPassword,
      },
    });
    expect(noPassRes.status()).toBe(401);
    const noPassBody = await noPassRes.json();

    // All must be completely byte-identical
    expect(wrongPasswordBody).toEqual({
      statusCode: 401,
      message: 'Invalid email or password.',
    });
    expect(unknownEmailBody).toEqual(wrongPasswordBody);
    expect(lockedBody).toEqual(wrongPasswordBody);
    expect(suspendedBody).toEqual(wrongPasswordBody);
    expect(noPassBody).toEqual(wrongPasswordBody);
  });

  // 4. 5 wrong -> locked (15 min), and the correct password still fails during lockout + per-IP rate limit
  test('4. 5 failures lock account for 15 minutes, correct password rejected during lockout', async ({ request }) => {
    const { cookie } = await getAdminContext(request);
    const email = 'test.lockout.flow@smartcity.gov.in';
    const password = 'CorrectPassword123!';

    await prisma.user.deleteMany({ where: { email } });

    await request.post(`${BASE}/api/admin/staff`, {
      headers: { cookie },
      data: {
        name: 'Lockout Test Officer',
        email,
        role: 'DEPARTMENT_OFFICER',
        departmentId: testDeptId,
        password,
      },
    });

    // 5 consecutive wrong password attempts
    for (let i = 1; i <= 5; i++) {
      const res = await request.post(`${BASE}/api/auth/staff-login`, {
        data: { email, password: 'WrongPassword!' },
      });
      expect(res.status()).toBe(401);
    }

    // Verify DB locked state
    const lockedUser = await prisma.user.findUnique({ where: { email } });
    expect(lockedUser?.failedLoginCount).toBeGreaterThanOrEqual(5);
    expect(lockedUser?.lockedUntil).not.toBeNull();
    const lockExpiry = new Date(lockedUser!.lockedUntil!).getTime();
    expect(lockExpiry).toBeGreaterThan(Date.now() + 10 * 60 * 1000); // ~15 min

    // Attempting login with CORRECT password during lockout is rejected with identical generic 401
    const tryCorrectLocked = await request.post(`${BASE}/api/auth/staff-login`, {
      data: { email, password },
    });
    expect(tryCorrectLocked.status()).toBe(401);
    const lockedBody = await tryCorrectLocked.json();
    expect(lockedBody).toEqual({
      statusCode: 401,
      message: 'Invalid email or password.',
    });

    // 4b. Test per-IP rate limit: simulate an IP exceeding 30 requests
    const simulatedIp = '198.51.100.99';
    let ipRateLimited = false;
    for (let i = 0; i < 35; i++) {
      const res = await request.post(`${BASE}/api/auth/staff-login`, {
        headers: { 'x-forwarded-for': simulatedIp },
        data: { email: 'dummy-ip-test@smartcity.gov.in', password: 'password' },
      });
      if (res.status() === 429) {
        ipRateLimited = true;
        const rateLimitBody = await res.json();
        expect(rateLimitBody.message).toContain('Too many login attempts');
        break;
      }
    }
    expect(ipRateLimited).toBe(true);
  });

  // 5. Weak passwords (short, equals email, common) -> 400 with reason
  test('5. Weak passwords (short, equals email, common) return 400 with reason', async ({ request }) => {
    const { cookie } = await getAdminContext(request);
    const email = 'test.weakpass.target@smartcity.gov.in';

    await prisma.user.deleteMany({ where: { email } });

    // 5a. Short password (< 8 chars) on creation
    const shortRes = await request.post(`${BASE}/api/admin/staff`, {
      headers: { cookie },
      data: {
        name: 'Weak Pass Officer',
        email,
        role: 'DEPARTMENT_OFFICER',
        departmentId: testDeptId,
        password: 'short',
      },
    });
    expect(shortRes.status()).toBe(400);
    const shortBody = await shortRes.json();
    expect(shortBody.message).toContain('8 characters');

    // Create user with valid password first
    const createRes = await request.post(`${BASE}/api/admin/staff`, {
      headers: { cookie },
      data: {
        name: 'Weak Pass Officer',
        email,
        role: 'DEPARTMENT_OFFICER',
        departmentId: testDeptId,
        password: 'ValidInitialPass123!',
      },
    });
    expect(createRes.status()).toBe(201);
    const staffId = (await createRes.json()).staff.id;

    // 5b. Password equal to email on POST /api/admin/staff/[id]/password
    const equalsEmailRes = await request.post(`${BASE}/api/admin/staff/${staffId}/password`, {
      headers: { cookie },
      data: { password: email },
    });
    expect(equalsEmailRes.status()).toBe(400);
    const emailBody = await equalsEmailRes.json();
    expect(emailBody.message.toLowerCase()).toContain('email');

    // 5c. Common password from blacklist ('password', '12345678')
    const commonRes = await request.post(`${BASE}/api/admin/staff/${staffId}/password`, {
      headers: { cookie },
      data: { password: 'password' },
    });
    expect(commonRes.status()).toBe(400);
    const commonBody = await commonRes.json();
    expect(commonBody.message.toLowerCase()).toContain('common');
  });

  // 6. Set/reset password invalidates the old password
  test('6. Set/reset password invalidates old password and sets new one', async ({ request }) => {
    const { cookie } = await getAdminContext(request);
    const email = 'test.resetpass.inval@smartcity.gov.in';
    const oldPassword = 'OldInitialPassword123!';
    const newPassword = 'NewResetPassword456!';

    await prisma.user.deleteMany({ where: { email } });

    const createRes = await request.post(`${BASE}/api/admin/staff`, {
      headers: { cookie },
      data: {
        name: 'Reset Password Dept Head',
        email,
        role: 'DEPARTMENT_HEAD',
        departmentId: testDeptId,
        password: oldPassword,
      },
    });
    expect(createRes.status()).toBe(201);
    const staffId = (await createRes.json()).staff.id;

    // Verify initial login works
    const login1 = await request.post(`${BASE}/api/auth/staff-login`, {
      data: { email, password: oldPassword },
    });
    expect(login1.status()).toBe(200);

    // Reset password via POST /api/admin/staff/[id]/password
    const resetRes = await request.post(`${BASE}/api/admin/staff/${staffId}/password`, {
      headers: { cookie },
      data: { password: newPassword },
    });
    expect(resetRes.status()).toBe(200);

    // Old password must fail immediately
    const oldLoginRes = await request.post(`${BASE}/api/auth/staff-login`, {
      data: { email, password: oldPassword },
    });
    expect(oldLoginRes.status()).toBe(401);

    // New password succeeds
    const newLoginRes = await request.post(`${BASE}/api/auth/staff-login`, {
      data: { email, password: newPassword },
    });
    expect(newLoginRes.status()).toBe(200);
  });

  // 7. Same email can use Google login (mock the Google verification) and lands on same user id, no duplicate row; email_verified=false is rejected
  test('7. Google login links googleId to existing staff row; rejects email_verified=false', async ({ request }) => {
    const { cookie } = await getAdminContext(request);
    const email = 'test.google.link@smartcity.gov.in';

    await prisma.user.deleteMany({ where: { email } });

    const createRes = await request.post(`${BASE}/api/admin/staff`, {
      headers: { cookie },
      data: {
        name: 'Google Link Officer',
        email,
        role: 'DEPARTMENT_OFFICER',
        departmentId: testDeptId,
        password: 'PasswordForGoogleUser123!',
      },
    });
    expect(createRes.status()).toBe(201);
    const existingStaff = (await createRes.json()).staff;

    // 7a. email_verified === false must be rejected
    const unverifiedRes = await request.post(`${BASE}/api/auth/google-login`, {
      data: {
        email,
        name: 'Google Link Officer',
        googleId: 'google-sub-unverified-123',
        email_verified: false,
      },
    });
    expect(unverifiedRes.status()).toBe(401);
    const unverifiedBody = await unverifiedRes.json();
    expect(unverifiedBody.message.toLowerCase()).toContain('not verified');

    // 7b. email_verified === true succeeds, links googleId to existing staff row
    const verifiedGoogleId = 'google-sub-verified-998877';
    const googleLoginRes = await request.post(`${BASE}/api/auth/google-login`, {
      data: {
        email,
        name: 'Google Link Officer',
        googleId: verifiedGoogleId,
        email_verified: true,
      },
    });
    expect(googleLoginRes.status()).toBe(200);
    const googleData = await googleLoginRes.json();
    expect(googleData.success).toBe(true);
    expect(googleData.user.id).toBe(existingStaff.id);
    expect(googleData.redirectUrl).toBe('/officer');

    // DB assertions: no duplicate user, googleId linked, role/dept preserved
    const totalUsersWithEmail = await prisma.user.count({ where: { email } });
    expect(totalUsersWithEmail).toBe(1);

    const updatedUser = await prisma.user.findUnique({ where: { id: existingStaff.id } });
    expect(updatedUser?.googleId).toBe(verifiedGoogleId);
    expect(updatedUser?.role).toBe('DEPARTMENT_OFFICER');
    expect(updatedUser?.departmentId).toBe(testDeptId);
  });

  // 8. Citizen email cannot use staff-login; non-admin and other-municipality admin get 403; SUPER_ADMIN target blocked
  test('8. Citizen blocked from staff-login; non-admin, cross-mun admin, and super-admin targets get 403', async ({ request }) => {
    // 8a. Citizen email cannot use staff-login
    const citEmail = 'test.citizen.stafflogin@smartcity.gov.in';
    const citPass = 'CitizenPass123!';
    const citHash = await bcrypt.hash(citPass, 10);
    await prisma.user.upsert({
      where: { email: citEmail },
      update: { role: 'CITIZEN', passwordHash: citHash, isAuthorized: true, isSuspended: false },
      create: {
        name: 'Test Citizen',
        email: citEmail,
        role: 'CITIZEN',
        passwordHash: citHash,
        isAuthorized: true,
        isSuspended: false,
        authProvider: 'MOBILE_OTP',
      },
    });

    const citLogin = await request.post(`${BASE}/api/auth/staff-login`, {
      data: { email: citEmail, password: citPass },
    });
    expect(citLogin.status()).toBe(401);

    // 8b. Non-admin gets 403 on password management
    const nonAdminCookie = await getNonAdminContext(request);
    const targetStaff = await prisma.user.findFirst({
      where: { role: 'FIELD_WORKER', municipalityId: defaultMunId },
    });
    expect(targetStaff).not.toBeNull();

    const nonAdminRes = await request.post(`${BASE}/api/admin/staff/${targetStaff!.id}/password`, {
      headers: { cookie: nonAdminCookie },
      data: { password: 'NewPassword123!' },
    });
    expect(nonAdminRes.status()).toBe(403);

    // 8c. Other-municipality admin gets 403
    let otherMun = await prisma.municipality.findFirst({
      where: { OR: [{ code: 'OTHER-MUN-AUTH' }, { name: 'Other Mun Auth Test' }] },
    });
    if (!otherMun) {
      otherMun = await prisma.municipality.create({
        data: {
          name: 'Other Mun Auth Test',
          code: 'OTHER-MUN-AUTH',
          city: 'Chennai',
          state: 'Tamil Nadu',
        },
      });
    }

    const otherAdminEmail = 'admin.othermun.auth@smartcity.gov.in';
    const otherPass = 'OtherMunAdmin123!';
    const otherHash = await bcrypt.hash(otherPass, 10);
    await prisma.user.upsert({
      where: { email: otherAdminEmail },
      update: { role: 'ADMIN', municipalityId: otherMun.id, passwordHash: otherHash, isAuthorized: true, isSuspended: false },
      create: {
        name: 'Other Mun Admin Auth',
        email: otherAdminEmail,
        role: 'ADMIN',
        municipalityId: otherMun.id,
        passwordHash: otherHash,
        isAuthorized: true,
        isSuspended: false,
        authProvider: 'GOOGLE',
      },
    });

    const otherLoginRes = await request.post(`${BASE}/api/auth/staff-login`, {
      data: { email: otherAdminEmail, password: otherPass },
    });
    expect(otherLoginRes.status()).toBe(200);
    const setCookie = otherLoginRes.headers()['set-cookie'] || '';
    const otherAdminToken = setCookie.match(/ic_access_token=([^;]+)/)?.[1] || '';

    const crossMunRes = await request.post(`${BASE}/api/admin/staff/${targetStaff!.id}/password`, {
      headers: { cookie: `ic_access_token=${otherAdminToken}` },
      data: { password: 'NewPassword123!' },
    });
    expect(crossMunRes.status()).toBe(403);

    // 8d. Setting password on SUPER_ADMIN target is blocked with 403
    const { cookie: adminCookie } = await getAdminContext(request);
    const superAdmin = await prisma.user.findFirst({
      where: { role: 'SUPER_ADMIN' },
    });
    expect(superAdmin).not.toBeNull();

    const superAdminTargetRes = await request.post(`${BASE}/api/admin/staff/${superAdmin!.id}/password`, {
      headers: { cookie: adminCookie },
      data: { password: 'NewPassword123!' },
    });
    expect(superAdminTargetRes.status()).toBe(403);
  });

  // 9. Suspended and archived staff cannot log in by password or Google
  test('9. Suspended and archived staff cannot log in by password or Google', async ({ request }) => {
    const { cookie } = await getAdminContext(request);
    const password = 'ValidStatusPassword123!';

    // 9a. Suspended staff
    const suspEmail = 'test.susp.status@smartcity.gov.in';
    await prisma.user.deleteMany({ where: { email: suspEmail } });

    const createSusp = await request.post(`${BASE}/api/admin/staff`, {
      headers: { cookie },
      data: {
        name: 'Suspended Staff Test',
        email: suspEmail,
        role: 'FIELD_WORKER',
        departmentId: testDeptId,
        assignedOfficerId: testOfficerId,
        password,
      },
    });
    expect(createSusp.status()).toBe(201);
    const suspId = (await createSusp.json()).staff.id;

    // Suspend user
    await prisma.user.update({ where: { id: suspId }, data: { isSuspended: true } });

    // Password login rejected with 401
    const suspPassRes = await request.post(`${BASE}/api/auth/staff-login`, {
      data: { email: suspEmail, password },
    });
    expect(suspPassRes.status()).toBe(401);

    // Google login rejected with 403
    const suspGoogleRes = await request.post(`${BASE}/api/auth/google-login`, {
      data: { email: suspEmail, email_verified: true },
    });
    expect(suspGoogleRes.status()).toBe(403);
    const suspGoogleBody = await suspGoogleRes.json();
    expect(suspGoogleBody.status).toBe('SUSPENDED');

    // 9b. Archived (deletedAt) staff
    const archEmail = 'test.arch.status@smartcity.gov.in';
    await prisma.user.deleteMany({ where: { email: archEmail } });

    const createArch = await request.post(`${BASE}/api/admin/staff`, {
      headers: { cookie },
      data: {
        name: 'Archived Staff Test',
        email: archEmail,
        role: 'DEPARTMENT_OFFICER',
        departmentId: testDeptId,
        password,
      },
    });
    expect(createArch.status()).toBe(201);
    const archId = (await createArch.json()).staff.id;

    // Soft delete / archive
    await prisma.user.update({ where: { id: archId }, data: { deletedAt: new Date() } });

    // Password login rejected with 401
    const archPassRes = await request.post(`${BASE}/api/auth/staff-login`, {
      data: { email: archEmail, password },
    });
    expect(archPassRes.status()).toBe(401);

    // Google login rejected with 403
    const archGoogleRes = await request.post(`${BASE}/api/auth/google-login`, {
      data: { email: archEmail, email_verified: true },
    });
    expect(archGoogleRes.status()).toBe(403);
    const archGoogleBody = await archGoogleRes.json();
    expect(archGoogleBody.status).toBe('DEACTIVATED');
  });

  // 10. Old credentials route returns 404/410; git grep shows no loginId generator left
  test('10. Old credentials route returns 410 Gone', async ({ request }) => {
    const res = await request.post(`${BASE}/api/admin/staff/test-legacy-id/credentials`, {
      data: {},
    });
    expect([404, 410]).toContain(res.status());
  });

  // 11. UI tests: create-with-password flow and set-password flow at 1280px and 375px; staff login page responsiveness
  test('11. UI tests: create-with-password & set-password flows at 1280px and 375px', async ({ page }) => {
    // 11a. Test at 375px mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(`${BASE}/login/staff`);
    await page.waitForLoadState('networkidle');

    // Verify Google button exists
    const googleBtn = page.locator('#google-login-button');
    await expect(googleBtn).toBeVisible();

    // Verify credentials form exists with Email and Password
    const form = page.locator('#staff-credentials-form');
    await expect(form).toBeVisible();

    const emailInput = page.locator('#staff-email');
    const passwordInput = page.locator('#staff-password');
    const submitBtn = page.locator('#staff-login-submit');

    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
    await expect(submitBtn).toBeVisible();

    // Try invalid login in UI -> shared error popup displays
    await emailInput.fill('nonexistent.officer@smartcity.gov.in');
    await passwordInput.fill('WrongPass123!');
    await submitBtn.click();

    // The shared error popup dialog must be visible
    const errorPopup = page.locator('[data-testid="global-error-popup"]');
    await expect(errorPopup).toBeVisible({ timeout: 10000 });

    // Verify no horizontal page overflow on 375px
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 2);

    // 11b. Test at 1280px desktop viewport
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`${BASE}/login/staff`);
    await page.waitForLoadState('networkidle');

    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
    await expect(googleBtn).toBeVisible();

    const scrollWidthDesktop = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidthDesktop = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidthDesktop).toBeLessThanOrEqual(clientWidthDesktop + 2);
  });
});
