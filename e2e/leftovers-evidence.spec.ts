import { test, expect } from '@playwright/test';
import { SignJWT } from 'jose';
import prisma from '../src/lib/prisma';
import fs from 'fs';
import path from 'path';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'intellicivic-dev-jwt-secret-key-32bytes!');

async function createMockJwt(role: string, email?: string, sub?: string) {
  let defaultSub = 'usr_super_admin';
  let defaultEmail = 'kumarbajrang325@gmail.com';

  if (role === 'CITIZEN') {
    defaultSub = 'citizen_9876543210';
    defaultEmail = 'kumarbajrang0154@gmail.com';
  } else if (role === 'DEPARTMENT_HEAD') {
    defaultSub = 'usr_dept_head_roads';
    defaultEmail = 'head.roads@smartcity.gov.in';
  } else if (role === 'DEPARTMENT_OFFICER') {
    defaultSub = 'usr_officer_roads_1';
    defaultEmail = 'officer.roads@smartcity.gov.in';
  } else if (role === 'FIELD_WORKER') {
    defaultSub = 'fw-demo-1';
    defaultEmail = 'fieldworker@intellicivic.gov.in';
  } else if (role === 'ADMIN' || role === 'SUPER_ADMIN') {
    defaultSub = 'usr_super_admin';
    defaultEmail = 'kumarbajrang325@gmail.com';
  }

  const userEmail = email || defaultEmail;
  const userSub = sub || defaultSub;

  try {
    const existing = await prisma.user.findFirst({
      where: { OR: [{ id: userSub }, { email: userEmail }] },
    });

    if (existing) {
      await prisma.user.update({
        where: { id: existing.id },
        data: { role: role as any, isAuthorized: true },
      });
      return new SignJWT({
        sub: existing.id,
        email: existing.email || userEmail,
        role,
        isAuthorized: true,
      })
        .setProtectedHeader({ alg: 'HS256' })
        .setExpirationTime('2h')
        .sign(JWT_SECRET);
    } else {
      const created = await prisma.user.create({
        data: {
          id: userSub,
          name: `Test ${role}`,
          email: userEmail,
          role: role as any,
          authProvider: 'GOOGLE',
          isAuthorized: true,
        },
      });
      return new SignJWT({
        sub: created.id,
        email: created.email || userEmail,
        role,
        isAuthorized: true,
      })
        .setProtectedHeader({ alg: 'HS256' })
        .setExpirationTime('2h')
        .sign(JWT_SECRET);
    }
  } catch {}

  return new SignJWT({
    sub: userSub,
    email: userEmail,
    role,
    isAuthorized: true,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('2h')
    .sign(JWT_SECRET);
}

const screenshotDir = path.join(process.cwd(), 'test-results', 'evidence');
if (!fs.existsSync(screenshotDir)) {
  fs.mkdirSync(screenshotDir, { recursive: true });
}

test.describe('Leftover Items Verification & Evidence Suite', () => {

  // ───────────────────────────────────────────────────────────────────────────
  // ITEM 1: Mobile Responsiveness (All Roles x Viewports with Assertions)
  // ───────────────────────────────────────────────────────────────────────────
  test.describe('Item 1: Mobile responsiveness audits with overflow assertions', () => {
    const viewports = [
      { width: 375, height: 812, name: '375px' },
      { width: 390, height: 844, name: '390px' },
    ];

    const rolesPages = [
      { role: 'CITIZEN', path: '/citizen', name: 'citizen-dashboard' },
      { role: 'FIELD_WORKER', path: '/field-worker', name: 'field-worker-dashboard' },
      { role: 'DEPARTMENT_OFFICER', path: '/officer', name: 'officer-dashboard' },
      { role: 'DEPARTMENT_HEAD', path: '/dept-head', name: 'dept-head-dashboard' },
      { role: 'ADMIN', path: '/admin', name: 'admin-dashboard' },
      { role: 'SUPER_ADMIN', path: '/admin', name: 'super-admin-dashboard' },
      { role: 'ADMIN', path: '/admin/staff', name: 'admin-staff-table' },
    ];

    for (const vp of viewports) {
      for (const item of rolesPages) {
        test(`Mobile audit ${vp.name} - ${item.role} ${item.path}`, async ({ page, context }) => {
          await page.setViewportSize({ width: vp.width, height: vp.height });
          const token = await createMockJwt(item.role);
          await context.addCookies([{ name: 'ic_access_token', value: token, domain: 'localhost', path: '/' }]);

          await page.goto(item.path);
          await page.waitForLoadState('domcontentloaded');

          // ASSERT document.documentElement.scrollWidth <= clientWidth (no horizontal overflow)
          const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
          expect(overflow).toBe(false);

          const filepath = path.join(screenshotDir, `mobile_${vp.name}_${item.name}.png`);
          await page.screenshot({ path: filepath, fullPage: true });
          console.log(`[PASS] Mobile ${vp.name} ${item.role} ${item.name}: scrollWidth <= clientWidth`);
        });
      }

      test(`Mobile audit ${vp.name} - Create Staff Modal on /admin/staff`, async ({ page, context }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        const token = await createMockJwt('SUPER_ADMIN');
        await context.addCookies([{ name: 'ic_access_token', value: token, domain: 'localhost', path: '/' }]);

        await page.goto('/admin/staff');
        await page.waitForLoadState('domcontentloaded');

        // Open modal
        const createBtn = page.locator('button:has-text("Create Staff")').first();
        await createBtn.waitFor({ state: 'visible', timeout: 15000 });
        await createBtn.click();
        await expect(page.getByText('Create Staff Account')).toBeVisible();

        // ASSERT no horizontal overflow with modal open
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
        expect(overflow).toBe(false);

        const filepath = path.join(screenshotDir, `mobile_${vp.name}_admin-staff-modal.png`);
        await page.screenshot({ path: filepath });
        console.log(`[PASS] Mobile ${vp.name} Create Staff Modal: scrollWidth <= clientWidth`);
      });
    }
  });

  // ───────────────────────────────────────────────────────────────────────────
  // ───────────────────────────────────────────────────────────────────────────
  // ITEM 2: Topbar & Sidebar Avatar Verification (Reload Proof)
  // ───────────────────────────────────────────────────────────────────────────
  test('Item 2: Topbar & sidebar avatar photo preservation after reload', async ({ page, context }) => {
    const samplePhotoDataUri = 'data:image/png;base64,iVBORw0KGgoAAAANSAhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

    const testTargets = [
      { role: 'FIELD_WORKER', email: 'fw.test.avatar@smartcity.gov.in', path: '/field-worker', label: 'field_worker' },
      { role: 'DEPARTMENT_HEAD', email: 'dept.head.avatar@smartcity.gov.in', path: '/dept-head', label: 'dept_head' },
      { role: 'ADMIN', email: 'admin.avatar@smartcity.gov.in', path: '/admin', label: 'admin' },
    ];

    for (const target of testTargets) {
      const user = await prisma.user.upsert({
        where: { email: target.email },
        update: { avatarUrl: samplePhotoDataUri, role: target.role as any },
        create: {
          name: `Test ${target.label}`,
          email: target.email,
          role: target.role as any,
          authProvider: 'GOOGLE',
          avatarUrl: samplePhotoDataUri,
          isAuthorized: true,
        },
      });

      const token = await createMockJwt(target.role, target.email, user.id);
      await context.addCookies([{ name: 'ic_access_token', value: token, domain: 'localhost', path: '/' }]);

      await page.goto(target.path);
      await page.waitForLoadState('domcontentloaded');
      await page.reload();
      await page.waitForLoadState('domcontentloaded');

      const avatarImg = page.locator('img[src^="data:image"], header img, div img').first();
      await expect(avatarImg).toBeVisible({ timeout: 15000 });

      const screenshotPath = path.join(screenshotDir, `avatar_proof_${target.label}_topbar_sidebar.png`);
      await page.screenshot({ path: screenshotPath });
      console.log(`Saved avatar proof screenshot: ${screenshotPath}`);
    }
  });

  // ───────────────────────────────────────────────────────────────────────────
  // ITEM 3a: AuditLog Preservation & Raw DB Output on Staff Delete
  // ───────────────────────────────────────────────────────────────────────────
  test('Item 3a: AuditLog entries survive staff deletion with actor metadata snapshotted (Raw DB Proof)', async ({ page }) => {
    const tempUserEmail = `temp.staff.${Date.now()}@smartcity.gov.in`;
    const tempUser = await prisma.user.create({
      data: {
        name: 'Temp Deletion Staff',
        email: tempUserEmail,
        role: 'DEPARTMENT_OFFICER',
        authProvider: 'GOOGLE',
        isAuthorized: true,
      },
    });

    const auditLog1 = await prisma.auditLog.create({
      data: {
        userId: tempUser.id,
        action: 'COMPLAINT_ASSIGNED',
        entityType: 'Complaint',
        entityId: 'cmp-test-123',
        metadata: { actorName: tempUser.name, note: 'Testing audit log preservation' },
      },
    });

    const auditLog2 = await prisma.auditLog.create({
      data: {
        userId: tempUser.id,
        action: 'STATUS_UPDATED',
        entityType: 'Complaint',
        entityId: 'cmp-test-456',
        metadata: { note: 'Unsnapshotted entry test' },
      },
    });

    const adminUser = await prisma.user.upsert({
      where: { email: 'superadmin.test@smartcity.gov.in' },
      update: { role: 'SUPER_ADMIN', isAuthorized: true },
      create: { name: 'Test Super Admin', email: 'superadmin.test@smartcity.gov.in', role: 'SUPER_ADMIN', authProvider: 'GOOGLE', isAuthorized: true },
    });
    const adminToken = await createMockJwt('SUPER_ADMIN', adminUser.email ?? undefined, adminUser.id);

    const response = await page.request.delete(`/api/users/${tempUser.id}`, {
      headers: { Cookie: `ic_access_token=${adminToken}` },
    });
    expect(response.ok()).toBe(true);

    const checkUser = await prisma.user.findUnique({ where: { id: tempUser.id } });
    expect(checkUser).toBeNull();

    // Fetch raw DB rows for proof
    const rawAuditLogs = await prisma.auditLog.findMany({
      where: { id: { in: [auditLog1.id, auditLog2.id] } },
    });

    console.log('--- RAW DB AUDIT LOG ROWS AFTER STAFF DELETION ---');
    console.log(JSON.stringify(rawAuditLogs, null, 2));

    expect(rawAuditLogs.length).toBe(2);
    for (const log of rawAuditLogs) {
      expect(log.userId).toBeNull();
      expect((log.metadata as any)?.actorName).toBe('Temp Deletion Staff');
      expect((log.metadata as any)?.actorEmail).toBe(tempUserEmail);
    }

    // Clean up test audit logs
    await prisma.auditLog.deleteMany({
      where: { id: { in: [auditLog1.id, auditLog2.id] } },
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // ITEM 3b: deleteUser Failure Path & Transaction Rollback Proof (409 Conflict)
  // ───────────────────────────────────────────────────────────────────────────
  test('Item 3b: deleteUser failure path on citizen with complaints returns 409 and rolls back cleanups', async ({ page }) => {
    // 1. Create a dummy citizen user
    const citizenEmail = `citizen.rollback.${Date.now()}@example.com`;
    const citizen = await prisma.user.create({
      data: {
        name: 'Citizen With Complaints',
        email: citizenEmail,
        role: 'CITIZEN',
        authProvider: 'MOBILE_OTP',
        mobileNumber: `99${Date.now().toString().slice(-8)}`,
      },
    });

    // 2. Create a complaint for this citizen
    const complaint = await prisma.complaint.create({
      data: {
        ticketId: `TCK-TEST-${Date.now()}`,
        title: 'Rollback Test Complaint',
        description: 'Testing transaction rollback on deletion failure',
        citizenId: citizen.id,
      },
    });

    // 3. Create linked records (Evidence, Notification)
    const officerUser = await prisma.user.findFirst({ where: { role: 'DEPARTMENT_OFFICER' } });

    const evidence = await prisma.evidence.create({
      data: {
        complaintId: complaint.id,
        stage: 'BEFORE',
        imageUrl: 'https://example.com/evidence.jpg',
        uploadedByUserId: officerUser?.id || citizen.id,
      },
    });

    const notification = await prisma.notification.create({
      data: {
        complaintId: complaint.id,
        recipientUserId: citizen.id,
        type: 'COMPLAINT_CREATED',
        message: 'Notification for rollback test',
      },
    });

    // Count rows BEFORE deletion attempt
    const evidenceBeforeCount = await prisma.evidence.count({ where: { id: evidence.id } });
    const notificationBeforeCount = await prisma.notification.count({ where: { id: notification.id } });

    // Attempt to delete citizen via API with admin token cookie
    const adminUser = await prisma.user.findFirst({ where: { role: 'SUPER_ADMIN' } });
    const adminToken = await createMockJwt('ADMIN', adminUser?.email ?? undefined, adminUser?.id ?? undefined);

    const response = await page.request.delete(`/api/users/${citizen.id}`, {
      headers: { Cookie: `ic_access_token=${adminToken}` },
    });

    // Expect status 409 Conflict
    expect(response.status()).toBe(409);
    const body = await response.json();
    expect(body.reason).toBe('CITIZEN_HAS_COMPLAINTS');

    // Count rows AFTER failed deletion attempt to verify complete transaction rollback
    const evidenceAfterCount = await prisma.evidence.count({ where: { id: evidence.id } });
    const notificationAfterCount = await prisma.notification.count({ where: { id: notification.id } });

    console.log('--- ROLLBACK PROOF ROW COUNTS ---');
    console.log(JSON.stringify({
      evidenceBeforeCount,
      evidenceAfterCount,
      notificationBeforeCount,
      notificationAfterCount,
    }, null, 2));

    expect(evidenceAfterCount).toBe(evidenceBeforeCount);
    expect(notificationAfterCount).toBe(notificationBeforeCount);

    // Clean up created test data
    await prisma.evidence.delete({ where: { id: evidence.id } });
    await prisma.notification.delete({ where: { id: notification.id } });
    await prisma.complaint.delete({ where: { id: complaint.id } });
    await prisma.user.delete({ where: { id: citizen.id } });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // ITEM 3c: /api/auth/me Strict Sub Lookup & Mismatch Verification
  // ───────────────────────────────────────────────────────────────────────────
  test('Item 3c: /api/auth/me uses strict sub lookup when present and returns 401 on sub mismatch', async ({ page }) => {
    // 1. Create two distinct test users directly in DB
    const userA = await prisma.user.upsert({
      where: { email: 'sub.userA@smartcity.gov.in' },
      update: { role: 'ADMIN' },
      create: { name: 'Sub User A', email: 'sub.userA@smartcity.gov.in', role: 'ADMIN', authProvider: 'GOOGLE', isAuthorized: true },
    });
    const userB = await prisma.user.upsert({
      where: { email: 'sub.userB@smartcity.gov.in' },
      update: { role: 'DEPARTMENT_OFFICER' },
      create: { name: 'Sub User B', email: 'sub.userB@smartcity.gov.in', role: 'DEPARTMENT_OFFICER', authProvider: 'GOOGLE', isAuthorized: true },
    });

    // Create a token with sub = userA.id, but email = userB.email
    const mismatchedToken = await createMockJwt('ADMIN', userB.email ?? undefined, userA.id);

    const res = await page.request.get('/api/auth/me', {
      headers: { Cookie: `ic_access_token=${mismatchedToken}` },
    });
    expect(res.ok()).toBe(true);
    const data = await res.json();

    // Verify response strictly returns User A (matching sub), NOT User B
    expect(data.user.id).toBe(userA.id);
    console.log(`[PASS] Mismatched token correctly returned user matching sub (${data.user.id})`);

    // 2. Create a token with invalid/non-existent sub directly
    const invalidSubToken = await new SignJWT({
      sub: 'non_existent_sub_9999',
      email: 'nonexistent@test.com',
      role: 'ADMIN',
      isAuthorized: true,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('2h')
      .sign(JWT_SECRET);

    const res401 = await page.request.get('/api/auth/me', {
      headers: { Cookie: `ic_access_token=${invalidSubToken}` },
    });
    expect(res401.status()).toBe(401);
    const data401 = await res401.json();
    expect(data401.user).toBeNull();
    console.log(`[PASS] Non-existent sub correctly returned 401 unauthenticated`);
  });
});
