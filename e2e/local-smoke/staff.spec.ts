import { test, expect } from '@playwright/test';
import path from 'path';

const VIEWPORTS = [
  { width: 375, height: 812, name: 'mobile' },
  { width: 768, height: 1024, name: 'tablet' },
  { width: 1280, height: 800, name: 'desktop' },
];

const ADMIN_PAGES = [
  { path: '/admin', label: 'admin-dashboard' },
  { path: '/admin/sla', label: 'admin-sla' },
  { path: '/admin/settings', label: 'admin-settings' },
  { path: '/admin/reports', label: 'admin-reports' },
  { path: '/admin/reports/exports', label: 'admin-reports-exports' },
  { path: '/admin/contractors', label: 'admin-contractors' },
  { path: '/admin/municipalities', label: 'admin-municipalities' },
  { path: '/admin/analytics', label: 'admin-analytics' },
];

const DEPT_HEAD_PAGES = [
  { path: '/dept-head', label: 'dept-head-dashboard' },
  { path: '/dept-head/sla', label: 'dept-head-sla' },
];

const OFFICER_PAGES = [
  { path: '/officer', label: 'officer-dashboard' },
];

const FIELD_WORKER_PAGES = [
  { path: '/field-worker', label: 'field-worker-dashboard' },
];

const roleCookiesCache: Record<string, Array<{ name: string; value: string; domain: string; path: string }>> = {};

async function loginStaff(page: any, targetRole: 'ADMIN' | 'DEPARTMENT_HEAD' | 'DEPARTMENT_OFFICER' | 'FIELD_WORKER') {
  if (roleCookiesCache[targetRole]) {
    await page.context().addCookies(roleCookiesCache[targetRole]);
    return;
  }

  const staffEmail = process.env.E2E_STAFF_EMAIL;
  const staffPassword = process.env.E2E_STAFF_PASSWORD;

  if (staffEmail && staffPassword) {
    await page.goto('http://localhost:3000/login/staff', { waitUntil: 'domcontentloaded' });
    const emailInput = page.locator('input[type="email"]').first();
    const passInput = page.locator('input[type="password"]').first();
    if (await emailInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await emailInput.fill(staffEmail);
      await passInput.fill(staffPassword);
      await page.locator('button[type="submit"]').first().click();
      await page.waitForNavigation({ timeout: 10000 }).catch(() => {});
      return;
    }
  }

  // Fallback to dev-login in local development
  let email = 'kumarbajrang325@gmail.com';
  if (targetRole === 'DEPARTMENT_HEAD') email = 'head.roads@smartcity.gov.in';
  else if (targetRole === 'DEPARTMENT_OFFICER') email = 'officer.roads@smartcity.gov.in';
  else if (targetRole === 'FIELD_WORKER') email = 'fieldworker@intellicivic.gov.in';

  let res: any;
  for (let attempt = 0; attempt < 3; attempt++) {
    res = await page.request.post('http://localhost:3000/api/auth/dev-login', {
      data: { email, role: targetRole },
    });
    if (res.ok()) break;
    await page.waitForTimeout(1000);
  }

  if (!res || !res.ok()) {
    throw new Error(`dev-login failed for ${email} with HTTP ${res?.status()}`);
  }

  const cookies: Array<{ name: string; value: string; domain: string; path: string }> = [];
  const setCookies = res.headersArray().filter((h: any) => h.name.toLowerCase() === 'set-cookie');
  for (const h of setCookies) {
    const match = h.value.match(/^([^=]+)=([^;]+)/);
    if (match) {
      cookies.push({
        name: match[1],
        value: match[2],
        domain: 'localhost',
        path: '/',
      });
    }
  }

  roleCookiesCache[targetRole] = cookies;
  await page.context().addCookies(cookies);
}

