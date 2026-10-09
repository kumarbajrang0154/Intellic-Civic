import { test, expect, Page } from '@playwright/test';
import { createAuthJwt, setAuthCookie } from './sweep/sweep-helpers';
import prisma from '../src/lib/prisma';

// Helper to inspect IndexedDB in browser context (resilient to offline fallback pages)
async function getDraftsFromIdb(page: Page): Promise<any[]> {
  return page.evaluate(async () => {
    if ((window as any).__offlineQueue?.getDrafts) {
      try {
        return await (window as any).__offlineQueue.getDrafts();
      } catch {}
    }
    return new Promise((resolve) => {
      const req = indexedDB.open('intellicivic_offline_db', 1);
      req.onsuccess = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('drafts')) return resolve([]);
        const tx = db.transaction('drafts', 'readonly');
        const store = tx.objectStore('drafts');
        const getAll = store.getAll();
        getAll.onsuccess = () => resolve(getAll.result || []);
        getAll.onerror = () => resolve([]);
      };
      req.onerror = () => resolve([]);
    });
  });
}

// Helper to clear IndexedDB in browser context
async function clearIdb(page: Page): Promise<void> {
  return page.evaluate(() => {
    return new Promise((resolve) => {
      const req = indexedDB.deleteDatabase('intellicivic_offline_db');
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
      req.onblocked = () => resolve();
    });
  });
}

// Helper to trigger sync in browser context
async function triggerSyncInPage(page: Page, userId?: string): Promise<any> {
  await page.waitForFunction(
    () => typeof (window as any).__offlineQueue?.syncDrafts === 'function',
    { timeout: 15000 },
  );
  return page.evaluate(async (uid) => {
    return await (window as any).__offlineQueue.syncDrafts(uid);
  }, userId);
}

