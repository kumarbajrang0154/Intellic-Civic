import { test, expect } from '@playwright/test';
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

const OUT_DIR = path.resolve(process.cwd(), 'docs/screenshots/mobile-fix');

test.beforeAll(() => {
  if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
  }
});

test.describe('Capture Citizen Portal Mobile (375px) Layout Screenshots', () => {
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
        body: JSON.stringify({
          items: [
            {
              id: 'notif-1',
              title: 'Complaint Under Review by Municipal Authority',
              message: 'Your complaint CMP-2026-1001 regarding water leakage is currently being verified.',
              isRead: false,
              createdAt: '2026-09-01T10:00:00Z',
              complaintId: 'c-1',
              complaint: {
                ticketId: 'CMP-2026-1001',
                title: 'Major water leakage obstructing pedestrian crossing',
                status: 'IN_PROGRESS',
                priority: 'HIGH',
              },
            },
          ],
          unreadCount: 1,
        }),
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

  test('Capture all citizen pages at 375px', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 750 });

    // 1. Dashboard
    await page.goto('/citizen');
    await page.waitForSelector('h1:has-text("Welcome to Citizen Portal")');
    await page.waitForTimeout(500);
    await page.screenshot({
      path: path.join(OUT_DIR, 'dashboard-before-375px.png'),
      fullPage: true,
    });

    // 2. New Complaint
    await page.goto('/citizen/complaints/new');
    await page.waitForSelector('h1:has-text("File a New Complaint")');
    await page.waitForTimeout(500);
    await page.screenshot({
      path: path.join(OUT_DIR, 'new-complaint-before-375px.png'),
      fullPage: true,
    });

    // 3. Complaint Detail
    await page.goto('/citizen/complaints/c-1');
    await page.waitForSelector('text=CMP-2026-1001');
    await page.waitForTimeout(500);
    await page.screenshot({
      path: path.join(OUT_DIR, 'complaint-detail-before-375px.png'),
      fullPage: true,
    });

    // 4. Notifications
    await page.goto('/citizen/notifications');
    await page.waitForSelector('h1:has-text("Notifications")');
    await page.waitForTimeout(500);
    await page.screenshot({
      path: path.join(OUT_DIR, 'notifications-before-375px.png'),
      fullPage: true,
    });

    // 5. Profile
    await page.goto('/citizen/profile');
    await page.waitForSelector('text=Personal Information');
    await page.waitForTimeout(500);
    await page.screenshot({
      path: path.join(OUT_DIR, 'profile-before-375px.png'),
      fullPage: true,
    });

    // 6. Pending Offline List
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
    await page.waitForTimeout(500);
    await page.screenshot({
      path: path.join(OUT_DIR, 'pending-offline-before-375px.png'),
      fullPage: true,
    });
  });
});
