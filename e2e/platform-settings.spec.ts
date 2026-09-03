import { test, expect } from '@playwright/test';

test.describe('Platform & Organization Settings Module Tests', () => {
  const baseURL = 'http://localhost:3000';

  test('1. GET /api/settings returns public platform settings', async ({ request }) => {
    const res = await request.get(`${baseURL}/api/settings`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.settings).toBeDefined();
    expect(body.settings.platformName).toBeDefined();
    expect(body.settings.supportEmail).toBeDefined();
  });

  test('2. PATCH /api/admin/settings returns 401 when unauthenticated', async ({ request }) => {
    const res = await request.patch(`${baseURL}/api/admin/settings`, {
      data: { platformName: 'Hacked Platform' },
    });
    expect(res.status()).toBe(401);
  });

  test('3. Super Admin can access & update settings via PATCH /api/admin/settings', async ({ request }) => {
    // 1. Authenticate as Super Admin via dev-login
    const authRes = await request.post(`${baseURL}/api/auth/dev-login`, {
      data: { userId: 'usr_super_admin' },
    });
    expect(authRes.status()).toBe(200);

    const rawCookies = authRes.headers()['set-cookie'] || '';
    const cookieHeader = rawCookies
      .split('\n')
      .map((c) => c.split(';')[0].trim())
      .filter(Boolean)
      .join('; ');

    // 2. Perform PATCH request with session cookie
    const patchRes = await request.patch(`${baseURL}/api/admin/settings`, {
      headers: { Cookie: cookieHeader },
      data: {
        platformName: 'IntelliCivic Smart City Platform',
        shortName: 'IntelliCivic',
        organizationName: 'Capital Territory Municipal Corporation',
        supportEmail: 'admin.support@smartcity.gov.in',
        officialPhone: '+91 1800-999-8888',
        workingHours: 'Mon - Sun: 8:00 AM - 8:00 PM',
        footerDescription: 'Official AI-Powered Smart City Governance Platform.',
      },
    });

    expect(patchRes.status()).toBe(200);
    const patchBody = await patchRes.json();
    expect(patchBody.success).toBe(true);
    expect(patchBody.settings.platformName).toBe('IntelliCivic Smart City Platform');
    expect(patchBody.settings.supportEmail).toBe('admin.support@smartcity.gov.in');

    // 3. Verify persistence via public GET /api/settings
    const getRes = await request.get(`${baseURL}/api/settings`);
    expect(getRes.status()).toBe(200);
    const getBody = await getRes.json();
    expect(getBody.settings.platformName).toBe('IntelliCivic Smart City Platform');
    expect(getBody.settings.supportEmail).toBe('admin.support@smartcity.gov.in');
    expect(getBody.settings.officialPhone).toBe('+91 1800-999-8888');
  });

  test('4. Super Admin Settings Page UI loads and displays settings', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });

    // Login as Super Admin
    await page.goto(`${baseURL}/login/staff`);
    const devRes = await page.request.post(`${baseURL}/api/auth/dev-login`, {
      data: { userId: 'usr_super_admin' },
    });
    expect(devRes.status()).toBe(200);

    // Navigate to /admin/settings
    await page.goto(`${baseURL}/admin/settings`);
    await page.waitForLoadState('networkidle');

    // Confirm heading and live preview are visible
    await expect(page.locator('h1')).toContainText('Platform & Organization Settings');
    await expect(page.locator('text=SUPER_ADMIN ONLY')).toBeVisible();
    await expect(page.locator('text=Live Branding Preview')).toBeVisible();

    // Capture screenshot
    await page.screenshot({
      path: 'C:/Users/Bajrang Kumar 07/.gemini/antigravity-ide/brain/652d066f-b656-4386-bfff-612ab59b8cc2/super_admin_settings_ui.png',
      fullPage: false,
    });
  });
});
