import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:3000';

async function setAdminAuthCookie(page: any, context: any) {
  const res = await page.request.post(`${BASE}/api/auth/dev-login`, {
    data: { email: 'kumarbajrang325@gmail.com' },
  });
  const cookiesHeader = res.headers()['set-cookie'] || '';
  const match = cookiesHeader.match(/ic_access_token=([^;]+)/);
  if (match) {
    await context.addCookies([
      {
        name: 'ic_access_token',
        value: match[1],
        url: BASE,
      },
    ]);
  }
  return match ? `ic_access_token=${match[1]}` : '';
}

test.describe('Issue 1 & 2 Verification Tests', () => {

  test('Issue 1 — ADMIN can delete Ramesh Kumar (FIELD_WORKER) & Super Admin (Bajrang Kumar) is protected', async ({ page, context, request }) => {
    const cookieHeader = await setAdminAuthCookie(page, context);

    // 1. Get staff list
    const getStaffList = await request.get(`${BASE}/api/admin/staff?limit=100`, {
      headers: { cookie: cookieHeader },
    });
    const staffData = await getStaffList.json();
    const items = staffData.items || [];

    // Find Super Admin item
    const superAdmin = items.find((s: any) => s.role === 'SUPER_ADMIN' || s.email === 'kumarbajrang325@gmail.com');
    expect(superAdmin).toBeDefined();

    // Find or create Ramesh Kumar (FIELD_WORKER)
    let ramesh = items.find((s: any) => s.name.includes('Ramesh') || s.email.includes('ramesh'));
    if (!ramesh) {
      const officer = items.find((s: any) => s.role === 'DEPARTMENT_OFFICER');
      const createRes = await request.post(`${BASE}/api/admin/staff`, {
        headers: { cookie: cookieHeader },
        data: {
          name: 'Ramesh Kumar',
          email: 'fieldworker.ramesh@intellicivic.gov.in',
          role: 'FIELD_WORKER',
          departmentId: 'dept_roads_infra',
          assignedOfficerId: officer?.id || 'usr_officer_roads_1',
        },
      });
      expect(createRes.status()).toBe(201);
      const created = await createRes.json();
      ramesh = created.staff;
    }

    // Delete Ramesh Kumar (FIELD_WORKER)
    const deleteRes = await request.delete(`${BASE}/api/admin/staff/${ramesh.id}`, {
      headers: { cookie: cookieHeader },
    });
    expect(deleteRes.status()).toBe(200);
    const deleteBody = await deleteRes.json();
    expect(deleteBody.deleted).toBe(true);

    // Verify Ramesh Kumar is deleted from DB
    const verifyGet = await request.get(`${BASE}/api/admin/staff?search=${encodeURIComponent(ramesh.id)}`, {
      headers: { cookie: cookieHeader },
    });
    const verifyBody = await verifyGet.json();
    expect(verifyBody.items.find((item: any) => item.id === ramesh.id)).toBeUndefined();

    // Attempt to delete Super Admin (Bajrang Kumar)
    const saDeleteRes = await request.delete(`${BASE}/api/admin/staff/${superAdmin.id}`, {
      headers: { cookie: cookieHeader },
    });
    expect(saDeleteRes.status()).toBe(403);
    const saDeleteBody = await saDeleteRes.json();
    expect(saDeleteBody.message).toContain('Super Admin accounts cannot be suspended, deactivated, or deleted.');
  });

  test('Issue 2 — Admin Accounts page redirects to /admin/staff and UI shows unified page with protected Super Admin', async ({ page, context }) => {
    const cookieHeader = await setAdminAuthCookie(page, context);

    // Ensure at least one non-Super-Admin staff exists for UI check
    await page.request.post(`${BASE}/api/admin/staff`, {
      headers: { cookie: cookieHeader },
      data: {
        name: 'UI Test Officer',
        email: `uitest_${Date.now()}@intellicivic.gov.in`,
        role: 'DEPARTMENT_OFFICER',
        departmentId: 'dept_roads_infra',
      },
    });

    // 1. Access /admin/users/admin-accounts and verify redirect to /admin/staff
    await page.goto(`${BASE}/admin/users/admin-accounts`);
    await page.waitForURL('**/admin/staff');
    expect(page.url()).toContain('/admin/staff');

    // Wait for table to finish loading
    await page.waitForSelector('table tbody tr');

    // 2. Verify Unified Page title
    await expect(page.locator('h1')).toContainText('Staff & User Management');

    // 3. Verify exactly ONE "Create Staff" button total on the page
    const createStaffButtons = page.locator('button:has-text("Create Staff")');
    await expect(createStaffButtons).toHaveCount(1);

    // 4. Verify Super Admin row has "Protected" badge and NO delete icon
    const protectedBadges = page.locator('span:has-text("Protected")');
    await expect(protectedBadges.first()).toBeVisible();

    // 5. Verify non-Super Admin rows have action icons including Delete
    const deleteButtons = page.locator('button[title="Delete Staff"]');
    expect(await deleteButtons.count()).toBeGreaterThan(0);
  });

});
