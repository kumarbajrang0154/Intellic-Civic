import { test, expect } from '@playwright/test';
import { SignJWT } from 'jose';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'intellicivic-dev-jwt-secret-key-32bytes!');

async function createCitizenJwt() {
  return new SignJWT({
    sub: 'citizen_9876543210',
    role: 'CITIZEN',
    name: 'Bajrang Kumar',
    mobileNumber: '9876543210',
    email: 'kumarbajrang0154@gmail.com',
    isProfileComplete: true,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('2h')
    .sign(JWT_SECRET);
}

test.describe('Citizen Portal Interactive Button Click-Through Test Suite', () => {
  test.beforeEach(async ({ context, page }) => {
    const token = await createCitizenJwt();
    await context.addCookies([
      {
        name: 'ic_access_token',
        value: token,
        domain: 'localhost',
        path: '/',
      },
    ]);

    // Setup mocks
    await page.route('**/api/categories', async (r) => {
      await r.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: 'cat-1', name: 'Potholes & Roads' },
          { id: 'cat-2', name: 'Waste Management' },
        ]),
      });
    });

    await page.route('**/api/complaints/c-1/mark-satisfactory', async (r) => {
      await r.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    });

    await page.route('**/api/complaints/c-1/reopen', async (r) => {
      await r.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    });

    await page.route('**/api/complaints/c-1/feedback', async (r) => {
      await r.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    });

    await page.route('**/api/complaints/c-1', async (r) => {
      if (r.request().method() === 'DELETE') {
        await r.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, message: 'Complaint deleted' }),
        });
        return;
      }
      await r.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'c-1',
          ticketId: 'CMP-2026-1001',
          title: 'Broken streetlight on 5th Avenue',
          description: 'Streetlight pole is dark creating hazard.',
          status: 'RESOLVED',
          createdAt: '2026-08-20T10:00:00Z',
          updatedAt: '2026-08-20T10:00:00Z',
          category: { id: 'cat-1', name: 'Electrical' },
          department: { id: 'dept-1', name: 'Public Works' },
          evidence: [],
          statusHistory: [],
        }),
      });
    });

    await page.route('**/api/complaints?*', async (r) => {
      await r.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [
            {
              id: 'c-1',
              ticketId: 'CMP-2026-1001',
              title: 'Broken streetlight on 5th Avenue',
              description: 'Streetlight pole is dark.',
              status: 'RESOLVED',
              createdAt: '2026-08-20T10:00:00Z',
              category: { id: 'cat-1', name: 'Electrical' },
            },
          ],
          meta: { total: 1, page: 1, limit: 10, totalPages: 1 },
        }),
      });
    });

    await page.route('**/api/auth/me', async (r) => {
      await r.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: {
            id: 'citizen_9876543210',
            name: 'Bajrang Kumar',
            email: 'kumarbajrang0154@gmail.com',
            role: 'CITIZEN',
            isProfileComplete: true,
          },
        }),
      });
    });

    await page.route('**/api/citizen/profile', async (r) => {
      await r.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          profile: {
            id: 'citizen_9876543210',
            name: 'Bajrang Kumar',
            email: 'kumarbajrang0154@gmail.com',
            mobileNumber: '9876543210',
            address: '123 Main Street',
            avatarUrl: null,
            isProfileComplete: true,
          },
        }),
      });
    });

    await page.route('**/api/notifications', async (r) => {
      if (r.request().method() === 'PATCH') {
        await r.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true }),
        });
        return;
      }
      await r.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [
            {
              id: 'n-1',
              complaintId: 'c-1',
              message: 'Your complaint CMP-2026-1001 status changed to RESOLVED.',
              isRead: false,
              createdAt: '2026-08-21T10:00:00Z',
              complaint: { ticketId: 'CMP-2026-1001', title: 'Broken streetlight', status: 'RESOLVED', priority: 'HIGH' },
            },
          ],
          unreadCount: 1,
        }),
      });
    });

    await page.route('**/api/settings', async (r) => {
      await r.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          settings: { platformName: 'IntelliCivic', logoUrl: null },
        }),
      });
    });
  });

  test('1. Login Page: Staff login link navigates to staff portal', async ({ context, page }) => {
    await context.clearCookies();
    await page.goto('/login/citizen');
    const staffLink = page.locator('a[href="/login/staff"]');
    await expect(staffLink).toBeVisible();
    await staffLink.click();
    await expect(page).toHaveURL(/\/login\/staff/);
  });

  test('2. Dashboard: Action card button navigates to new complaint', async ({ page }) => {
    await page.goto('/citizen');
    const fileBtn = page.locator('a:has-text("File New Complaint")').first();
    await expect(fileBtn).toBeVisible();
    await fileBtn.click();
    await expect(page).toHaveURL(/\/citizen\/complaints\/new/);
  });

  test('3. Dashboard: Complaint list card clicks navigate to complaint detail', async ({ page }) => {
    await page.goto('/citizen');
    const cardLink = page.locator('a:has-text("CMP-2026-1001")').first();
    await expect(cardLink).toBeVisible();
    await cardLink.click();
    await expect(page).toHaveURL(/\/citizen\/complaints\/c-1/);
  });

  test('4. Dashboard: Topbar notification bell navigates to notifications page', async ({ page }) => {
    await page.goto('/citizen');
    const bellLink = page.locator('header a[aria-label="Notifications"]');
    await expect(bellLink).toBeVisible();
    await bellLink.click();
    await expect(page).toHaveURL(/\/citizen\/notifications/);
  });

  test('5. New Complaint: Cancel button navigates back to citizen dashboard', async ({ page }) => {
    await page.goto('/citizen/complaints/new');
    const cancelBtn = page.locator('a:has-text("Cancel")');
    await expect(cancelBtn).toBeVisible();
    await cancelBtn.click();
    await expect(page).toHaveURL(/\/citizen$/);
  });

  test('6. Complaint Detail: Satisfactory button triggers API call and toast', async ({ page }) => {
    await page.goto('/citizen/complaints/c-1');
    const satBtn = page.locator('button:has-text("Mark as Satisfactory")');
    await expect(satBtn).toBeVisible();
    await satBtn.click();
    await expect(page.getByText(/Complaint closed as satisfactory/i)).toBeVisible({ timeout: 5000 });
  });

  test('7. Complaint Detail: Reopen button opens modal, cancel closes modal', async ({ page }) => {
    await page.goto('/citizen/complaints/c-1');
    const reopenBtn = page.locator('button:has-text("Reopen Complaint")');
    await expect(reopenBtn).toBeVisible();
    await reopenBtn.click();

    await expect(page.getByText('Reopen Resolved Complaint')).toBeVisible();

    const cancelModalBtn = page.locator('div[role="dialog"] button:has-text("Cancel")');
    await cancelModalBtn.click();
    await expect(page.getByText('Reopen Resolved Complaint')).not.toBeVisible();
  });

  test('8. Notifications: Mark All as Read updates unread state', async ({ page }) => {
    await page.goto('/citizen/notifications');
    const markAllBtn = page.locator('button:has-text("Mark all as read")');
    await expect(markAllBtn).toBeVisible();
    await markAllBtn.click();
    await expect(page.getByText(/All notifications marked as read/i)).toBeVisible({ timeout: 5000 });
  });

  test('9. Profile: Avatar preset buttons update avatar selection state', async ({ page }) => {
    await page.goto('/citizen/profile');
    const avatar1 = page.locator('button:has-text("Avatar 1")');
    await expect(avatar1).toBeVisible();
    await avatar1.click();
    await expect(page.locator('input[type="url"]')).toHaveValue('https://api.dicebear.com/7.x/avataaars/svg?seed=Citizen1');
  });
});
