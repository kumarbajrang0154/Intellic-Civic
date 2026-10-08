import { test, expect, Page } from '@playwright/test';
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

const SCREENS_DIR = path.join(process.cwd(), 'e2e', 'screens');
if (!fs.existsSync(SCREENS_DIR)) {
  fs.mkdirSync(SCREENS_DIR, { recursive: true });
}

interface OverflowElement {
  page: string;
  viewport: number;
  selector: string;
  tag: string;
  classes: string;
  textSnippet: string;
  elementWidth: number;
  parentWidth: number;
  parentTag: string;
  diff: number;
}

async function findOverflowingElements(page: Page, pageName: string, viewportWidth: number): Promise<{ documentOverflow: boolean; scrollWidth: number; innerWidth: number; overflows: OverflowElement[] }> {
  return page.evaluate(({ pageName, viewportWidth }) => {
    const overflows: any[] = [];
    const docScrollWidth = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth);
    const winWidth = window.innerWidth;
    const documentOverflow = docScrollWidth > winWidth;

    const allElements = Array.from(document.querySelectorAll<HTMLElement>('*'));

    for (const el of allElements) {
      if (!el.offsetParent && el.tagName !== 'BODY' && el.tagName !== 'HTML') continue;
      const rect = el.getBoundingClientRect();
      const parent = el.parentElement;
      if (!parent) continue;
      const parentRect = parent.getBoundingClientRect();

      const style = window.getComputedStyle(el);
      const parentStyle = window.getComputedStyle(parent);
      if (style.overflowX === 'auto' || style.overflowX === 'scroll' || parentStyle.overflowX === 'auto' || parentStyle.overflowX === 'scroll') {
        continue;
      }

      // Skip internal Leaflet map engine tiles/proxies as they are clipped by .leaflet-container
      if (el.closest('.leaflet-container') || el.classList.contains('leaflet-tile') || el.classList.contains('leaflet-proxy')) {
        continue;
      }

      if (rect.right > parentRect.right + 2 && rect.width > 30 && parentRect.width > 50) {
        const isCardOrContainer = parent.classList.contains('rounded-2xl') || parent.classList.contains('rounded-xl') || parent.classList.contains('card') || parent.tagName === 'DIV' || parent.tagName === 'SECTION' || parent.tagName === 'MAIN';
        if (isCardOrContainer) {
          overflows.push({
            page: pageName,
            viewport: viewportWidth,
            selector: el.id ? `#${el.id}` : el.className ? `.${el.className.split(' ').slice(0, 3).join('.')}` : el.tagName.toLowerCase(),
            tag: el.tagName.toLowerCase(),
            classes: el.className || '',
            textSnippet: (el.innerText || el.textContent || '').trim().slice(0, 40),
            elementWidth: Math.round(rect.width),
            parentWidth: Math.round(parentRect.width),
            parentTag: parent.tagName.toLowerCase(),
            diff: Math.round(rect.right - parentRect.right),
          });
        }
      } else if (rect.right > winWidth + 2) {
        overflows.push({
          page: pageName,
          viewport: viewportWidth,
          selector: el.id ? `#${el.id}` : el.className ? `.${el.className.split(' ').slice(0, 3).join('.')}` : el.tagName.toLowerCase(),
          tag: el.tagName.toLowerCase(),
          classes: el.className || '',
          textSnippet: (el.innerText || el.textContent || '').trim().slice(0, 40),
          elementWidth: Math.round(rect.width),
          parentWidth: winWidth,
          parentTag: 'window',
          diff: Math.round(rect.right - winWidth),
        });
      }
    }

    return {
      documentOverflow,
      scrollWidth: docScrollWidth,
      innerWidth: winWidth,
      overflows,
    };
  }, { pageName, viewportWidth });
}

