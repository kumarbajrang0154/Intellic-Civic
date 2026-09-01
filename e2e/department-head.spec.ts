import { test, expect } from '@playwright/test';
import { SignJWT } from 'jose';

const JWT_SECRET = new TextEncoder().encode('super-secret-jwt-key-minimum-32-chars-long!');

async function createDeptHeadJwt() {
  return new SignJWT({
    sub: 'dept-head-user-123',
    role: 'DEPARTMENT_HEAD',
    departmentId: 'dept-sanitation-1',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('2h')
    .sign(JWT_SECRET);
}

async function createOfficerJwt() {
  return new SignJWT({
    sub: 'officer-user-456',
    role: 'DEPARTMENT_OFFICER',
    departmentId: 'dept-sanitation-1',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('2h')
    .sign(JWT_SECRET);
}

test.describe('Module 7: Department Head Portal E2E Tests', () => {
  test.beforeEach(async ({ context }) => {
    const token = await createDeptHeadJwt();
    await context.addCookies([
      {
        name: 'ic_access_token',
        value: token,
        domain: 'localhost',
        path: '/',
      },
    ]);
  });

  test('1. Department Head dashboard loads and displays summary stat counts (mocked API)', async ({
    page,
  }) => {
    await page.route('/api/auth/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: {
            id: 'dept-head-1',
            name: 'Sanitation Chief',
            role: 'DEPARTMENT_HEAD',
            departmentId: 'dept-sanitation-1',
          },
        }),
      });
    });

    await page.route('**/api/complaints?limit=100', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [
            { id: '1', status: 'PENDING_DEPT_REVIEW' },
            { id: '2', status: 'IN_PROGRESS' },
            { id: '3', status: 'RESOLVED' },
          ],
          meta: { total: 3 },
        }),
      });
    });

    await page.route('**/api/complaints?pendingAiConfirmation=true&limit=100', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [{ id: 'ai-1', status: 'SUBMITTED' }],
          meta: { total: 1 },
        }),
      });
    });

    await page.goto('/department-head');

    await expect(page.getByText('Department Head Command Center')).toBeVisible();
    await expect(page.getByText('1 AI Complaint Suggestion(s) Awaiting Confirmation')).toBeVisible();
  });

  test('2. Department Queue renders table complaints and filters work', async ({ page }) => {
    await page.route('**/api/complaints?page=1&limit=15', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [
            {
              id: 'c-dept-1',
              ticketId: 'CMP-SAN-001',
              title: 'Uncollected trash on Elm St',
              status: 'PENDING_DEPT_REVIEW',
              priority: 'HIGH',
              createdAt: '2026-08-25T10:00:00Z',
              category: { name: 'Waste Collection' },
            },
          ],
          meta: { total: 1, page: 1, limit: 15, totalPages: 1 },
        }),
      });
    });

    await page.goto('/department-head/complaints');

    await expect(page.getByText('CMP-SAN-001')).toBeVisible();
    await expect(page.getByText('Uncollected trash on Elm St')).toBeVisible();
  });

  test('3. AI Suggestions page renders pending complaints with AI reasoning visible', async ({
    page,
  }) => {
    await page.route('**/api/complaints?pendingAiConfirmation=true&limit=50', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [
            {
              id: 'ai-suggest-10',
              ticketId: 'CMP-SUGGEST-10',
              title: 'Overflowing bin near school',
              description: 'Dumpster is full.',
              createdAt: '2026-08-26T12:00:00Z',
              aiSuggestion: {
                confidenceScore: 0.88,
                reasoning: 'Keywords match waste management category and sanitation department scope.',
              },
            },
          ],
        }),
      });
    });

    await page.goto('/department-head/ai-suggestions');

    await expect(page.getByText('CMP-SUGGEST-10')).toBeVisible();
    await expect(page.getByText('Keywords match waste management category')).toBeVisible();
    await expect(page.getByText('Confirm & Assign to My Dept')).toBeVisible();
  });

  test('4. Confirming AI suggestion calls assign endpoint and removes item from pending list', async ({
    page,
  }) => {
    let assignCalled = false;

    await page.route('**/api/complaints?pendingAiConfirmation=true&limit=50', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [
            {
              id: 'ai-suggest-99',
              ticketId: 'CMP-SUGGEST-99',
              title: 'Illegal dumping',
              description: 'Debris dumped in alley.',
              createdAt: '2026-08-26T12:00:00Z',
              aiSuggestion: {
                reasoning: 'High confidence match.',
              },
            },
          ],
        }),
      });
    });

    await page.route('**/api/complaints/ai-suggest-99/assign', async (route) => {
      assignCalled = true;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    });

    await page.goto('/department-head/ai-suggestions');
    await page.click('button:has-text("Confirm & Assign to My Dept")');

    await expect(page.getByText('No Pending AI Suggestions')).toBeVisible();
    expect(assignCalled).toBe(true);
  });

  test('5. Detail page status update dropdown restricts to valid transitions (e.g. PENDING_DEPT_REVIEW -> ASSIGNED, IN_PROGRESS, REJECTED, DUPLICATE)', async ({
    page,
  }) => {
    await page.route('**/api/complaints/c-detail-1', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'c-detail-1',
          ticketId: 'CMP-SAN-777',
          title: 'Hazardous chemical spill',
          description: 'Spill on roadway.',
          status: 'PENDING_DEPT_REVIEW',
          priority: 'CRITICAL',
          createdAt: '2026-08-27T09:00:00Z',
        }),
      });
    });

    await page.route('**/api/departments/*/staff', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ officers: [], fieldWorkers: [] }),
      });
    });

    await page.goto('/department-head/complaints/c-detail-1');

    await expect(page.getByText('CMP-SAN-777')).toBeVisible();

    const options = await page.locator('select option').allInnerTexts();
    expect(options).toContain('ASSIGNED');
    expect(options).toContain('IN PROGRESS');
    expect(options).toContain('REJECTED');
    expect(options).not.toContain('CLOSED'); // Invalid transition from PENDING_DEPT_REVIEW
  });

  test('6. Officer assignment dropdown populates and assigns officer', async ({ page }) => {
    let assignCalledWithOfficer = false;

    await page.route('**/api/complaints/c-detail-2', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'c-detail-2',
          ticketId: 'CMP-SAN-888',
          title: 'Tree branch blocking lane',
          description: 'Branch fell during storm.',
          status: 'PENDING_DEPT_REVIEW',
          department: { id: 'dept-sanitation-1', name: 'Sanitation' },
          createdAt: '2026-08-27T09:00:00Z',
        }),
      });
    });

    await page.route('**/api/departments/dept-sanitation-1/staff', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          officers: [
            { id: 'officer-john-1', name: 'John Officer', role: 'DEPARTMENT_OFFICER' },
          ],
          fieldWorkers: [],
        }),
      });
    });

    await page.route('**/api/complaints/c-detail-2/assign', async (route) => {
      const body = route.request().postDataJSON();
      if (body.assignedOfficerId === 'officer-john-1') {
        assignCalledWithOfficer = true;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    });

    await page.goto('/department-head/complaints/c-detail-2');

    await page.selectOption('select:has-text("Select officer")', 'officer-john-1');
    await page.click('button:has-text("Assign Officer")');

    await expect(page.getByText('Officer successfully assigned to complaint.')).toBeVisible();
    expect(assignCalledWithOfficer).toBe(true);
  });

  test('7. DEPARTMENT_OFFICER role hitting /department-head gets redirected to /officer', async ({
    context,
    page,
  }) => {
    const officerToken = await createOfficerJwt();
    await context.addCookies([
      {
        name: 'ic_access_token',
        value: officerToken,
        domain: 'localhost',
        path: '/',
      },
    ]);

    await page.goto('/department-head');
    await expect(page).toHaveURL('http://localhost:3000/officer');
  });
});