test.describe('Staff Smoke Matrix & Flows in Browser', () => {
  // 1. Admin Pages
  for (const pageInfo of ADMIN_PAGES) {
    for (const vp of VIEWPORTS) {
      test(`Admin page "${pageInfo.path}" at ${vp.width}x${vp.height}`, async ({ page }) => {
        const consoleErrors: string[] = [];
        const server5xxErrors: string[] = [];

        page.on('console', (msg) => {
          if (msg.type() === 'error') consoleErrors.push(msg.text());
        });
        page.on('pageerror', (err) => consoleErrors.push(err.message));
        page.on('response', (res) => {
          if (res.status() >= 500) server5xxErrors.push(`${res.status()} ${res.url()}`);
        });

        await page.setViewportSize({ width: vp.width, height: vp.height });
        await loginStaff(page, 'ADMIN');

        try {
          const res = await page.goto(`http://localhost:3000${pageInfo.path}`, {
            waitUntil: 'domcontentloaded',
            timeout: 30000,
          });

          await page.waitForTimeout(1000);

          if (server5xxErrors.length > 0 || consoleErrors.length > 0) {
            const screenPath = path.join(
              process.cwd(),
              'scratch',
              'screens',
              `staff_${pageInfo.label}_${vp.width}x${vp.height}.png`,
            );
            await page.screenshot({ path: screenPath, fullPage: true }).catch(() => {});
          }

          expect(server5xxErrors, `5xx network responses: ${server5xxErrors.join(', ')}`).toEqual([]);
          expect(consoleErrors, `Uncaught console errors: ${consoleErrors.join(' | ')}`).toEqual([]);
          expect(res?.status()).toBeLessThan(500);
        } catch (err) {
          const screenPath = path.join(
            process.cwd(),
            'scratch',
            'screens',
            `staff_${pageInfo.label}_${vp.width}x${vp.height}_FAIL.png`,
          );
          await page.screenshot({ path: screenPath, fullPage: true }).catch(() => {});
          throw err;
        }
      });
    }
  }

  // 2. Department Head Pages
  for (const pageInfo of DEPT_HEAD_PAGES) {
    for (const vp of VIEWPORTS) {
      test(`Dept Head page "${pageInfo.path}" at ${vp.width}x${vp.height}`, async ({ page }) => {
        const consoleErrors: string[] = [];
        const server5xxErrors: string[] = [];

        page.on('console', (msg) => {
          if (msg.type() === 'error') consoleErrors.push(msg.text());
        });
        page.on('pageerror', (err) => consoleErrors.push(err.message));
        page.on('response', (res) => {
          if (res.status() >= 500) server5xxErrors.push(`${res.status()} ${res.url()}`);
        });

        await page.setViewportSize({ width: vp.width, height: vp.height });
        await loginStaff(page, 'DEPARTMENT_HEAD');

        try {
          const res = await page.goto(`http://localhost:3000${pageInfo.path}`, {
            waitUntil: 'domcontentloaded',
            timeout: 30000,
          });

          await page.waitForTimeout(1000);

          if (server5xxErrors.length > 0 || consoleErrors.length > 0) {
            const screenPath = path.join(
              process.cwd(),
              'scratch',
              'screens',
              `staff_${pageInfo.label}_${vp.width}x${vp.height}.png`,
            );
            await page.screenshot({ path: screenPath, fullPage: true }).catch(() => {});
          }

          expect(server5xxErrors, `5xx network responses: ${server5xxErrors.join(', ')}`).toEqual([]);
          expect(consoleErrors, `Uncaught console errors: ${consoleErrors.join(' | ')}`).toEqual([]);
          expect(res?.status()).toBeLessThan(500);
        } catch (err) {
          const screenPath = path.join(
            process.cwd(),
            'scratch',
            'screens',
            `staff_${pageInfo.label}_${vp.width}x${vp.height}_FAIL.png`,
          );
          await page.screenshot({ path: screenPath, fullPage: true }).catch(() => {});
          throw err;
        }
      });
    }
  }

  // 3. Officer Pages
  for (const pageInfo of OFFICER_PAGES) {
    for (const vp of VIEWPORTS) {
      test(`Officer page "${pageInfo.path}" at ${vp.width}x${vp.height}`, async ({ page }) => {
        const consoleErrors: string[] = [];
        const server5xxErrors: string[] = [];

        page.on('console', (msg) => {
          if (msg.type() === 'error') consoleErrors.push(msg.text());
        });
        page.on('pageerror', (err) => consoleErrors.push(err.message));
        page.on('response', (res) => {
          if (res.status() >= 500) server5xxErrors.push(`${res.status()} ${res.url()}`);
        });

        await page.setViewportSize({ width: vp.width, height: vp.height });
        await loginStaff(page, 'DEPARTMENT_OFFICER');

        try {
          const res = await page.goto(`http://localhost:3000${pageInfo.path}`, {
            waitUntil: 'domcontentloaded',
            timeout: 30000,
          });

          await page.waitForTimeout(1000);

          if (server5xxErrors.length > 0 || consoleErrors.length > 0) {
            const screenPath = path.join(
              process.cwd(),
              'scratch',
              'screens',
              `staff_${pageInfo.label}_${vp.width}x${vp.height}.png`,
            );
            await page.screenshot({ path: screenPath, fullPage: true }).catch(() => {});
          }

          expect(server5xxErrors, `5xx network responses: ${server5xxErrors.join(', ')}`).toEqual([]);
          expect(consoleErrors, `Uncaught console errors: ${consoleErrors.join(' | ')}`).toEqual([]);
          expect(res?.status()).toBeLessThan(500);
        } catch (err) {
          const screenPath = path.join(
            process.cwd(),
            'scratch',
            'screens',
            `staff_${pageInfo.label}_${vp.width}x${vp.height}_FAIL.png`,
          );
          await page.screenshot({ path: screenPath, fullPage: true }).catch(() => {});
          throw err;
        }
      });
    }
  }

  // 4. Field Worker Pages
  for (const pageInfo of FIELD_WORKER_PAGES) {
    for (const vp of VIEWPORTS) {
      test(`Field Worker page "${pageInfo.path}" at ${vp.width}x${vp.height}`, async ({ page }) => {
        const consoleErrors: string[] = [];
        const server5xxErrors: string[] = [];

        page.on('console', (msg) => {
          if (msg.type() === 'error') consoleErrors.push(msg.text());
        });
        page.on('pageerror', (err) => consoleErrors.push(err.message));
        page.on('response', (res) => {
          if (res.status() >= 500) server5xxErrors.push(`${res.status()} ${res.url()}`);
        });

        await page.setViewportSize({ width: vp.width, height: vp.height });
        await loginStaff(page, 'FIELD_WORKER');

        try {
          const res = await page.goto(`http://localhost:3000${pageInfo.path}`, {
            waitUntil: 'domcontentloaded',
            timeout: 30000,
          });

          await page.waitForTimeout(1000);

          if (server5xxErrors.length > 0 || consoleErrors.length > 0) {
            const screenPath = path.join(
              process.cwd(),
              'scratch',
              'screens',
              `staff_${pageInfo.label}_${vp.width}x${vp.height}.png`,
            );
            await page.screenshot({ path: screenPath, fullPage: true }).catch(() => {});
          }

          expect(server5xxErrors, `5xx network responses: ${server5xxErrors.join(', ')}`).toEqual([]);
          expect(consoleErrors, `Uncaught console errors: ${consoleErrors.join(' | ')}`).toEqual([]);
          expect(res?.status()).toBeLessThan(500);
        } catch (err) {
          const screenPath = path.join(
            process.cwd(),
            'scratch',
            'screens',
            `staff_${pageInfo.label}_${vp.width}x${vp.height}_FAIL.png`,
          );
          await page.screenshot({ path: screenPath, fullPage: true }).catch(() => {});
          throw err;
        }
      });
    }
  }

  // 5. Staff flow: open complaint detail, open assignment suggestions and duplicates panels
  test('Flow: Staff opens complaint detail, assignment suggestions, and duplicates panels with no 5xx', async ({ page }) => {
    const consoleErrors: string[] = [];
    const server5xxErrors: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => consoleErrors.push(err.message));
    page.on('response', (res) => {
      if (res.status() >= 500) server5xxErrors.push(`${res.status()} ${res.url()}`);
    });

    await page.setViewportSize({ width: 1280, height: 800 });
    await loginStaff(page, 'ADMIN');

    // Retrieve an existing complaint id from the list API
    const listRes = await page.request.get('http://localhost:3000/api/complaints?limit=1');
    expect(listRes.status()).toBeLessThan(500);

    let complaintId = '';
    if (listRes.ok()) {
      const data = await listRes.json().catch(() => ({}));
      const item = data.data?.[0] || data.items?.[0] || data[0];
      if (item?.id) {
        complaintId = item.id;
      }
    }

    if (complaintId) {
      // 1. Visit complaint detail page
      await page.goto(`http://localhost:3000/admin/complaints/${complaintId}`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1000);

      // 2. Query assignment suggestions endpoint for this complaint
      const suggestionsRes = await page.request.get(`http://localhost:3000/api/admin/complaints/${complaintId}/assignment-suggestions`);
      expect(suggestionsRes.status(), `Assignment suggestions returned 5xx`).toBeLessThan(500);

      // 3. Query duplicates endpoint for this complaint
      const duplicatesRes = await page.request.get(`http://localhost:3000/api/admin/complaints/${complaintId}/duplicates`);
      expect(duplicatesRes.status(), `Duplicates endpoint returned 5xx`).toBeLessThan(500);
    }

    expect(server5xxErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });
});

