import { test, expect } from '@playwright/test';
import { SignJWT } from 'jose';
import prisma from '../src/lib/prisma';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'intellicivic-dev-jwt-secret-key-32bytes!');

async function createAdminJwt() {
  const admin = await prisma.user.findFirst({
    where: { role: 'SUPER_ADMIN', isSuspended: false },
  });
  return new SignJWT({
    sub: admin?.id || '7f76b615-8e8e-402d-9a5c-b1a7fa4e1726',
    role: 'SUPER_ADMIN',
    email: admin?.email || 'superadmin.test@smartcity.gov.in',
    name: admin?.name || 'Super Admin',
    isAuthorized: true,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('2h')
    .sign(JWT_SECRET);
}

async function createCitizenJwt(userId: string, mobileNumber: string) {
  return new SignJWT({
    sub: userId,
    role: 'CITIZEN',
    mobileNumber,
    name: 'Test Citizen',
    isProfileComplete: true,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('2h')
    .sign(JWT_SECRET);
}

test.describe.serial('Citizen Delete & Restore Flow Suite', () => {
  const timestamp = Date.now();
  const testMobile = `98${String(timestamp).slice(-8)}`; // Unique 10-digit mobile number
  let testCitizenId: string;
  let testComplaintTicketId: string;

  test.beforeAll(async () => {
    // Ensure municipality and category exist
    const municipality = await prisma.municipality.upsert({
      where: { code: 'TEST_MC' },
      update: {},
      create: {
        name: 'Test City Municipal Corp',
        code: 'TEST_MC',
        city: 'Test City',
        state: 'Test State',
      },
    });

    const category = await prisma.category.findFirst() || await prisma.category.create({
      data: {
        name: 'Road Infrastructure',
        description: 'Roads, potholes, and pavements',
        slaHours: 48,
      },
    });

    // 1. Create a citizen with complete profile and one complaint
    const citizen = await prisma.user.create({
      data: {
        mobileNumber: testMobile,
        name: 'Test Citizen Deletable',
        email: `citizen.${timestamp}@smartcity.test`,
        address: '123 Civil Lines, Test City',
        role: 'CITIZEN',
        authProvider: 'MOBILE_OTP',
        isAuthorized: true,
        isSuspended: false,
        municipalityId: municipality.id,
      },
    });
    testCitizenId = citizen.id;

    const complaint = await prisma.complaint.create({
      data: {
        ticketId: `TCK-${timestamp}`,
        title: 'Pothole in front of community center',
        description: 'Deep pothole causing accidents during rain.',
        citizenId: citizen.id,
        status: 'SUBMITTED',
        priority: 'MEDIUM',
        categoryId: category.id,
        municipalityId: municipality.id,
      },
    });
    testComplaintTicketId = complaint.ticketId;
  });

  test.afterAll(async () => {
    try {
      // Clean up test data
      await prisma.complaint.deleteMany({ where: { citizenId: testCitizenId } });
      await prisma.user.deleteMany({ where: { id: testCitizenId } });
    } catch (e) {
      // Ignore cleanup errors
    }
  });

  test('1. Admin deletes citizen -> login blocked with exact 403 message', async ({ request, page, context }) => {
    const adminToken = await createAdminJwt();

    // 1. Admin deletes citizen via DELETE endpoint
    const deleteRes = await request.delete(`http://localhost:3000/api/admin/citizens/${testCitizenId}`, {
      headers: {
        Cookie: `ic_access_token=${adminToken}`,
      },
    });
    expect(deleteRes.status()).toBe(200);

    // Verify row is soft-deleted in DB: deletedAt is set, row and complaint still exist
    const dbCitizen = await prisma.user.findUnique({ where: { id: testCitizenId } });
    expect(dbCitizen?.deletedAt).not.toBeNull();
    expect(dbCitizen?.isSuspended).toBe(true);

    const dbComplaint = await prisma.complaint.findFirst({ where: { citizenId: testCitizenId } });
    expect(dbComplaint?.ticketId).toBe(testComplaintTicketId);

    // 2. Same number tries OTP login via UI
    await page.goto('/login/citizen');
    await page.fill('#mobileNumber', testMobile);
    await page.click('button[type="submit"]');

    await expect(page.getByText('Enter 6-Digit OTP')).toBeVisible();

    // Fill OTP digits (123456)
    const inputs = page.locator('input[aria-label^="Digit"]');
    for (let i = 0; i < 6; i++) {
      await inputs.nth(i).fill(String(i + 1));
    }

    await page.click('button[type="submit"]');

    // Expected: verify-otp returns 403 with exact text and UI displays it
    const expectedMsg = 'Your account has been deactivated by the administrator. Please contact support.';
    await expect(page.getByText(expectedMsg).first()).toBeVisible({ timeout: 5000 });
  });

  test('2. Admin Citizens list: Deleted filter and search-by-mobile finds the user', async ({ page, context }) => {
    // Ensure testCitizen is in soft-deleted state
    await prisma.user.update({
      where: { id: testCitizenId },
      data: { isSuspended: true, suspendedAt: new Date(), deletedAt: new Date() },
    });

    const adminToken = await createAdminJwt();
    await context.addCookies([
      {
        name: 'ic_access_token',
        value: adminToken,
        domain: 'localhost',
        path: '/',
      },
    ]);

    await page.goto('/admin/users/citizens');
    await page.waitForLoadState('networkidle');

    // Click "DELETED" status filter tab
    await page.click('button:has-text("DELETED")');

    // Search by mobile number
    await page.fill('input[placeholder*="Search"]', testMobile);
    await page.waitForTimeout(500); // debounce

    // The deleted citizen row must appear
    const userRow = page.locator('tr').filter({ hasText: testMobile.slice(0, 5) });
    await expect(userRow).toBeVisible();
    await expect(userRow.locator('text=Deleted')).toBeVisible();

    // The row must show a "Restore" button with confirm dialog
    const restoreBtn = userRow.locator('button:has-text("Restore")');
    await expect(restoreBtn).toBeVisible();
  });

  test('3. Restore API: admin restores citizen -> login succeeds and old complaint is visible', async ({ request, page, context }) => {
    const adminToken = await createAdminJwt();

    // Restore via Restore API
    const restoreRes = await request.post(`http://localhost:3000/api/admin/citizens/${testCitizenId}/restore`, {
      headers: {
        Cookie: `ic_access_token=${adminToken}`,
      },
    });
    expect(restoreRes.status()).toBe(200);

    // Verify DB: deletedAt is null, isSuspended is false
    const restoredDb = await prisma.user.findUnique({ where: { id: testCitizenId } });
    expect(restoredDb?.deletedAt).toBeNull();
    expect(restoredDb?.isSuspended).toBe(false);

    // Verify Audit Log was recorded
    const auditLog = await prisma.auditLog.findFirst({
      where: {
        entityId: testCitizenId,
        action: 'CITIZEN_RESTORE',
      },
    });
    expect(auditLog).not.toBeNull();

    // Now citizen logs in via UI
    await context.clearCookies();
    await page.goto('/login/citizen');
    await page.fill('#mobileNumber', testMobile);
    await page.click('button[type="submit"]');

    await expect(page.getByText('Enter 6-Digit OTP')).toBeVisible();

    const inputs = page.locator('input[aria-label^="Digit"]');
    for (let i = 0; i < 6; i++) {
      await inputs.nth(i).fill(String(i + 1));
    }
    await page.click('button[type="submit"]');

    // Must redirect to /citizen dashboard
    await page.waitForURL(/\/citizen/, { timeout: 10000 });
    await expect(page.getByText('Welcome to Citizen Portal')).toBeVisible({ timeout: 10000 });

    // Old complaint must be visible
    await expect(page.getByText(testComplaintTicketId)).toBeVisible({ timeout: 10000 });
  });

  test('4. Restore API is idempotent (restore twice returns 200)', async ({ request }) => {
    const adminToken = await createAdminJwt();

    // Second restore call on already-active citizen
    const res = await request.post(`http://localhost:3000/api/admin/citizens/${testCitizenId}/restore`, {
      headers: {
        Cookie: `ic_access_token=${adminToken}`,
      },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  test('5. Non-admin restore returns 401/403 and unknown id returns 404', async ({ request }) => {
    const citizenToken = await createCitizenJwt(testCitizenId, testMobile);

    // 1. Unauthenticated -> 401
    const unauthRes = await request.post(`http://localhost:3000/api/admin/citizens/${testCitizenId}/restore`);
    expect(unauthRes.status()).toBe(401);

    // 2. Non-admin (Citizen token) -> 403
    const forbiddenRes = await request.post(`http://localhost:3000/api/admin/citizens/${testCitizenId}/restore`, {
      headers: {
        Cookie: `ic_access_token=${citizenToken}`,
      },
    });
    expect(forbiddenRes.status()).toBe(403);

    // 3. Admin restores unknown ID -> 404
    const adminToken = await createAdminJwt();
    const notFoundRes = await request.post('http://localhost:3000/api/admin/citizens/unknown-id-000-000/restore', {
      headers: {
        Cookie: `ic_access_token=${adminToken}`,
      },
    });
    expect(notFoundRes.status()).toBe(404);
  });

  test('6. Deleted citizen existing session/JWT stops working immediately', async ({ request }) => {
    const adminToken = await createAdminJwt();
    const citizenToken = await createCitizenJwt(testCitizenId, testMobile);

    // First delete the citizen again
    await request.delete(`http://localhost:3000/api/admin/citizens/${testCitizenId}`, {
      headers: { Cookie: `ic_access_token=${adminToken}` },
    });

    // Attempt protected citizen API request with existing JWT
    const profileRes = await request.get('http://localhost:3000/api/citizen/profile', {
      headers: { Cookie: `ic_access_token=${citizenToken}` },
    });
    expect(profileRes.status()).toBe(403);

    const complaintsRes = await request.get('http://localhost:3000/api/complaints', {
      headers: { Cookie: `ic_access_token=${citizenToken}` },
    });
    expect(complaintsRes.status()).toBe(403);
  });

  test('7. Number with NO row logs in as a brand-new citizen', async ({ request }) => {
    const brandNewMobile = `91${String(Date.now()).slice(-8)}`;

    // Verify no row in DB
    const existing = await prisma.user.findFirst({ where: { mobileNumber: brandNewMobile } });
    expect(existing).toBeNull();

    // 1. Send OTP
    const sendRes = await request.post('http://localhost:3000/api/auth/send-otp', {
      data: { mobileNumber: brandNewMobile },
    });
    expect(sendRes.status()).toBe(200);

    // 2. Verify OTP
    const verifyRes = await request.post('http://localhost:3000/api/auth/verify-otp', {
      data: { mobileNumber: brandNewMobile, otp: '123456' },
    });
    expect(verifyRes.status()).toBe(200);
    const body = await verifyRes.json();
    expect(body.success).toBe(true);
    expect(body.isFirstTime).toBe(true);

    // Verify row was created in DB as clean citizen
    const newDbUser = await prisma.user.findFirst({ where: { mobileNumber: brandNewMobile } });
    expect(newDbUser).not.toBeNull();
    expect(newDbUser?.role).toBe('CITIZEN');
    expect(newDbUser?.isSuspended).toBe(false);
    expect(newDbUser?.deletedAt).toBeNull();

    // Clean up
    if (newDbUser) {
      await prisma.user.delete({ where: { id: newDbUser.id } });
    }
  });
});
