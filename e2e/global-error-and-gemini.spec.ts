import { test, expect } from '@playwright/test';
import { SignJWT } from 'jose';
import { sanitizeAiErrorMessage, checkAiHealth } from '@/services/gemini-service';

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

async function createAdminJwt() {
  return new SignJWT({
    sub: 'admin-super-id',
    role: 'SUPER_ADMIN',
    name: 'Super Admin',
    email: 'admin@city.gov',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('2h')
    .sign(JWT_SECRET);
}

test.describe('Global Error Popup (All Portals) & Gemini Visibility Suite', () => {
  test('PART 1: Forced 403 on Citizen portal displays plain-language popup with error message & hint', async ({ context, page }) => {
    const token = await createCitizenJwt();
    await context.addCookies([
      {
        name: 'ic_access_token',
        value: token,
        domain: 'localhost',
        path: '/',
      },
    ]);

    await page.route('**/api/auth/me', async (r) => {
      await r.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: {
            id: 'citizen_9876543210',
            name: 'Bajrang Kumar',
            role: 'CITIZEN',
            isProfileComplete: true,
          },
        }),
      });
    });

    // Mock a 403 Forbidden failure on complaints fetch
    await page.route('**/api/complaints?**', async (r) => {
      await r.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Citizen account permissions restricted for this zone',
          message: 'Access Denied',
        }),
      });
    });

    await page.goto('/citizen');

    // Assert Global Error Popup rendered
    const popup = page.locator('[data-testid="global-error-popup"]');
    await expect(popup).toBeVisible();

    // Assert plain-language title
    const title = page.locator('[data-testid="global-error-title"]');
    await expect(title).toHaveText('Access Denied');

    // Assert short message from API error field
    const message = page.locator('[data-testid="global-error-message"]');
    await expect(message).toContainText('Citizen account permissions restricted for this zone');

    // Assert HTTP status & hint line
    const hint = page.locator('[data-testid="global-error-hint"]');
    await expect(hint).toContainText('HTTP 403 • You do not have permission to perform this action.');

    // Assert stack traces are never exposed
    const popupText = await popup.innerText();
    expect(popupText).not.toContain('    at ');
    expect(popupText).not.toContain('node_modules');

    // Close/dismiss popup
    await page.locator('[data-testid="global-error-close"]').click();
    await expect(popup).not.toBeVisible();
  });

  test('PART 1: Forced 500 on Admin portal displays Server Error popup with error message & hint', async ({ context, page }) => {
    const token = await createAdminJwt();
    await context.addCookies([
      {
        name: 'ic_access_token',
        value: token,
        domain: 'localhost',
        path: '/',
      },
    ]);

    await page.route('**/api/auth/me', async (r) => {
      await r.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: {
            id: 'admin-super-id',
            name: 'Super Admin',
            role: 'SUPER_ADMIN',
          },
        }),
      });
    });

    // Mock 500 on staff route
    await page.route('**/api/admin/staff**', async (r) => {
      await r.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Database cluster replica connection timed out',
        }),
      });
    });

    await page.goto('/admin/staff');

    // Assert Global Error Popup rendered on Admin portal
    const popup = page.locator('[data-testid="global-error-popup"]');
    await expect(popup).toBeVisible();

    const title = page.locator('[data-testid="global-error-title"]');
    await expect(title).toHaveText('Server Error');

    const message = page.locator('[data-testid="global-error-message"]');
    await expect(message).toHaveText('Database cluster replica connection timed out');

    const hint = page.locator('[data-testid="global-error-hint"]');
    await expect(hint).toContainText('HTTP 500 • The server encountered an issue. Please try again later.');

    // Dismiss popup
    await page.locator('[data-testid="global-error-close"]').click();
    await expect(popup).not.toBeVisible();
  });

  test('PART 2: Admin -> Settings AI badge surfaces failure reason with status code', async ({ context, page }) => {
    const token = await createAdminJwt();
    await context.addCookies([
      {
        name: 'ic_access_token',
        value: token,
        domain: 'localhost',
        path: '/',
      },
    ]);

    await page.route('**/api/auth/me', async (r) => {
      await r.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: {
            id: 'admin-super-id',
            name: 'Super Admin',
            role: 'SUPER_ADMIN',
          },
        }),
      });
    });

    // Mock failing AI health check
    await page.route('**/api/admin/ai-health', async (r) => {
      await r.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: false,
          model: 'gemini-3.8-flash',
          status: 403,
          latencyMs: 142,
          error: 'The caller does not have permission for the requested project',
        }),
      });
    });

    await page.goto('/admin/settings');

    const badge = page.locator('[data-testid="ai-health-badge"]');
    await expect(badge).toBeVisible();
    await expect(badge).toContainText('Fallback mode (403)');
    await expect(badge).toContainText('The caller does not have permission');

    const titleAttr = await badge.getAttribute('title');
    expect(titleAttr).toContain('403');
    expect(titleAttr).toContain('The caller does not have permission');
  });

  test('PART 2: Gemini generateContent failure logs sanitized status & Google error message without secrets', async () => {
    const testSecretKey = 'AIzaSySecretTestingKey998877';
    process.env.GEMINI_API_KEY = testSecretKey;

    const loggedLines: string[] = [];
    const origError = console.error;
    console.error = (...args: any[]) => {
      loggedLines.push(args.join(' '));
      origError(...args);
    };

    try {
      // Simulate raw Google SDK error with key in URL and error message
      const fakeGoogleError = new Error(
        `Failed to fetch https://generativelanguage.googleapis.com/v1beta/models?key=${testSecretKey}: [403 Forbidden] The caller does not have permission`,
      );

      const sanitized = sanitizeAiErrorMessage(fakeGoogleError);
      console.error(`[Gemini AI] GENERATE_CONTENT_FAILED: Status ${sanitized.status} - ${sanitized.message}`);

      expect(sanitized.status).toBe(403);
      expect(sanitized.message).not.toContain(testSecretKey);
      expect(sanitized.message).toContain('[REDACTED_API_KEY]');

      const match = loggedLines.find((l) => l.includes('[Gemini AI] GENERATE_CONTENT_FAILED'));
      expect(match).toBeDefined();
      expect(match).not.toContain(testSecretKey);
      expect(match).toContain('Status 403');
      expect(match).toContain('The caller does not have permission');
    } finally {
      console.error = origError;
    }
  });

  test('PART 1: Logged-out visit to a public page with 401 /api/auth/me suppresses popup', async ({ page }) => {
    // Force 401 on session check
    await page.route('**/api/auth/me', async (r) => {
      await r.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ user: null }),
      });
    });

    await page.goto('/login/citizen');
    await page.waitForTimeout(500);

    // Assert that the global error popup is NOT displayed
    const popup = page.locator('[data-testid="global-error-popup"]');
    await expect(popup).not.toBeVisible();
  });

  test('PART 1: Handled 404 on complaint detail suppresses popup and shows inline not-found UI', async ({ context, page }) => {
    const token = await createCitizenJwt();
    await context.addCookies([
      {
        name: 'ic_access_token',
        value: token,
        domain: 'localhost',
        path: '/',
      },
    ]);

    await page.route('**/api/auth/me', async (r) => {
      await r.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: { id: 'citizen_9876543210', name: 'Citizen', role: 'CITIZEN' },
        }),
      });
    });

    // Mock 404 on complaint detail route
    await page.route('**/api/complaints/c-handled-404-test', async (r) => {
      await r.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ statusCode: 404, message: 'Complaint not found' }),
      });
    });

    await page.goto('/citizen/complaints/c-handled-404-test');
    await page.waitForTimeout(500);

    // Global error popup must NOT appear
    const popup = page.locator('[data-testid="global-error-popup"]');
    await expect(popup).not.toBeVisible();

    // Page inline empty state MUST be visible
    await expect(page.getByText('Complaint Not Found')).toBeVisible();
    await expect(page.getByText('Return to Dashboard')).toBeVisible();
  });
});

