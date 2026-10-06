import { test, expect, Page } from '@playwright/test';
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

async function auditTouchTargets(page: Page, pageName: string) {
  await page.waitForLoadState('domcontentloaded');

  const violations = await page.evaluate(() => {
    const issues: { element: string; text: string; height: number; fontSize?: string; issue: string }[] = [];

    const candidates = Array.from(
      document.querySelectorAll<HTMLElement>(
        'button, input, select, textarea, [role="button"], a'
      )
    );

    for (const el of candidates) {
      const style = window.getComputedStyle(el);
      if (
        style.display === 'none' ||
        style.visibility === 'hidden' ||
        style.opacity === '0' ||
        el.offsetParent === null
      ) {
        continue;
      }

      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) {
        continue;
      }

      // Exclude inline paragraph links (running prose text)
      if (el.tagName === 'A' && (el.closest('p') || el.getAttribute('href')?.startsWith('https://www.openstreetmap.org'))) {
        continue;
      }

      // Exclude type="hidden" inputs
      if (el.tagName === 'INPUT' && (el as HTMLInputElement).type === 'hidden') {
        continue;
      }

      const text = (el.textContent || (el as HTMLInputElement).value || (el as HTMLInputElement).placeholder || '').slice(0, 30).trim();
      const isPrimary =
        el.getAttribute('type') === 'submit' ||
        el.className.includes('bg-primary') ||
        el.className.includes('bg-ic-blue') ||
        el.className.includes('bg-[#2563EB]') ||
        el.className.includes('bg-amber-600') ||
        /(submit|verify|file new|complete profile|track this)/i.test(text);

      const requiredHeight = isPrimary ? 43.5 : 39.5;
      const targetLabel = isPrimary ? '44px (primary action)' : '40px';

      if (rect.height < requiredHeight) {
        issues.push({
          element: `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${el.className ? '.' + el.className.split(' ').slice(0, 2).join('.') : ''}`,
          text,
          height: Math.round(rect.height * 10) / 10,
          issue: `Height ${Math.round(rect.height * 10) / 10}px < ${targetLabel}`,
        });
      }

      // Check font-size >= 16px for input, select, textarea to prevent iOS zoom
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName)) {
        const inputType = (el as HTMLInputElement).type;
        if (!['checkbox', 'radio', 'hidden', 'file'].includes(inputType)) {
          const fontSize = parseFloat(style.fontSize);
          if (fontSize < 15.5) {
            issues.push({
              element: `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}`,
              text: (el as HTMLInputElement).placeholder || (el as HTMLInputElement).value || '',
              height: Math.round(rect.height * 10) / 10,
              fontSize: style.fontSize,
              issue: `Font size ${style.fontSize} < 16px`,
            });
          }
        }
      }
    }

    return issues;
  });

  expect(violations, `Touch target violations on ${pageName}:\n${JSON.stringify(violations, null, 2)}`).toEqual([]);
}

test.describe('Mobile (375px) Citizen Portal Touch Target & Font Size Audit', () => {
  test.use({
    viewport: { width: 375, height: 667 },
  });

  test('Citizen Login page has compliant touch targets & font size', async ({ page }) => {
    await page.goto('/login/citizen');
    await page.waitForSelector('#mobileNumber');
    await auditTouchTargets(page, 'Citizen Login (Phone Step)');
  });

  test.describe('Authenticated Citizen Pages', () => {
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

      await page.route('**/api/auth/me', async (r) => {
        await r.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            user: {
              id: 'citizen_9876543210',
              role: 'CITIZEN',
              name: 'Bajrang Kumar',
              mobileNumber: '9876543210',
              email: 'kumarbajrang0154@gmail.com',
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

      await page.route('**/api/notifications', async (r) => {
        await r.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            {
              id: 'notif-1',
              title: 'Complaint Under Review',
              message: 'Your complaint CMP-2026-1001 is now under review.',
              isRead: false,
              createdAt: '2026-09-01T10:00:00Z',
              complaintId: 'c-1',
            },
          ]),
        });
      });

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
                description: 'Streetlight pole is dark creating hazard.',
                status: 'RESOLVED',
                createdAt: '2026-08-20T10:00:00Z',
                category: { id: 'cat-1', name: 'Electrical' },
              },
            ],
            meta: { total: 1, page: 1, limit: 10, totalPages: 1 },
          }),
        });
      });

      await page.route('**/api/complaints/c-1', async (r) => {
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
    });

    test('Citizen Dashboard page has compliant touch targets & font size', async ({ page }) => {
      await page.goto('/citizen');
      await page.waitForSelector('h1:has-text("Welcome to Citizen Portal")');
      await auditTouchTargets(page, 'Citizen Dashboard');
    });

    test('New Complaint page has compliant touch targets & font size', async ({ page }) => {
      await page.goto('/citizen/complaints/new');
      await page.waitForSelector('form');
      await auditTouchTargets(page, 'New Complaint');

      // Assert Leaflet map/location-picker: container has explicit height, works at 375px, no overflow
      const mapContainer = page.locator('div.h-\\[260px\\]').first();
      await expect(mapContainer).toBeVisible();
      const mapBox = await mapContainer.boundingBox();
      expect(mapBox).not.toBeNull();
      expect(mapBox!.height).toBeGreaterThanOrEqual(200);
      expect(mapBox!.width).toBeLessThanOrEqual(375);

      const hasHorizontalScroll = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth
      );
      expect(hasHorizontalScroll).toBe(false);
    });

    test('Complaint Detail page has compliant touch targets & font size', async ({ page }) => {
      await page.goto('/citizen/complaints/c-1');
      await page.waitForSelector('text=CMP-2026-1001');
      await auditTouchTargets(page, 'Complaint Detail');
    });

    test('Notifications page has compliant touch targets & font size', async ({ page }) => {
      await page.goto('/citizen/notifications');
      await page.locator('main').waitFor();
      await auditTouchTargets(page, 'Notifications');
    });

    test('Profile page has compliant touch targets & font size', async ({ page }) => {
      await page.goto('/citizen/profile');
      await page.waitForSelector('text=Personal Information');
      await auditTouchTargets(page, 'Profile');
    });
  });
});