test.describe('Offline Sync Real Flow with context.setOffline(true)', () => {
  test.setTimeout(90000);

  const citizenId = 'citizen_offline_flow_test';
  const citizenMobile = '9876543299';
  const citizenEmail = 'offline.test.citizen@civic.test';
  const createdClientRequestIds: string[] = [];

  test.beforeEach(async ({ page, context }) => {
    await context.clearCookies();

    // 1. Ensure test citizen exists in database with completed profile
    await prisma.user.upsert({
      where: { id: citizenId },
      update: {
        isSuspended: false,
        isAuthorized: true,
        address: '100 Main Street, Chennai',
        name: 'Offline Test Citizen',
        email: citizenEmail,
        mobileNumber: citizenMobile,
      },
      create: {
        id: citizenId,
        mobileNumber: citizenMobile,
        email: citizenEmail,
        name: 'Offline Test Citizen',
        address: '100 Main Street, Chennai',
        role: 'CITIZEN',
        authProvider: 'MOBILE_OTP',
        isAuthorized: true,
        isSuspended: false,
      },
    });

    const token = await createAuthJwt({
      sub: citizenId,
      role: 'CITIZEN',
      name: 'Offline Test Citizen',
      email: citizenEmail,
      mobileNumber: citizenMobile,
      isAuthorized: true,
      isProfileComplete: true,
    } as any);

    await setAuthCookie(context, token);
  });

  test.afterAll(async () => {
    // Clean up created complaints and test user
    if (createdClientRequestIds.length > 0) {
      await prisma.complaint.deleteMany({
        where: { clientRequestId: { in: createdClientRequestIds } },
      });
    }
    await prisma.complaint.deleteMany({
      where: { citizenId },
    });
    await prisma.user.deleteMany({
      where: { id: citizenId },
    });
  });

  test('1. Real flow: Submit complaint offline with photo -> Saved offline state -> Reconnect online -> Exactly ONE complaint in DB and appears in citizen list within 30s', async ({ page, context }) => {
    await page.goto('/citizen/complaints/new');
    await page.waitForLoadState('domcontentloaded');
    await clearIdb(page);

    const testTitle = `Real Offline Flow ${Date.now()}`;
    const testDesc = 'Water supply broken with major street flooding near market gate requiring immediate repair.';

    // Fill form
    await page.fill('input[id="title"]', testTitle);
    await page.fill('textarea[id="description"]', testDesc);

    // Upload photo evidence
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles({
      name: 'pothole-evidence.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=', 'base64'),
    });

    // Verify photo preview is visible in DOM
    await expect(page.locator('img[alt^="Evidence"]').first()).toBeVisible({ timeout: 10000 });

    // Go offline using context.setOffline(true)
    await context.setOffline(true);

    // Submit form offline
    await page.click('button[type="submit"]:has-text("Submit Complaint")');

    // Assert: UI shows visible "Saved Offline" state with description
    await expect(page.getByRole('heading', { name: 'Saved Offline' })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Saved offline, will submit when online').first()).toBeVisible({ timeout: 10000 });

    // Assert: Draft is stored in IndexedDB with status 'pending'
    const drafts = await getDraftsFromIdb(page);
    expect(drafts.length).toBe(1);
    expect(drafts[0].status).toBe('pending');
    expect(drafts[0].fields.title).toBe(testTitle);
    expect(drafts[0].photos.length).toBe(1);

    const clientRequestId = drafts[0].id;
    expect(clientRequestId).toBeTruthy();
    createdClientRequestIds.push(clientRequestId);

    // Assert: Database has ZERO complaints so far
    const dbRowsBeforeOnline = await prisma.complaint.findMany({
      where: { clientRequestId },
    });
    expect(dbRowsBeforeOnline.length).toBe(0);

    // Reconnect: setOffline(false)
    await context.setOffline(false);

    // Navigate to citizen dashboard
    await page.goto('/citizen');
    await page.waitForLoadState('domcontentloaded');

    // Poll DB until the complaint is created via offline sync (within 30s)
    await expect
      .poll(
        async () => {
          const rows = await prisma.complaint.findMany({
            where: { clientRequestId },
          });
          return rows.length;
        },
        { timeout: 30000, intervals: [500, 1000] },
      )
      .toBe(1);

    // Assert: Database has EXACTLY ONE row with this clientRequestId (idempotency, not two)
    const dbRowsAfterSync = await prisma.complaint.findMany({
      where: { clientRequestId },
    });
    expect(dbRowsAfterSync.length).toBe(1);
    expect(dbRowsAfterSync[0].title).toBe(testTitle);

    // Assert: Complaint is visible in citizen dashboard complaints list
    await expect(page.getByText(testTitle).first()).toBeVisible({ timeout: 10000 });

    // Assert: Draft has been cleaned up from IndexedDB
    await expect
      .poll(
        async () => {
          const draftsAfter = await getDraftsFromIdb(page);
          return draftsAfter.find((d) => d.id === clientRequestId);
        },
        { timeout: 15000, intervals: [500] },
      )
      .toBeUndefined();
  });

  test('2. Variant: Reload page while offline then go online -> Synced exactly once (assert 1 DB row, not 2)', async ({ page, context }) => {
    await page.goto('/citizen/complaints/new');
    await page.waitForLoadState('domcontentloaded');
    await clearIdb(page);

    const testTitle = `Reload Offline Variant ${Date.now()}`;
    const testDesc = 'Street light sparking dangerously near children park during evening hours.';

    // Fill form
    await page.fill('input[id="title"]', testTitle);
    await page.fill('textarea[id="description"]', testDesc);

    // Upload photo evidence
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles({
      name: 'sparking-pole.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=', 'base64'),
    });

    await expect(page.locator('img[alt^="Evidence"]').first()).toBeVisible({ timeout: 10000 });

    // Go offline
    await context.setOffline(true);

    // Submit form offline
    await page.click('button[type="submit"]:has-text("Submit Complaint")');

    // Assert: UI shows visible "Saved Offline"
    await expect(page.getByRole('heading', { name: 'Saved Offline' })).toBeVisible({ timeout: 10000 });

    // Assert: Draft in IndexedDB
    const drafts = await getDraftsFromIdb(page);
    expect(drafts.length).toBe(1);
    const clientRequestId = drafts[0].id;
    createdClientRequestIds.push(clientRequestId);

    // Reload page while STILL offline
    await page.reload({ waitUntil: 'commit' }).catch(() => {
      // In offline mode reload might trigger network error / fallback
    });

    // Check draft still preserved in IndexedDB
    const draftsAfterReload = await getDraftsFromIdb(page);
    expect(draftsAfterReload.length).toBe(1);
    expect(draftsAfterReload[0].id).toBe(clientRequestId);
    expect(draftsAfterReload[0].status).toBe('pending');

    // Now go online
    await context.setOffline(false);

    // Navigate to citizen dashboard
    await page.goto('/citizen');
    await page.waitForLoadState('domcontentloaded');

    // Poll DB until complaint is saved (within 30s)
    await expect
      .poll(
        async () => {
          const rows = await prisma.complaint.findMany({
            where: { clientRequestId },
          });
          return rows.length;
        },
        { timeout: 30000, intervals: [500, 1000] },
      )
      .toBe(1);

    // Assert: Exactly ONE row in DB (not two)
    const dbRows = await prisma.complaint.findMany({
      where: { clientRequestId },
    });
    expect(dbRows.length).toBe(1);
    expect(dbRows[0].title).toBe(testTitle);

    // Assert: Appears in citizen list
    await expect(page.getByText(testTitle).first()).toBeVisible({ timeout: 10000 });
  });

  test('3. Failure case: Server 500 during sync -> Stays queued in IndexedDB and retries, no duplicate', async ({ page, context }) => {
    await page.goto('/citizen/complaints/new');
    await page.waitForLoadState('domcontentloaded');
    await clearIdb(page);

    const testTitle = `Server 500 Retry Case ${Date.now()}`;
    const testDesc = 'Overfilled garbage bin causing foul odor and health hazard across residential street.';

    // Fill form
    await page.fill('input[id="title"]', testTitle);
    await page.fill('textarea[id="description"]', testDesc);

    // Upload photo evidence
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles({
      name: 'overflowing-bin.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=', 'base64'),
    });

    await expect(page.locator('img[alt^="Evidence"]').first()).toBeVisible({ timeout: 10000 });

    // Go offline
    await context.setOffline(true);

    // Submit form offline
    await page.click('button[type="submit"]:has-text("Submit Complaint")');
    await expect(page.getByRole('heading', { name: 'Saved Offline' })).toBeVisible({ timeout: 10000 });

    const drafts = await getDraftsFromIdb(page);
    expect(drafts.length).toBe(1);
    const clientRequestId = drafts[0].id;
    createdClientRequestIds.push(clientRequestId);

    // Intercept /api/complaints to return 500
    let mock500Hits = 0;
    await page.route('**/api/complaints', async (route) => {
      if (route.request().method() === 'POST') {
        mock500Hits++;
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Internal Server Error (Simulated 500 for test)' }),
        });
      } else {
        await route.continue();
      }
    });

    // Reconnect online: setOffline(false)
    await context.setOffline(false);

    // Navigate to citizen dashboard
    await page.goto('/citizen');
    await page.waitForLoadState('domcontentloaded');

    // Wait for the mock 500 to be hit during background sync
    await expect.poll(() => mock500Hits, { timeout: 30000, intervals: [300, 600] }).toBeGreaterThanOrEqual(1);

    // Assert: Draft stays queued in IndexedDB with status 'pending' (attempts incremented)
    const draftsAfter500 = await getDraftsFromIdb(page);
    expect(draftsAfter500.length).toBe(1);
    expect(draftsAfter500[0].id).toBe(clientRequestId);
    expect(draftsAfter500[0].status).toBe('pending');
    expect(draftsAfter500[0].attempts).toBeGreaterThanOrEqual(1);

    // Assert: Zero rows in DB during 500 failure
    const dbRowsDuring500 = await prisma.complaint.findMany({
      where: { clientRequestId },
    });
    expect(dbRowsDuring500.length).toBe(0);

    // Remove the 500 mock so subsequent attempts succeed
    await page.unroute('**/api/complaints');

    // Trigger retry sync now that server is healthy
    const retryResult = await triggerSyncInPage(page, citizenId);
    expect(retryResult.synced).toBe(1);

    // Assert: Exactly ONE DB row created in database (not two)
    const dbRowsAfterRetry = await prisma.complaint.findMany({
      where: { clientRequestId },
    });
    expect(dbRowsAfterRetry.length).toBe(1);
    expect(dbRowsAfterRetry[0].title).toBe(testTitle);

    // Assert: Draft has been removed from IndexedDB after successful retry
    const draftsAfterRetry = await getDraftsFromIdb(page);
    expect(draftsAfterRetry.find((d) => d.id === clientRequestId)).toBeUndefined();
  });
});
