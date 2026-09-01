import { test, expect } from '@playwright/test';
import { SignJWT } from 'jose';

const JWT_SECRET = new TextEncoder().encode('super-secret-jwt-key-minimum-32-chars-long!');

async function createCitizenJwt() {
  return new SignJWT({ sub: 'citizen-user-123', role: 'CITIZEN' })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('2h')
    .sign(JWT_SECRET);
}

test.describe('Module 6: Citizen Complaint Creation, List & Tracking E2E Tests', () => {
  test.beforeEach(async ({ context }) => {
    const token = await createCitizenJwt();
    await context.addCookies([
      {
        name: 'ic_access_token',
        value: token,
        domain: 'localhost',
        path: '/',
      },
    ]);
  });

  test('1. Form validation shows errors for title too short (<5 chars) and description too short (<20 chars)', async ({
    page,
  }) => {
    // Intercept categories API
    await page.route('/api/categories', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ id: 'cat-1', name: 'Potholes' }]),
      });
    });

    await page.goto('/citizen/complaints/new');

    // Submit empty form
    await page.click('button[type="submit"]');

    // Title < 5 chars
    await page.fill('#title', 'Bad');
    await page.fill('#description', 'Short description');
    await page.click('button[type="submit"]');

    await expect(page.getByText('Title must be between 5 and 200 characters.')).toBeVisible();
    await expect(page.getByText('Description must be at least 20 characters long.')).toBeVisible();
  });

  test('2. Citizen can fill and submit a new complaint form successfully (mocked API)', async ({
    page,
  }) => {
    // Mock Categories
    await page.route('/api/categories', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ id: 'cat-sanitation-1', name: 'Waste Management' }]),
      });
    });

    // Mock Create Complaint
    await page.route('/api/complaints', async (route) => {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'complaint-uuid-999',
          ticketId: 'CMP-2026-999888',
          title: 'Overflowing garbage bin near Central Park',
          description: 'The community dumpster has been overflowing for 3 days attracting pests.',
          status: 'SUBMITTED',
        }),
      });
    });

    await page.goto('/citizen/complaints/new');

    await page.fill('#title', 'Overflowing garbage bin near Central Park');
    await page.fill(
      '#description',
      'The community dumpster has been overflowing for 3 days attracting pests.',
    );
    await page.selectOption('#category', 'cat-sanitation-1');

    await page.click('button[type="submit"]');

    // Check success screen with generated ticket ID
    await expect(page.getByText('Complaint Submitted Successfully!')).toBeVisible();
    await expect(page.getByText('CMP-2026-999888')).toBeVisible();
  });

  test('3. My Complaints list renders complaint cards from mocked API data with status badges', async ({
    page,
  }) => {
    // Mock List Complaints
    await page.route('/api/complaints*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [
            {
              id: 'c-1',
              ticketId: 'CMP-2026-1001',
              title: 'Broken streetlight on 5th Avenue',
              description: 'Streetlight pole is completely dark at night creating hazard.',
              status: 'IN_PROGRESS',
              createdAt: '2026-08-20T10:00:00Z',
              category: { id: 'cat-1', name: 'Electrical' },
            },
          ],
          meta: { total: 1, page: 1, limit: 10, totalPages: 1 },
        }),
      });
    });

    await page.goto('/citizen');

    await expect(page.getByText('CMP-2026-1001')).toBeVisible();
    await expect(page.getByText('Broken streetlight on 5th Avenue')).toBeVisible();
    await expect(page.getByRole('link', { name: /CMP-2026-1001/ })).toContainText('In Progress');
  });

  test('4. Empty state shows when no complaints exist', async ({ page }) => {
    await page.route('**/api/complaints*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [],
          meta: { total: 0, page: 1, limit: 10, totalPages: 1 },
        }),
      });
    });

    await page.goto('/citizen');

    await expect(page.getByText('No Complaints Found')).toBeVisible();
    await expect(page.getByText('Submit Your First Complaint')).toBeVisible();
  });

  test('5. Clicking a complaint card navigates to detail page', async ({ page }) => {
    await page.route('**/api/complaints/c-1', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'c-1',
          ticketId: 'CMP-2026-1001',
          title: 'Broken streetlight on 5th Avenue',
          description: 'Streetlight pole is dark.',
          status: 'IN_PROGRESS',
          createdAt: '2026-08-20T10:00:00Z',
        }),
      });
    });

    await page.route('**/api/complaints?*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [
            {
              id: 'c-1',
              ticketId: 'CMP-2026-1001',
              title: 'Broken streetlight on 5th Avenue',
              description: 'Streetlight pole is dark.',
              status: 'IN_PROGRESS',
              createdAt: '2026-08-20T10:00:00Z',
            },
          ],
          meta: { total: 1, page: 1, limit: 10, totalPages: 1 },
        }),
      });
    });

    await page.goto('/citizen');
    await page.click('text=CMP-2026-1001');

    await expect(page).toHaveURL(/\/citizen\/complaints\/c-1/);
    await expect(page.getByText('Resolution Progress')).toBeVisible();
  });

  test('6. Complaint detail page renders progress stepper correctly for IN_PROGRESS status', async ({
    page,
  }) => {
    await page.route('/api/complaints/c-mid-flow', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'c-mid-flow',
          ticketId: 'CMP-2026-555',
          title: 'Pothole repair request',
          description: 'Large pothole causing vehicle damage near city library.',
          status: 'IN_PROGRESS',
          createdAt: '2026-08-22T08:00:00Z',
          category: { id: 'cat-roads', name: 'Roads & Infrastructure' },
          department: { id: 'dept-public-works', name: 'Department of Public Works' },
        }),
      });
    });

    await page.goto('/citizen/complaints/c-mid-flow');

    await expect(page.getByText('CMP-2026-555')).toBeVisible();
    await expect(page.getByText('Pothole repair request')).toBeVisible();
    await expect(page.getByText('Resolution Progress')).toBeVisible();
    await expect(page.getByText('Department of Public Works')).toBeVisible();
  });

  test('7. 404 state renders correctly for a non-existent / unauthorized complaint ID', async ({
    page,
  }) => {
    await page.route('/api/complaints/c-unauthorized-99', async (route) => {
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ statusCode: 404, message: 'Complaint not found' }),
      });
    });

    await page.goto('/citizen/complaints/c-unauthorized-99');

    await expect(page.getByText('Complaint Not Found')).toBeVisible();
    await expect(page.getByText('Return to Dashboard')).toBeVisible();
  });
});
