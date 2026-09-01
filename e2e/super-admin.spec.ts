import { test, expect } from '@playwright/test';

// Helper to construct a mock JWT token string with specified role
async function createMockJwt(role: string): Promise<string> {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = btoa(
    JSON.stringify({
      sub: 'mock-user-uuid',
      email: `${role.toLowerCase()}@city.gov`,
      role,
      exp: Math.floor(Date.now() / 1000) + 3600,
    }),
  );
  return `${header}.${payload}.signature`;
}

test.describe('Module 9: Super Admin Portal E2E Tests', () => {
  test.beforeEach(async ({ context }) => {
    const adminToken = await createMockJwt('ADMIN');
    await context.addCookies([
      {
        name: 'ic_access_token',
        value: adminToken,
        domain: 'localhost',
        path: '/',
      },
    ]);
  });

  test('1. Admin dashboard loads with correct system-wide stats (mocked API)', async ({ page }) => {
    await page.route('**/api/admin/stats', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          totalComplaints: 42,
          statusBreakdown: { SUBMITTED: 10, ASSIGNED: 12, IN_PROGRESS: 15, RESOLVED: 5 },
          needsTriageCount: 4,
          pendingUserApprovalsCount: 3,
          departmentCount: 5,
          totalStaffCount: 18,
        }),
      });
    });

    await page.goto('/admin');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('h1')).toContainText('Super Admin System Portal');
    await expect(page.locator('text=Total Complaints')).toBeVisible();
    await expect(page.locator('text=42')).toBeVisible();
    await expect(page.locator('text=Triage Queue (4)')).toBeVisible();
    await expect(page.locator('text=Approvals (3)')).toBeVisible();
  });

  test('2. Triage queue lists unassigned complaints and manual assignment works', async ({ page }) => {
    await page.route('**/api/complaints?needsTriage=true*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [
            {
              id: 'cmp-triage-101',
              ticketId: 'CMP-TRIAGE-101',
              title: 'Low confidence water leak',
              description: 'Water leaking near main junction.',
              status: 'SUBMITTED',
              createdAt: new Date().toISOString(),
              aiPrediction: {
                confidenceScore: 0.45,
                suggestedDepartment: { name: 'Water Resources' },
              },
            },
          ],
        }),
      });
    });

    await page.route('**/api/departments', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 'dept-water-1', name: 'Water Resources' },
          { id: 'dept-roads-2', name: 'Roads & Infrastructure' },
        ]),
      });
    });

    await page.route('**/api/complaints/cmp-triage-101/assign', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    });

    await page.goto('/admin/triage');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('h1')).toContainText('Admin Triage Queue');
    await expect(page.locator('text=CMP-TRIAGE-101')).toBeVisible();
    await expect(page.locator('text=Low confidence water leak')).toBeVisible();

    // Select department and assign
    await page.selectOption('select', 'dept-roads-2');
    await page.click('button:has-text("Assign Department")');

    // Item assigned & removed
    await expect(page.locator('text=Triage Queue Clear!')).toBeVisible();
  });

  test('3. User approvals list renders pending users, approve action works', async ({ page }) => {
    await page.route('**/api/users?pendingOnly=true', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [
            {
              id: 'pending-user-1',
              name: 'Sarah Connor',
              email: 'sarah@city.gov',
              role: null,
              departmentId: null,
              createdAt: new Date().toISOString(),
            },
          ],
        }),
      });
    });

    await page.route('**/api/departments', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ id: 'dept-1', name: 'Sanitation' }]),
      });
    });

    await page.route('**/api/users/pending-user-1/approve', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ isAuthorized: true }),
      });
    });

    await page.goto('/admin/users/pending');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('h1')).toContainText('Pending Staff Approvals');
    await expect(page.locator('text=Sarah Connor')).toBeVisible();

    await page.click('button:has-text("Approve Staff")');
    await expect(page.locator('text=Approve Staff Account')).toBeVisible();

    await page.click('button:has-text("Confirm Approval")');
    await expect(page.locator('text=All Signups Reviewed')).toBeVisible();
  });

  test('4. Department creation form works and new department appears in list', async ({ page }) => {
    await page.route('**/api/departments', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'dept-new-101',
            name: 'Environmental Safety',
            description: 'Air and noise quality',
            staffCount: 0,
            complaintCount: 0,
            activeComplaintCount: 0,
          }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            {
              id: 'dept-1',
              name: 'Sanitation',
              description: 'Waste cleanup',
              staffCount: 3,
              complaintCount: 10,
              activeComplaintCount: 2,
            },
          ]),
        });
      }
    });

    await page.goto('/admin/departments');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('h1')).toContainText('Department Management');
    await expect(page.locator('text=Sanitation')).toBeVisible();

    await page.click('button:has-text("Add Department")');
    await page.fill('input[placeholder="e.g. Roads & Infrastructure"]', 'Environmental Safety');
    await page.fill('textarea', 'Air and noise quality');
    await page.click('button:has-text("Create Department")');

    await page.waitForLoadState('networkidle');
  });

  test('5. Category creation works', async ({ page }) => {
    await page.route('**/api/categories', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'cat-new-1',
            name: 'Pothole Repairs',
            description: 'Road damages',
            departmentId: 'dept-1',
          }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([]),
        });
      }
    });

    await page.route('**/api/departments', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ id: 'dept-1', name: 'Roads' }]),
      });
    });

    await page.goto('/admin/categories');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('h1')).toContainText('Category Management');
    await page.click('button:has-text("Add Category")');
    await page.fill('input[placeholder="e.g. Water Leakage & Mains"]', 'Pothole Repairs');
    await page.fill('textarea', 'Road damages');
    await page.click('button:has-text("Create Category")');
  });

  test('6. All Complaints view supports filtering by department', async ({ page }) => {
    await page.route('**/api/complaints*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [
            {
              id: 'cmp-sys-101',
              ticketId: 'CMP-SYS-101',
              title: 'Broken streetlight on 5th Ave',
              status: 'ASSIGNED',
              priority: 'HIGH',
              department: { id: 'dept-1', name: 'Electricity' },
            },
          ],
        }),
      });
    });

    await page.route('**/api/departments', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ id: 'dept-1', name: 'Electricity' }]),
      });
    });

    await page.route('**/api/categories', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    await page.goto('/admin/complaints');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('h1')).toContainText('System-Wide All Complaints');
    await expect(page.locator('text=CMP-SYS-101')).toBeVisible();
    await expect(page.locator('text=Broken streetlight on 5th Ave')).toBeVisible();
  });

  test('7. Complaint reassignment to a different department works from admin detail view', async ({ page }) => {
    await page.route('**/api/complaints/cmp-detail-101', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'cmp-detail-101',
          ticketId: 'CMP-DET-101',
          title: 'Trash dumping near school',
          description: 'Illegal dumping reported.',
          status: 'SUBMITTED',
          createdAt: new Date().toISOString(),
          departmentId: 'dept-sanitation',
          department: { id: 'dept-sanitation', name: 'Sanitation' },
        }),
      });
    });

    await page.route('**/api/departments', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 'dept-sanitation', name: 'Sanitation' },
          { id: 'dept-health', name: 'Public Health' },
        ]),
      });
    });

    await page.route('**/api/complaints/cmp-detail-101/assign', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ departmentId: 'dept-health' }),
      });
    });

    await page.goto('/admin/complaints/cmp-detail-101');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('h1')).toContainText('Trash dumping near school');
    await expect(page.locator('text=Super Admin Department Override')).toBeVisible();

    await page.selectOption('select', 'dept-health');
    await page.click('button:has-text("Confirm Reassignment")');
  });

  test('8. Non-SUPER_ADMIN role hitting /admin gets redirected away', async ({ page, context }) => {
    const citizenToken = await createMockJwt('CITIZEN');
    await context.clearCookies();
    await context.addCookies([
      {
        name: 'ic_access_token',
        value: citizenToken,
        domain: 'localhost',
        path: '/',
      },
    ]);

    await page.goto('/admin');
    await page.waitForURL('**/citizen');
    expect(page.url()).toContain('/citizen');
  });
});
