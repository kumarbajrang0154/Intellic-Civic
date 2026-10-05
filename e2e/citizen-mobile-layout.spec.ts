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

interface Offender {
  page: string;
  selector: string;
  text: string;
  width: number;
  reason: string;
}

async function detectLayoutOffenders(page: Page, pageName: string, width: number): Promise<Offender[]> {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(500);

  return await page.evaluate(({ pageName, width }) => {
    const offenders: { page: string; selector: string; text: string; width: number; reason: string }[] = [];

    // Helper to get compact selector
    const getSelector = (el: Element): string => {
      if (el.id) return `#${el.id}`;
      const tag = el.tagName.toLowerCase();
      const classes = el.className && typeof el.className === 'string'
        ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.')
        : '';
      return `${tag}${classes}`;
    };

    // (a) Horizontal Page Scroll
    const clientWidth = document.documentElement.clientWidth;
    const scrollWidth = document.documentElement.scrollWidth;
    if (scrollWidth > clientWidth + 1) {
      // Find element causing the overflow
      const allEls = Array.from(document.querySelectorAll('*'));
      for (const el of allEls) {
        const rect = el.getBoundingClientRect();
        if (rect.right > clientWidth + 2 && rect.width > 0) {
          offenders.push({
            page: pageName,
            selector: getSelector(el),
            text: (el.textContent || '').slice(0, 30).trim(),
            width,
            reason: `Horizontal page overflow (element right ${Math.round(rect.right)}px > viewport ${clientWidth}px)`,
          });
        }
      }
    }

    // (b) Text overflowing its own box or overlapping siblings
    const textEls = Array.from(document.querySelectorAll<HTMLElement>('p, h1, h2, h3, h4, h5, h6, span, label, td, th, li, a, button'));
    for (const el of textEls) {
      const style = window.getComputedStyle(el);
      if (
        style.display === 'none' ||
        style.visibility === 'hidden' ||
        style.opacity === '0' ||
        el.offsetParent === null
      ) {
        continue;
      }

      // Check text overflow if no truncate/clip/hidden
      const isClipped = style.overflow === 'hidden' || style.overflowX === 'hidden' || style.textOverflow === 'ellipsis' || style.webkitLineClamp !== 'none';
      if (!isClipped && el.scrollWidth > el.clientWidth + 2 && el.clientWidth > 0) {
        offenders.push({
          page: pageName,
          selector: getSelector(el),
          text: (el.textContent || '').slice(0, 30).trim(),
          width,
          reason: `Text box overflow (${Math.round(el.scrollWidth)}px > ${Math.round(el.clientWidth)}px)`,
        });
      }

      // Check sibling overlap for flex items or adjacent text blocks
      const next = el.nextElementSibling as HTMLElement | null;
      if (next && textEls.includes(next)) {
        const nextStyle = window.getComputedStyle(next);
        if (nextStyle.display !== 'none' && nextStyle.visibility !== 'hidden' && next.offsetParent !== null) {
          const r1 = el.getBoundingClientRect();
          const r2 = next.getBoundingClientRect();
          // Detect overlap
          const overlapX = Math.max(0, Math.min(r1.right, r2.right) - Math.max(r1.left, r2.left));
          const overlapY = Math.max(0, Math.min(r1.bottom, r2.bottom) - Math.max(r1.top, r2.top));
          if (overlapX > 4 && overlapY > 4 && r1.width > 0 && r2.width > 0) {
            offenders.push({
              page: pageName,
              selector: `${getSelector(el)} overlaps ${getSelector(next)}`,
              text: `${(el.textContent || '').slice(0, 15)} / ${(next.textContent || '').slice(0, 15)}`,
              width,
              reason: `Sibling bounding box overlap (${Math.round(overlapX)}x${Math.round(overlapY)}px)`,
            });
          }
        }
      }
    }

    // (c) Interactive controls shorter than 44px
    const interactives = Array.from(document.querySelectorAll<HTMLElement>('button, input, select, textarea, [role="button"], a[href]'));
    for (const el of interactives) {
      const style = window.getComputedStyle(el);
      if (
        style.display === 'none' ||
        style.visibility === 'hidden' ||
        style.opacity === '0' ||
        el.offsetParent === null
      ) {
        continue;
      }

      if (el.tagName === 'INPUT' && (el as HTMLInputElement).type === 'hidden') continue;
      // Exclude running prose links and map attribution
      if (el.tagName === 'A' && (el.closest('p') || el.getAttribute('href')?.startsWith('https://www.openstreetmap.org') || el.closest('.leaflet-control-attribution'))) continue;

      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;

      if (rect.height < 43.5) {
        offenders.push({
          page: pageName,
          selector: getSelector(el),
          text: (el.textContent || (el as HTMLInputElement).value || (el as HTMLInputElement).placeholder || '').slice(0, 30).trim(),
          width,
          reason: `Interactive height ${Math.round(rect.height * 10) / 10}px < 44px`,
        });
      }
    }

    return offenders;
  }, { pageName, width });
}

