import { test } from '@playwright/test';
import { SignJWT } from 'jose';
import * as fs from 'fs';
import * as path from 'path';

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

const viewports = [
  { name: '375px', width: 375, height: 667 },
  { name: '768px', width: 768, height: 1024 },
  { name: '1280px', width: 1280, height: 800 },
];

const routes = [
  { name: 'login', path: '/login/citizen', requiresAuth: false },
  { name: 'dashboard', path: '/citizen', requiresAuth: true },
  { name: 'new-complaint', path: '/citizen/complaints/new', requiresAuth: true },
  { name: 'complaint-detail', path: '/citizen/complaints/c-1', requiresAuth: true },
  { name: 'profile', path: '/citizen/profile', requiresAuth: true },
  { name: 'notifications', path: '/citizen/notifications', requiresAuth: true },
];

test.describe('Citizen Portal Complete UI/UX & Interactive Element Audit', () => {
  const auditOutputDir = path.join(process.cwd(), 'e2e', 'audit', 'after');

  test.beforeAll(() => {
    if (!fs.existsSync(auditOutputDir)) {
      fs.mkdirSync(auditOutputDir, { recursive: true });
    }
  });

  for (const route of routes) {
    for (const vp of viewports) {
      test(`Audit ${route.name} at ${vp.name}`, async ({ page, context }) => {
        if (route.requiresAuth) {
          const token = await createCitizenJwt();
          await context.addCookies([
            {
              name: 'ic_access_token',
              value: token,
              domain: 'localhost',
              path: '/',
            },
          ]);
        }

        // Setup mock routes to ensure page loads cleanly without 404s
        await page.route('/api/categories', async (r) => {
          await r.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify([
              { id: 'cat-1', name: 'Potholes & Roads' },
              { id: 'cat-2', name: 'Waste Management' },
            ]),
          });
        });

        await page.route('/api/complaints/c-1', async (r) => {
          await r.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              id: 'c-1',
              ticketId: 'CMP-2026-1001',
              title: 'Broken streetlight on 5th Avenue',
              description: 'Streetlight pole is completely dark at night creating severe hazard.',
              status: 'IN_PROGRESS',
              createdAt: '2026-08-20T10:00:00Z',
              category: { id: 'cat-1', name: 'Electrical' },
              department: { id: 'dept-1', name: 'Public Works' },
              evidence: [],
              statusHistory: [],
            }),
          });
        });

        await page.route('/api/complaints*', async (r) => {
          if (r.request().url().includes('/c-1')) return r.continue();
          await r.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              data: [
                {
                  id: 'c-1',
                  ticketId: 'CMP-2026-1001',
                  title: 'Broken streetlight on 5th Avenue',
                  description: 'Streetlight pole is completely dark at night.',
                  status: 'IN_PROGRESS',
                  createdAt: '2026-08-20T10:00:00Z',
                  category: { id: 'cat-1', name: 'Electrical' },
                },
              ],
              meta: { total: 1, page: 1, limit: 10, totalPages: 1 },
            }),
          });
        });

        await page.route('/api/auth/me', async (r) => {
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

        await page.route('/api/citizen/profile', async (r) => {
          await r.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              id: 'citizen_9876543210',
              name: 'Bajrang Kumar',
              email: 'kumarbajrang0154@gmail.com',
              mobileNumber: '9876543210',
              isProfileComplete: true,
            }),
          });
        });

        await page.route('/api/notifications', async (r) => {
          await r.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify([]),
          });
        });

        await page.route('/api/settings', async (r) => {
          await r.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              settings: { platformName: 'IntelliCivic', logoUrl: null },
            }),
          });
        });

        const consoleErrors: string[] = [];
        const networkErrors: string[] = [];

        page.on('console', (msg) => {
          if (msg.type() === 'error') {
            consoleErrors.push(msg.text());
          }
        });

        page.on('response', (res) => {
          if (res.status() >= 400) {
            networkErrors.push(`${res.status()} ${res.url()}`);
          }
        });

        await page.setViewportSize({ width: vp.width, height: vp.height });
        await page.goto(route.path, { waitUntil: 'networkidle' });

        // Save screenshot
        const screenshotPath = path.join(auditOutputDir, `${route.name}-${vp.name}.png`);
        await page.screenshot({ path: screenshotPath, fullPage: true });

        // Evaluate layout metrics and touch targets
        const auditMetrics = await page.evaluate(() => {
          const elements: any[] = [];
          const interactives = Array.from(document.querySelectorAll('button, a, input, select, textarea, [role="button"]'));

          interactives.forEach((el) => {
            const rect = el.getBoundingClientRect();
            const computed = window.getComputedStyle(el);
            const tag = el.tagName.toLowerCase();
            const text = (el.textContent || (el as HTMLInputElement).value || (el as HTMLElement).getAttribute('aria-label') || '').trim();
            const href = (el as HTMLAnchorElement).href || null;

            elements.push({
              tag,
              text: text.slice(0, 30),
              width: rect.width,
              height: rect.height,
              fontSize: computed.fontSize,
              href,
              isHrefHash: href ? href.endsWith('#') : false,
              isUnder44px: rect.width < 44 || rect.height < 44,
            });
          });

          const hasHOverflow = document.documentElement.scrollWidth > window.innerWidth;

          return {
            elementCount: interactives.length,
            elements,
            hasHOverflow,
            scrollWidth: document.documentElement.scrollWidth,
            innerWidth: window.innerWidth,
          };
        });

        console.log(`\n=== AUDIT METRICS: ${route.name} (${vp.name}) ===`);
        console.log(`Horizontal Overflow: ${auditMetrics.hasHOverflow} (scrollWidth: ${auditMetrics.scrollWidth}px vs innerWidth: ${auditMetrics.innerWidth}px)`);
        console.log(`Console Errors: ${consoleErrors.length}`);
        console.log(`Network Errors: ${networkErrors.length}`);
        console.log(`Total Interactive Elements: ${auditMetrics.elementCount}`);

        const touchDefects = auditMetrics.elements.filter((e: any) => e.isUnder44px);
        console.log(`Elements under 44px hit target: ${touchDefects.length}`);
        touchDefects.forEach((d: any) => {
          console.log(` - [${d.tag}] "${d.text}" size: ${Math.round(d.width)}x${Math.round(d.height)}px, font: ${d.fontSize}, href: ${d.href}`);
        });

        const deadHrefElements = auditMetrics.elements.filter((e: any) => e.isHrefHash);
        if (deadHrefElements.length > 0) {
          console.log(`Dead href="#" elements: ${deadHrefElements.length}`);
          deadHrefElements.forEach((d: any) => console.log(` - [${d.tag}] "${d.text}" has href="#"`));
        }
      });
    }
  }
});
