import { test, expect } from '@playwright/test';
import { SignJWT } from 'jose';
import * as fs from 'fs';
import * as path from 'path';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'intellicivic-dev-jwt-secret-key-32bytes!');

async function createRoleJwt(role: string, name: string) {
  return new SignJWT({
    sub: `${role.toLowerCase()}-user-1`,
    role,
    name,
    email: `${role.toLowerCase()}@intellicivic.gov.in`,
    departmentId: 'dept-1',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('2h')
    .sign(JWT_SECRET);
}

const OUT_DIR = path.resolve(process.cwd(), 'docs/screenshots/reskin');

test.beforeAll(() => {
  if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
  }
});

// 1. Unauthenticated Login Pages
const loginPages = [
  {
    name: 'Citizen Login',
    path: '/login/citizen',
    key: 'citizen-login',
  },
  {
    name: 'Staff Login',
    path: '/login/staff',
    key: 'staff-login',
  },
];

for (const lp of loginPages) {
  test.describe(`Audit Screenshot: ${lp.name} (${lp.path})`, () => {
    test(`Capture 375px & 1280px for ${lp.key}`, async ({ page }) => {
      // 1280px Desktop
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto(lp.path);
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1000);
      await page.screenshot({
        path: path.join(OUT_DIR, `${lp.key}-1280px.png`),
        fullPage: true,
      });

      // 375px Mobile
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto(lp.path);
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1000);
      await page.screenshot({
        path: path.join(OUT_DIR, `${lp.key}-375px.png`),
        fullPage: true,
      });
    });
  });
}

// 2. Dashboards (One per role)
const dashboards = [
  {
    role: 'CITIZEN',
    name: 'Citizen',
    path: '/citizen',
    key: 'citizen',
  },
  {
    role: 'ADMIN',
    name: 'Super Admin',
    path: '/admin',
    key: 'admin',
  },
  {
    role: 'DEPARTMENT_HEAD',
    name: 'Department Head',
    path: '/dept-head',
    key: 'dept-head',
  },
  {
    role: 'DEPARTMENT_OFFICER',
    name: 'Nodal Officer',
    path: '/officer',
    key: 'officer',
  },
  {
    role: 'FIELD_WORKER',
    name: 'Field Technician',
    path: '/field-worker',
    key: 'field-worker',
  },
];

for (const dash of dashboards) {
  test.describe(`Audit Screenshots: ${dash.name} (${dash.path})`, () => {
    test(`Capture 375px & 1280px for ${dash.key}`, async ({ page, context }) => {
      const token = await createRoleJwt(dash.role, dash.name);
      await context.addCookies([
        {
          name: 'ic_access_token',
          value: token,
          domain: 'localhost',
          path: '/',
        },
      ]);

      // Mock settings & auth/me
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

      await page.route('**/api/auth/me', async (r) => {
        await r.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            user: {
              id: `${dash.role.toLowerCase()}-1`,
              role: dash.role,
              name: dash.name,
              email: `${dash.role.toLowerCase()}@intellicivic.gov.in`,
              departmentId: 'dept-1',
              isProfileComplete: true,
            },
          }),
        });
      });

      // 1280px Desktop
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto(dash.path);
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1000);
      await page.screenshot({
        path: path.join(OUT_DIR, `${dash.key}-1280px.png`),
        fullPage: true,
      });

      // 375px Mobile
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto(dash.path);
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1000);
      await page.screenshot({
        path: path.join(OUT_DIR, `${dash.key}-375px.png`),
        fullPage: true,
      });
    });
  });
}