test.describe('Citizen Mobile Overflow Diagnostic & Assertions', () => {
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
            name: 'Bajrang Kumar',
            mobileNumber: '9876543210',
            role: 'CITIZEN',
            isProfileComplete: true,
            email: 'kumarbajrang0154@gmail.com',
            departmentId: null,
            municipalityId: 'muni-delhi-01',
          },
        }),
      });
    });

    await page.route('**/api/citizen/profile', async (r) => {
      await r.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'citizen_9876543210',
          name: 'Bajrang Kumar',
          mobileNumber: '9876543210',
          email: 'kumarbajrang0154@gmail.com',
          address: 'Block B-4, Green Park Extension, South Delhi',
          isProfileComplete: true,
          emergencyContact: '+91 9811223344',
          preferredLanguage: 'en',
          createdAt: new Date().toISOString(),
        }),
      });
    });

    await page.route('**/api/complaints?**', async (r) => {
      await r.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          complaints: [
            {
              id: 'comp-101',
              ticketId: 'TCK-MOBI-001',
              trackingCode: 'TCK-MOBI-001',
              title: 'Severe overflowing solid waste container blocking entire pedestrian corridor',
              description: 'Waste has not been cleared for over four days and is causing severe sanitation hazard.',
              status: 'IN_PROGRESS',
              priority: 'HIGH',
              category: { name: 'Sanitation & Solid Waste' },
              createdAt: new Date().toISOString(),
              address: 'Near Community Center, Gate 2',
            },
            {
              id: 'comp-102',
              ticketId: 'TCK-MOBI-002',
              trackingCode: 'TCK-MOBI-002',
              title: 'Open manhole on main connecting road',
              description: 'Dangerous open manhole without warning sign or barricade.',
              status: 'RESOLVED',
              priority: 'CRITICAL',
              category: { name: 'Roads & Infrastructure' },
              createdAt: new Date(Date.now() - 86400000).toISOString(),
              address: 'Sector 4 Crossroad',
            },
          ],
          total: 2,
        }),
      });
    });

    await page.route('**/api/complaints/comp-101', async (r) => {
      await r.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'comp-101',
          ticketId: 'TCK-MOBI-001',
          trackingCode: 'TCK-MOBI-001',
          title: 'Severe overflowing solid waste container blocking entire pedestrian corridor',
          description: 'Waste has not been cleared for over four days and is causing severe sanitation hazard in front of local market.',
          status: 'RESOLVED',
          priority: 'HIGH',
          category: { name: 'Sanitation & Solid Waste' },
          createdAt: new Date().toISOString(),
          resolvedAt: new Date().toISOString(),
          address: 'Near Community Center, Gate 2, Main Market Road',
          latitude: 28.6139,
          longitude: 77.209,
          resolutionNotes: 'Completed waste removal and sanitization of the surrounding area.',
          department: { name: 'Sanitation & Public Health' },
          assignedOfficer: { name: 'Sunil Verma', email: 'sunil.verma@city.gov' },
          timeline: [
            {
              id: 't-1',
              action: 'STATUS_CHANGE',
              fromStatus: 'IN_PROGRESS',
              toStatus: 'RESOLVED',
              createdAt: new Date().toISOString(),
              notes: 'Resolved by officer on site.',
            },
          ],
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
            title: 'Complaint Resolved',
            message: 'Your complaint #TCK-MOBI-001 status was updated to Resolved. Please review.',
            type: 'STATUS_UPDATE',
            isRead: false,
            createdAt: new Date().toISOString(),
            complaint: { id: 'comp-101', ticketId: 'TCK-MOBI-001' },
          },
        ]),
      });
    });
  });

  const citizenPages = [
    { name: 'Dashboard', path: '/citizen' },
    { name: 'NewComplaint', path: '/citizen/complaints/new' },
    { name: 'ComplaintDetail', path: '/citizen/complaints/comp-101' },
    { name: 'Notifications', path: '/citizen/notifications' },
    { name: 'Profile', path: '/citizen/profile' },
  ];

  for (const p of citizenPages) {
    test(`Assert no horizontal overflow & capture after-screenshot on ${p.name} at 375px and 360px`, async ({ page }) => {
      // 1. Check at 375px viewport
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto(p.path, { waitUntil: 'networkidle' });
      await page.waitForTimeout(300);

      const check375 = await findOverflowingElements(page, p.name, 375);
      expect(check375.scrollWidth, `${p.name} scrollWidth must be <= innerWidth (375px)`).toBeLessThanOrEqual(375);
      expect(check375.overflows.length, `${p.name} must have 0 elements overflowing parent at 375px`).toBe(0);

      const afterScreenPath = path.join(SCREENS_DIR, `after-${p.name}-375px.png`);
      await page.screenshot({ path: afterScreenPath, fullPage: true });

      // 2. Check at 360px viewport
      await page.setViewportSize({ width: 360, height: 640 });
      await page.waitForTimeout(300);

      const check360 = await findOverflowingElements(page, p.name, 360);
      expect(check360.scrollWidth, `${p.name} scrollWidth must be <= innerWidth (360px)`).toBeLessThanOrEqual(360);
      expect(check360.overflows.length, `${p.name} must have 0 elements overflowing parent at 360px`).toBe(0);
    });
  }
});
