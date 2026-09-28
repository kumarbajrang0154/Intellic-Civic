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
  }

  return new SignJWT({
    sub: sub || defaultSub,
    email: email || defaultEmail,
    role,
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
  // ITEM 1: Mobile Responsiveness (All Portals)
  // ───────────────────────────────────────────────────────────────────────────
  test.describe('Item 1: Mobile responsiveness audits', () => {
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
      { role: 'ADMIN', path: '/admin/staff', name: 'admin-staff-table' },
    ];

    for (const vp of viewports) {
      for (const item of rolesPages) {
        test(`Mobile audit ${vp.name} - ${item.role} ${item.path}`, async ({ page, context }) => {
          await page.setViewportSize({ width: vp.width, height: vp.height });
          const token = await createMockJwt(item.role);
          await context.addCookies([{ name: 'ic_access_token', value: token, domain: 'localhost', path: '/' }]);

          await page.goto(item.path);
          await page.waitForLoadState('networkidle');

          const filepath = path.join(screenshotDir, `mobile_${vp.name}_${item.name}.png`);
          await page.screenshot({ path: filepath, fullPage: true });
          console.log(`Saved screenshot: ${filepath}`);
        });
      }

      test(`Mobile audit ${vp.name} - Create Staff Modal on /admin/staff`, async ({ page, context }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        const token = await createMockJwt('ADMIN');
        await context.addCookies([{ name: 'ic_access_token', value: token, domain: 'localhost', path: '/' }]);

        await page.goto('/admin/staff');
        await page.waitForLoadState('networkidle');

        // Open modal
        await page.click('button:has-text("Create Staff")');
        await expect(page.getByText('Create Staff Account')).toBeVisible();

        const filepath = path.join(screenshotDir, `mobile_${vp.name}_admin-staff-modal.png`);
        await page.screenshot({ path: filepath });
        console.log(`Saved screenshot: ${filepath}`);
      });
    }
  });

  // ───────────────────────────────────────────────────────────────────────────
  // ITEM 2: Topbar & Sidebar Avatar Verification
  // ───────────────────────────────────────────────────────────────────────────
  test('Item 2: Non-citizen & Citizen photo upload and topbar/sidebar rendering', async ({ page, context }) => {
    // 1. Upload photo for non-citizen role (DEPARTMENT_OFFICER)
    const officerToken = await createMockJwt('DEPARTMENT_OFFICER');
    await context.addCookies([{ name: 'ic_access_token', value: officerToken, domain: 'localhost', path: '/' }]);

    await page.goto('/officer/profile');
    await page.waitForLoadState('networkidle');

    // Sample data URI image
    const samplePhotoDataUri = 'data:image/png;base64,iVBORw0KGgoAAAANSAhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

    // Set avatar input & save
    await page.fill('input[placeholder="https://example.com/avatar.jpg"]', samplePhotoDataUri);
    await page.click('button:has-text("Save Profile")');
    await expect(page.getByText('Profile updated successfully!')).toBeVisible();

    // Reload page to verify topbar & sidebar retain avatar image
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Confirm image tag inside header & sidebar avatar container
    const headerAvatarImg = page.locator('header img').first();
    await expect(headerAvatarImg).toBeVisible();

    const officerScreenshotPath = path.join(screenshotDir, `avatar_proof_officer_topbar_sidebar.png`);
    await page.screenshot({ path: officerScreenshotPath });
    console.log(`Saved officer avatar screenshot: ${officerScreenshotPath}`);

    // 2. Upload photo for Citizen role
    const citizenToken = await createMockJwt('CITIZEN');
    await context.addCookies([{ name: 'ic_access_token', value: citizenToken, domain: 'localhost', path: '/' }]);

    await page.goto('/citizen/profile');
    await page.waitForLoadState('networkidle');

    await page.fill('input[placeholder="https://example.com/avatar.jpg"], input[name="avatarUrl"]', samplePhotoDataUri);
    await page.click('button:has-text("Save Profile"), button:has-text("Save Changes"), button[type="submit"]');

    await page.reload();
    await page.waitForLoadState('networkidle');

    const citizenHeaderImg = page.locator('header img').first();
    await expect(citizenHeaderImg).toBeVisible();

    const citizenScreenshotPath = path.join(screenshotDir, `avatar_proof_citizen_topbar_sidebar.png`);
    await page.screenshot({ path: citizenScreenshotPath });
    console.log(`Saved citizen avatar screenshot: ${citizenScreenshotPath}`);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // ITEM 3: AuditLog Preservation on Staff Delete
  // ───────────────────────────────────────────────────────────────────────────
  test('Item 3: AuditLog entries survive staff deletion with actor metadata snapshotted', async ({ context, page }) => {
    // 1. Create a dummy staff user directly in DB for testing deletion
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

    // 2. Create AuditLog entries attributed to this temp user
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

    // 3. Delete the staff member using deleteUser API via /api/admin/staff/[id]
    const adminToken = await createMockJwt('ADMIN');
    await context.addCookies([{ name: 'ic_access_token', value: adminToken, domain: 'localhost', path: '/' }]);

    const response = await page.request.delete(`/api/admin/staff/${tempUser.id}`);
    expect(response.ok()).toBe(true);

    // 4. Verify User is deleted
    const checkUser = await prisma.user.findUnique({ where: { id: tempUser.id } });
    expect(checkUser).toBeNull();

    // 5. Verify AuditLog rows STILL exist in DB with userId set to null
    const checkLog1 = await prisma.auditLog.findUnique({ where: { id: auditLog1.id } });
    const checkLog2 = await prisma.auditLog.findUnique({ where: { id: auditLog2.id } });

    expect(checkLog1).not.toBeNull();
    expect(checkLog1?.userId).toBeNull();
    expect((checkLog1?.metadata as any)?.actorName).toBe('Temp Deletion Staff');

    expect(checkLog2).not.toBeNull();
    expect(checkLog2?.userId).toBeNull();
    expect((checkLog2?.metadata as any)?.actorName).toBe('Temp Deletion Staff');

    // 6. Navigate to /admin/security to verify the Audit Log page displays them
    await page.goto('/admin/security');
    await page.waitForLoadState('networkidle');
    await page.click('button:has-text("Audit Logs")');

    await expect(page.getByText('Temp Deletion Staff').first()).toBeVisible();

    const auditScreenshotPath = path.join(screenshotDir, `audit_log_preservation_proof.png`);
    await page.screenshot({ path: auditScreenshotPath });
    console.log(`Saved audit log preservation screenshot: ${auditScreenshotPath}`);

    // Clean up test audit logs
    await prisma.auditLog.deleteMany({
      where: { id: { in: [auditLog1.id, auditLog2.id] } },
    });
  });
});
