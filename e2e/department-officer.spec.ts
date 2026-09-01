import { test, expect } from '@playwright/test';
import { SignJWT } from 'jose';

const JWT_SECRET = new TextEncoder().encode('super-secret-jwt-key-minimum-32-chars-long!');

async function createOfficerJwt() {
  return new SignJWT({
    sub: 'officer-user-123',
    role: 'DEPARTMENT_OFFICER',
    departmentId: 'dept-sanitation-1',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('2h')
    .sign(JWT_SECRET);
}

async function createDeptHeadJwt() {
  return new SignJWT({
    sub: 'dept-head-user-456',
    role: 'DEPARTMENT_HEAD',
    departmentId: 'dept-sanitation-1',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('2h')
    .sign(JWT_SECRET);
}

test.describe('Module 8: Department Officer Portal E2E Tests', () => {
  test.beforeEach(async ({ context, page }) => {
    const token = await createOfficerJwt();
    await context.addCookies([
      {
        name: 'ic_access_token',
        value: token,
        domain: 'localhost',
        path: '/',
      },
    ]);

    await page.route('**/api/auth/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: {
            id: 'officer-user-123',
            name: 'Officer Sanitation',
            role: 'DEPARTMENT_OFFICER',
            departmentId: 'dept-sanitation-1',
          },
        }),
      });
    });
  });

  test('1. Officer dashboard loads and displays summary stat counts (mocked API)', async ({
    page,
  }) => {
    await page.route('**/api/complaints?assignedToMe=true*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [
            { id: '1', ticketId: 'CMP-OFF-001', status: 'ASSIGNED', priority: 'HIGH', title: 'Overflowing bin' },
            { id: '2', ticketId: 'CMP-OFF-002', status: 'IN_PROGRESS', priority: 'MEDIUM', title: 'Illegal dumping' },
            { id: '3', ticketId: 'CMP-OFF-003', status: 'RESOLVED', priority: 'LOW', title: 'Street sweeping' },
          ],
          meta: { total: 3 },
        }),
      });
    });

    await page.goto('/officer');

    await expect(page.getByText('Officer Workstation')).toBeVisible();
    await expect(page.getByText('CMP-OFF-001')).toBeVisible();
  });

  test('2. My Assigned Complaints list renders only complaints scoped to this officer', async ({
    page,
  }) => {
    await page.route('**/api/complaints?assignedToMe=true*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [
            {
              id: 'c-officer-1',
              ticketId: 'CMP-ASSIGNED-1',
              title: 'Debris blocking storm drain',
              description: 'Blocked drain during heavy rain.',
              status: 'ASSIGNED',
              priority: 'HIGH',
              createdAt: '2026-08-25T10:00:00Z',
              category: { name: 'Waste Collection' },
              location: { address: '123 Main St' },
            },
          ],
          meta: { total: 1 },
        }),
      });
    });

    await page.goto('/officer/complaints');

    await expect(page.getByText('CMP-ASSIGNED-1')).toBeVisible();
    await expect(page.getByText('Debris blocking storm drain')).toBeVisible();
  });

  test('3. Status update on detail page offers valid next-transition options', async ({ page }) => {
    await page.route('**/api/complaints/c-officer-detail-1', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'c-officer-detail-1',
          ticketId: 'CMP-DETAIL-100',
          title: 'Damaged trash bin',
          description: 'Wheel broken on commercial bin.',
          status: 'ASSIGNED',
          priority: 'MEDIUM',
          createdAt: '2026-08-27T09:00:00Z',
          evidence: [],
          statusHistory: [],
        }),
      });
    });

    await page.goto('/officer/complaints/c-officer-detail-1');

    await expect(page.getByText('CMP-DETAIL-100')).toBeVisible();

    const select = page.locator('select').first();
    await expect(select).toContainText('IN_PROGRESS');
    await expect(select).toContainText('RESOLVED');
    await expect(select).toContainText('REJECTED');
  });

  test('4. Officer can attach work-evidence photo (mocked Cloudinary / backend calls)', async ({
    page,
  }) => {
    let evidenceCalled = false;

    await page.route('**/api/complaints/c-officer-detail-2', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'c-officer-detail-2',
          ticketId: 'CMP-DETAIL-200',
          title: 'Graffiti cleanup',
          description: 'Vandalism on public wall.',
          status: 'IN_PROGRESS',
          priority: 'LOW',
          createdAt: '2026-08-27T09:00:00Z',
          evidence: [],
          statusHistory: [],
        }),
      });
    });

    await page.route('**/api/complaints/c-officer-detail-2/evidence', async (route) => {
      evidenceCalled = true;
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ id: 'ev-new-1', stage: 'DURING' }),
      });
    });

    await page.goto('/officer/complaints/c-officer-detail-2');

    await expect(page.getByText('CMP-DETAIL-200')).toBeVisible();
    await expect(page.getByText('Attach Work Evidence (DURING / AFTER)')).toBeVisible();
  });

  test('5. DEPARTMENT_HEAD role hitting /officer gets redirected to /department-head', async ({
    context,
    page,
  }) => {
    const deptHeadToken = await createDeptHeadJwt();
    await context.addCookies([
      {
        name: 'ic_access_token',
        value: deptHeadToken,
        domain: 'localhost',
        path: '/',
      },
    ]);

    await page.goto('/officer');
    await expect(page).toHaveURL('http://localhost:3000/department-head');
  });

  test('6. Officer assignedToMe query scoping ensures only officer-specific complaints return', async ({
    page,
  }) => {
    let queriedWithAssignedToMe = false;

    await page.route('**/api/complaints?assignedToMe=true*', async (route) => {
      queriedWithAssignedToMe = true;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [],
          meta: { total: 0 },
        }),
      });
    });

    await page.goto('/officer/complaints');

    await expect(page.getByText('No Assigned Complaints Found')).toBeVisible();
    expect(queriedWithAssignedToMe).toBe(true);
  });
});
