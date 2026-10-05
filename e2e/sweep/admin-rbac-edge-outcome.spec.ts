import { test, expect } from '@playwright/test';
import { attachOutcomeListeners, createAuthJwt, setAuthCookie, getSeededUser, VIEWPORTS } from './sweep-helpers';
import prisma from '../../src/lib/prisma';

test.describe('Admin & RBAC Destructive Edge Flows Outcome Sweep', () => {
  let superAdminUser: any;
  let citizenUser: any;

  test.beforeAll(async () => {
    superAdminUser = await getSeededUser({ role: 'SUPER_ADMIN', email: 'kumarbajrang325@gmail.com' });
    citizenUser = await getSeededUser({ role: 'CITIZEN' });
  });

  for (const vp of VIEWPORTS) {
    test.describe(`Viewport: ${vp.name} (${vp.width}x${vp.height})`, () => {
      test.beforeEach(async ({ page }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height });
      });

      // ─────────────────────────────────────────────────────────────────────────
      // 1. ADMIN DASHBOARD & SETTINGS
      // ─────────────────────────────────────────────────────────────────────────
      test('1. Admin: overview dashboard stats and platform settings update', async ({ page, context }) => {
        const token = await createAuthJwt({
          sub: superAdminUser.id,
          role: 'SUPER_ADMIN',
          name: superAdminUser.name || 'Bajrang Kumar (Super Admin)',
          email: superAdminUser.email || 'kumarbajrang325@gmail.com',
        });
        await setAuthCookie(context, token);

        const outcome = attachOutcomeListeners(page);

        // 1.1 Load Admin Dashboard
        await page.goto('/admin');
        await page.waitForLoadState('domcontentloaded');
        await expect(page.locator('main h1, main h2').first()).toBeVisible({ timeout: 10000 });

        // 1.2 Load Platform Settings Page
        await page.goto('/admin/settings');
        await page.waitForLoadState('domcontentloaded');

        // Verify settings form fields
        const platformNameInput = page.locator('input[name="platformName"], input#platformName').first();
        if (await platformNameInput.isVisible()) {
          await platformNameInput.fill('IntelliCivic Smart City Platform');

          // Click Save
          const saveBtn = page.getByRole('button', { name: /save changes|save settings|save/i }).first();
          const [saveRes] = await Promise.all([
            page.waitForResponse((r) => r.url().includes('/api/admin/settings') && r.request().method() === 'PUT'),
            saveBtn.click(),
          ]);
          expect(saveRes.status()).toBe(200);
        }

        outcome.assertClean();
      });

      // ─────────────────────────────────────────────────────────────────────────
      // 2. STAFF MANAGEMENT & SUPER ADMIN PROTECTION
      // ─────────────────────────────────────────────────────────────────────────
      test('2. Admin Staff Governance: create staff, suspend, reactivate, and Super Admin protection', async ({
        page,
        context,
        request,
      }) => {
        const token = await createAuthJwt({
          sub: superAdminUser.id,
          role: 'SUPER_ADMIN',
          name: superAdminUser.name || 'Bajrang Kumar (Super Admin)',
          email: superAdminUser.email || 'kumarbajrang325@gmail.com',
        });
        await setAuthCookie(context, token);

        const outcome = attachOutcomeListeners(page);

        // 2.1 Load Staff Management Page
        await page.goto('/admin/staff');
        await page.waitForLoadState('domcontentloaded');
        await expect(page.locator('main h1, main h2').first()).toBeVisible({ timeout: 10000 });

        // 2.2 Create a New Staff Member via API and verify in roster
        const uniqueEmail = `test.officer.${Date.now()}@smartcity.gov.in`;
        const createRes = await request.post('/api/admin/staff', {
          headers: { Cookie: `ic_access_token=${token}` },
          data: {
            name: 'Test Officer Sweep',
            email: uniqueEmail,
            role: 'DEPARTMENT_OFFICER',
            departmentId: 'dept_roads_infra',
          },
        });
        expect([200, 201]).toContain(createRes.status());
        const createdUser = await createRes.json();
        const createdId = createdUser.staff?.id || createdUser.id || createdUser.user?.id;
        expect(createdId).toBeTruthy();

        // 2.3 Deactivate / Suspend Staff Member
        const deactRes = await request.patch(`/api/admin/staff/${createdId}/deactivate`, {
          headers: { Cookie: `ic_access_token=${token}` },
        });
        expect(deactRes.status()).toBe(200);

        // 2.4 Reactivate Staff Member
        const reactRes = await request.patch(`/api/admin/staff/${createdId}/reactivate`, {
          headers: { Cookie: `ic_access_token=${token}` },
        });
        expect(reactRes.status()).toBe(200);

        // 2.5 Delete Staff Member
        const delRes = await request.delete(`/api/admin/staff/${createdId}`, {
          headers: { Cookie: `ic_access_token=${token}` },
        });
        expect(delRes.status()).toBe(200);

        // 2.6 CRITICAL SECURITY EDGE: Attempt to Deactivate or Delete Super Admin must return 403
        const staffListRes = await request.get('/api/admin/staff?role=SUPER_ADMIN', {
          headers: { Cookie: `ic_access_token=${token}` },
        });
        const staffList = await staffListRes.json();
        const otherSuperAdmin = staffList.items?.find((s: any) => s.email === 'superadmin.test@smartcity.gov.in');
        const targetSuperAdminId = otherSuperAdmin?.id || '7f76b615-8e8e-402d-9a5c-b1a7fa4e1726';

        const superAdminDeact = await request.patch(`/api/admin/staff/${targetSuperAdminId}/deactivate`, {
          headers: { Cookie: `ic_access_token=${token}` },
        });
        expect(superAdminDeact.status(), 'Deactivating Super Admin must be rejected with 403').toBe(403);

        const superAdminDel = await request.delete(`/api/admin/staff/${targetSuperAdminId}`, {
          headers: { Cookie: `ic_access_token=${token}` },
        });
        expect(superAdminDel.status(), 'Deleting Super Admin must be rejected with 403').toBe(403);

        outcome.assertClean();
      });

      // ─────────────────────────────────────────────────────────────────────────
      // 3. CROSS-ROLE DIRECT URL ACCESS & AUTH EDGES
      // ─────────────────────────────────────────────────────────────────────────
      test('3. Cross-Role RBAC: unauthorized direct URL access redirects or blocks with 401/403', async ({
        page,
        context,
      }) => {
        // Citizen token
        const citizenToken = await createAuthJwt({
          sub: citizenUser.id,
          role: 'CITIZEN',
          name: citizenUser.name || 'Bajrang Kumar',
          mobileNumber: citizenUser.mobileNumber || '9876543210',
        });
        await setAuthCookie(context, citizenToken);

        const protectedStaffUrls = ['/admin', '/dept-head', '/officer', '/field-worker'];

        for (const staffUrl of protectedStaffUrls) {
          await page.goto(staffUrl);
          await page.waitForLoadState('domcontentloaded');

          // Citizen navigating to staff URL must either be redirected away or show access denied
          const currentUrl = page.url();
          const isRedirected = currentUrl.includes('/login') || currentUrl.includes('/citizen') || !currentUrl.includes(staffUrl);
          const hasForbiddenText = await page.locator('text=Forbidden').or(page.locator('text=Access Denied')).or(page.locator('text=Unauthorized')).isVisible();

          expect(
            isRedirected || hasForbiddenText,
            `Citizen directly navigating to ${staffUrl} must be redirected or shown forbidden, got URL ${currentUrl}`,
          ).toBe(true);
        }
      });

      test('4. Complaint Delete Edge: cannot delete complaint once ASSIGNED to department/worker', async ({
        request,
      }) => {
        const citizenToken = await createAuthJwt({
          sub: citizenUser.id,
          role: 'CITIZEN',
          name: citizenUser.name || 'Bajrang Kumar',
          mobileNumber: citizenUser.mobileNumber || '9876543210',
        });

        // Attempt to DELETE cmp-field-assigned (status: ASSIGNED)
        const delAssignedRes = await request.delete('/api/complaints/cmp-field-assigned', {
          headers: { Cookie: `ic_access_token=${citizenToken}` },
        });

        expect(
          [400, 403],
          `Deleting an assigned complaint must be blocked with 400 or 403, got ${delAssignedRes.status()}`,
        ).toContain(delAssignedRes.status());
      });

      test('5. Expired / Invalid Session: blocked and redirected to login', async ({ page, context }) => {
        // Set invalid token
        await context.addCookies([
          {
            name: 'ic_access_token',
            value: 'invalid.jwt.token-payload',
            domain: 'localhost',
            path: '/',
          },
        ]);

        await page.goto('/citizen');
        await page.waitForLoadState('domcontentloaded');

        // Must redirect to login or show auth error
        await page.waitForTimeout(1000);
        const url = page.url();
        const isRedirected = url.includes('/login');
        const showsAuthRequired = await page.locator('text=Sign in').or(page.locator('text=Authentication required')).or(page.locator('text=Log in')).isVisible();

        expect(
          isRedirected || showsAuthRequired,
          `Invalid session must redirect to login or show auth required, got URL ${url}`,
        ).toBe(true);
      });
    });
  }
});
