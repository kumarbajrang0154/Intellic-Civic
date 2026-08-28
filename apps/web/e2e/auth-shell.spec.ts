import { test, expect } from '@playwright/test';
import { SignJWT } from 'jose';

const JWT_SECRET = new TextEncoder().encode('super-secret-jwt-key-minimum-32-chars-long!');

async function createMockJwt(role: string) {
  return new SignJWT({ sub: 'user-123', role })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('2h')
    .sign(JWT_SECRET);
}

test.describe('Module 5: Frontend Auth Pages & App Shell E2E Tests', () => {
  test('1. Citizen can complete phone + OTP login flow (mocked API)', async ({ page }) => {
    // Intercept BFF send-otp call
    await page.route('/api/auth/send-otp', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'OTP sent successfully' }),
      });
    });

    // Intercept BFF verify-otp call
    await page.route('/api/auth/verify-otp', async (route) => {
      const citizenToken = await createMockJwt('CITIZEN');
      // Fulfill with set-cookie headers
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: {
          'Set-Cookie': `ic_access_token=${citizenToken}; Path=/; HttpOnly; SameSite=Lax`,
        },
        body: JSON.stringify({
          success: true,
          user: { id: 'citizen-1', mobileNumber: '9876543210', role: 'CITIZEN' },
        }),
      });
    });

    // Go to citizen login page
    await page.goto('/login/citizen');
    await expect(page.getByText('Citizen Verification')).toBeVisible();

    // Step 1: Input 10-digit mobile number
    await page.fill('#mobileNumber', '9876543210');
    await page.click('button[type="submit"]');

    // Step 2: Input 6-digit OTP
    await expect(page.getByText('Enter 6-Digit OTP')).toBeVisible();

    // Fill 6 OTP digits
    const inputs = page.locator('input[aria-label^="Digit"]');
    for (let i = 0; i < 6; i++) {
      await inputs.nth(i).fill(String(i + 1));
    }

    await page.click('button[type="submit"]');

    // Verify redirected to /citizen dashboard
    await expect(page).toHaveURL(/\/citizen/);
    await expect(page.getByText('Welcome to Citizen Portal')).toBeVisible();
  });

  test('2. Unauthenticated user hitting /citizen gets redirected to /login/citizen', async ({ page }) => {
    await page.goto('/citizen');
    await expect(page).toHaveURL(/\/login\/citizen/);
    await expect(page.getByText('Citizen Verification')).toBeVisible();
  });

  test('3. CITIZEN role hitting /admin gets redirected to /citizen', async ({ page, context }) => {
    const citizenToken = await createMockJwt('CITIZEN');
    await context.addCookies([
      {
        name: 'ic_access_token',
        value: citizenToken,
        domain: 'localhost',
        path: '/',
      },
    ]);

    await page.goto('/admin');
    await expect(page).toHaveURL(/\/citizen/);
    await expect(page.getByText('Welcome to Citizen Portal')).toBeVisible();
  });

  test('4. App Shell renders correct nav items for CITIZEN role', async ({ page, context }) => {
    const citizenToken = await createMockJwt('CITIZEN');
    await context.addCookies([
      {
        name: 'ic_access_token',
        value: citizenToken,
        domain: 'localhost',
        path: '/',
      },
    ]);

    await page.goto('/citizen');
    await expect(page.getByRole('link', { name: 'My Complaints', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'New Complaint', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Profile', exact: true })).toBeVisible();
  });

  test('5. App Shell renders correct nav items for ADMIN role', async ({ page, context }) => {
    const adminToken = await createMockJwt('ADMIN');
    await context.addCookies([
      {
        name: 'ic_access_token',
        value: adminToken,
        domain: 'localhost',
        path: '/',
      },
    ]);

    await page.goto('/admin');
    await expect(page.locator('h1')).toContainText('Super Admin System Portal');
    await expect(page.getByRole('link', { name: 'Triage Queue', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Departments', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'All Users', exact: true })).toBeVisible();
  });

  test('6. Logout clears cookies and redirects to landing page', async ({ page, context }) => {
    const citizenToken = await createMockJwt('CITIZEN');
    await context.addCookies([
      {
        name: 'ic_access_token',
        value: citizenToken,
        domain: 'localhost',
        path: '/',
      },
      {
        name: 'ic_refresh_token',
        value: 'mock-refresh-token',
        domain: 'localhost',
        path: '/',
      },
    ]);

    await page.goto('/citizen');
    await page.click('button:has-text("Logout")');

    await expect(page).toHaveURL('http://localhost:3000/');
    const cookies = await context.cookies();
    const accessToken = cookies.find((c) => c.name === 'ic_access_token');
    expect(accessToken).toBeUndefined();
  });

  test('7. OAuth single-use code exchange redirects to role dashboard without JWT in URL', async ({ page }) => {
    await page.route('/api/auth/exchange-code', async (route) => {
      const adminToken = await createMockJwt('ADMIN');
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: {
          'Set-Cookie': `ic_access_token=${adminToken}; Path=/; HttpOnly; SameSite=Lax`,
        },
        body: JSON.stringify({
          success: true,
          user: { id: 'admin-1', email: 'admin@city.gov', role: 'ADMIN' },
        }),
      });
    });

    await page.goto('/auth/callback?code=auth_code_mock_opaque_123');
    await expect(page).toHaveURL(/\/admin/);
    await expect(page.locator('h1')).toContainText('Super Admin System Portal');
  });
});