test.describe('Citizen Mobile Layout & Responsive Overflow Audit (360px, 375px, 414px)', () => {
  const widths = [360, 375, 414];

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
            title: 'Complaint Under Review by Municipal Authority',
            message: 'Your complaint CMP-2026-1001 regarding water leakage is currently being verified.',
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
          { id: 'cat-1', name: 'Roads & Potholes Maintenance' },
          { id: 'cat-2', name: 'Solid Waste & Sanitation Management' },
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
              title: 'Major water leakage obstructing pedestrian crossing',
              description: 'Continuous drinking water leakage on main road creating severe puddle.',
              status: 'IN_PROGRESS',
              priority: 'HIGH',
              createdAt: '2026-08-20T10:00:00Z',
              category: { id: 'cat-1', name: 'Water & Sewerage' },
              department: { id: 'dept-1', name: 'Water Supply Board' },
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
          title: 'Major water leakage obstructing pedestrian crossing',
          description: 'Continuous drinking water leakage on main road creating severe puddle.',
          status: 'IN_PROGRESS',
          priority: 'HIGH',
          createdAt: '2026-08-20T10:00:00Z',
          updatedAt: '2026-08-20T10:00:00Z',
          category: { id: 'cat-1', name: 'Water & Sewerage' },
          department: { id: 'dept-1', name: 'Water Supply Board' },
          evidence: [],
          statusHistory: [
            { id: 'sh-1', toStatus: 'SUBMITTED', notes: 'Initial submission', changedAt: '2026-08-20T10:00:00Z' },
            { id: 'sh-2', toStatus: 'IN_PROGRESS', notes: 'Field team dispatched', changedAt: '2026-08-20T11:00:00Z' },
          ],
        }),
      });
    });
  });

  for (const width of widths) {
    test(`Mobile Layout Audit at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 750 });
      const allOffenders: Offender[] = [];

      // 1. Dashboard
      await page.goto('/citizen');
      await page.waitForSelector('h1:has-text("Welcome to Citizen Portal")');
      const dashOffenders = await detectLayoutOffenders(page, 'Dashboard', width);
      allOffenders.push(...dashOffenders);

      // 2. New Complaint
      await page.goto('/citizen/complaints/new');
      await page.waitForSelector('h1:has-text("File a New Complaint")');
      const newOffenders = await detectLayoutOffenders(page, 'New Complaint', width);
      allOffenders.push(...newOffenders);

      // 3. Complaint Detail
      await page.goto('/citizen/complaints/c-1');
      await page.waitForSelector('text=CMP-2026-1001');
      const detailOffenders = await detectLayoutOffenders(page, 'Complaint Detail', width);
      allOffenders.push(...detailOffenders);

      // 4. Notifications
      await page.goto('/citizen/notifications');
      await page.waitForSelector('h1:has-text("Notifications")');
      const notifOffenders = await detectLayoutOffenders(page, 'Notifications', width);
      allOffenders.push(...notifOffenders);

      // 5. Profile
      await page.goto('/citizen/profile');
      await page.waitForSelector('text=Personal Information');
      const profileOffenders = await detectLayoutOffenders(page, 'Profile', width);
      allOffenders.push(...profileOffenders);

      // 6. Pending-Offline list on Dashboard
      await page.goto('/citizen');
      await page.waitForSelector('h1:has-text("Welcome to Citizen Portal")');
      await page.evaluate(async () => {
        await new Promise<void>((resolve, reject) => {
          const req = indexedDB.open('intellicivic_offline_db', 1);
          req.onupgradeneeded = (e: any) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains('drafts')) {
              const store = db.createObjectStore('drafts', { keyPath: 'id' });
              store.createIndex('userId', 'userId', { unique: false });
            }
          };
          req.onsuccess = (e: any) => {
            const db = e.target.result;
            const tx = db.transaction('drafts', 'readwrite');
            const store = tx.objectStore('drafts');
            store.put({
              id: 'offline-test-draft-1',
              userId: 'citizen_9876543210',
              fields: {
                title: 'Fallen electric cable on pedestrian sidewalk',
                description: 'Severe safety hazard near school entrance gate.',
              },
              status: 'failed',
              lastError: 'Network connection lost during upload',
              capturedAt: new Date().toISOString(),
              attempts: 1,
              photos: [],
            });
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
          };
          req.onerror = () => reject(req.error);
        });
      });
      await page.reload();
      await page.waitForSelector('text=Fallen electric cable');
      const pendingOffenders = await detectLayoutOffenders(page, 'Pending Offline List', width);
      allOffenders.push(...pendingOffenders);

      // Print offenders formatted as required: page | selector | text | width
      if (allOffenders.length > 0) {
        console.log(`\n=== OFFENDERS FOUND AT ${width}px (${allOffenders.length}) ===`);
        for (const o of allOffenders) {
          console.log(`${o.page} | ${o.selector} | "${o.text}" | ${o.width}px -> ${o.reason}`);
        }
      }

      expect(allOffenders, `Found ${allOffenders.length} layout offenders at ${width}px`).toEqual([]);
    });
  }
});
