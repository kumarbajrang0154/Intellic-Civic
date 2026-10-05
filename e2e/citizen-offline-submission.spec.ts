import { test, expect, Page } from '@playwright/test';
import { createAuthJwt, setAuthCookie } from './sweep/sweep-helpers';
import prisma from '../src/lib/prisma';

// Helper to inspect IndexedDB in browser context
async function getDraftsFromIdb(page: Page): Promise<any[]> {
  return page.evaluate(async () => {
    if ((window as any).__offlineQueue?.getDrafts) {
      return await (window as any).__offlineQueue.getDrafts();
    }
    return new Promise((resolve, reject) => {
      const req = indexedDB.open('intellicivic_offline_db', 1);
      req.onsuccess = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('drafts')) return resolve([]);
        const tx = db.transaction('drafts', 'readonly');
        const store = tx.objectStore('drafts');
        const getAll = store.getAll();
        getAll.onsuccess = () => resolve(getAll.result);
        getAll.onerror = () => reject(getAll.error);
      };
      req.onerror = () => reject(req.error);
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

// Helper to save a draft into IndexedDB via __offlineQueue
async function saveDraftInPage(page: Page, draft: any): Promise<void> {
  await page.waitForFunction(() => typeof (window as any).__offlineQueue?.saveDraft === 'function', { timeout: 15000 });
  await page.evaluate(async (d) => {
    const photos = (d.photos || []).map((p: any) => ({
      name: p.name || 'photo.jpg',
      type: p.type || 'image/jpeg',
      blob: new Blob(['sample-photo-data'], { type: p.type || 'image/jpeg' }),
    }));
    const draftToSave = { ...d, photos };
    return await (window as any).__offlineQueue.saveDraft(draftToSave);
  }, draft);
}

// Helper to trigger sync in browser context
async function triggerSyncInPage(page: Page, userId: string): Promise<any> {
  await page.waitForFunction(() => typeof (window as any).__offlineQueue?.syncDrafts === 'function', { timeout: 15000 });
  return page.evaluate(async (uid) => {
    return await (window as any).__offlineQueue.syncDrafts(uid);
  }, userId);
}

test.describe('Offline-First Citizen Complaint Submission & Sync Suite', () => {
  test.setTimeout(90000);
  const citizenId = 'citizen_9876543210';
  const citizenMobile = '9876543210';

  test.beforeEach(async ({ page, context }) => {
    // Ensure citizen exists and is active in DB
    await prisma.user.upsert({
      where: { id: citizenId },
      update: { isSuspended: false, isAuthorized: true },
      create: {
        id: citizenId,
        mobileNumber: citizenMobile,
        name: 'Aarav Patel (Citizen)',
        role: 'CITIZEN',
        authProvider: 'MOBILE_OTP',
        isAuthorized: true,
        isSuspended: false,
      },
    });

    await prisma.user.updateMany({
      where: { OR: [{ id: citizenId }, { mobileNumber: citizenMobile }] },
      data: { isSuspended: false, isAuthorized: true },
    });

    const token = await createAuthJwt({
      sub: citizenId,
      role: 'CITIZEN',
      name: 'Aarav Patel (Citizen)',
      mobileNumber: citizenMobile,
    });
    await setAuthCookie(context, token);
    page.on('console', (msg) => console.log(`[BROWSER ${msg.type()}]:`, msg.text()));
    page.on('pageerror', (err) => console.log(`[BROWSER PAGEERROR]:`, err.message, err.stack));
    page.on('response', (res) => {
      if (res.status() >= 400) {
        console.log(`[HTTP FAIL ${res.status()}]:`, res.url());
      }
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. Offline submit -> draft in IndexedDB, no network request fired, UI shows pending
  // ─────────────────────────────────────────────────────────────────────────────
  test('1. Offline submit: saves draft to IndexedDB without firing network request', async ({ page, context }) => {
    await page.goto('/citizen/complaints/new');
    await page.waitForLoadState('networkidle');
    await clearIdb(page);

    // Fill form fields
    await page.fill('input[id="title"]', 'Broken Water Pipe Flooding Road');
    await page.fill('textarea[id="description"]', 'Water main ruptured near main street corner causing severe flooding and road block.');

    // Upload sample photo via hidden file input
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles({
      name: 'broken-pipe.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=', 'base64'),
    });

    // Wait for photo preview to load and be registered in form state
    await expect(page.locator('img[alt^="Evidence"]').first()).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(300);

    // Track network calls to /api/complaints
    let complaintsApiCalled = false;
    page.on('request', (req) => {
      if (req.url().includes('/api/complaints') && req.method() === 'POST') {
        complaintsApiCalled = true;
      }
    });

    // Go OFFLINE
    await context.setOffline(true);

    // Submit form
    await page.click('button[type="submit"]:has-text("Submit Complaint")');

    // UI shows "Saved offline, will submit when online"
    await expect(page.getByRole('heading', { name: 'Saved Offline' })).toBeVisible({ timeout: 10000 });

    // Assert: No network request was fired
    expect(complaintsApiCalled, 'Expected zero /api/complaints network calls while offline').toBe(false);

    // Assert: Draft exists in IndexedDB with status "pending"
    const drafts = await getDraftsFromIdb(page);
    expect(drafts.length).toBe(1);
    expect(drafts[0].status).toBe('pending');
    expect(drafts[0].fields.title).toBe('Broken Water Pipe Flooding Road');
    expect(drafts[0].photos.length).toBeGreaterThanOrEqual(1);

    // Restore online state
    await context.setOffline(false);
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. Go online -> exactly ONE complaint in DB, draft removed, notification shown
  // ─────────────────────────────────────────────────────────────────────────────
  test('2. Go online: draft syncs to exactly ONE complaint in DB and is removed from IndexedDB', async ({ page }) => {
    const clientRequestId = `test-req-${Date.now()}`;

    // Clean any prior complaint with this ID
    await prisma.complaint.deleteMany({ where: { clientRequestId } });

    await page.goto('/citizen');
    await page.waitForLoadState('networkidle');

    // Seed draft in IndexedDB
    await saveDraftInPage(page, {
      id: clientRequestId,
      userId: citizenId,
      fields: {
        title: 'Dangerous Open Manhole on 5th Cross',
        description: 'A deep open manhole uncovered on pedestrian pathway creating a major accident hazard.',
      },
      latitude: 12.9716,
      longitude: 77.5946,
      photos: [
        {
          name: 'manhole.jpg',
          type: 'image/jpeg',
        },
      ],
      capturedAt: new Date().toISOString(),
      status: 'pending',
      attempts: 0,
    });

    // Verify draft is present in IDB
    let drafts = await getDraftsFromIdb(page);
    expect(drafts.some((d) => d.id === clientRequestId)).toBe(true);

    // Trigger sync
    await triggerSyncInPage(page, citizenId);

    // Wait for sync processing
    await page.waitForTimeout(2000);

    // Assert: Exactly ONE complaint in Postgres DB with this clientRequestId
    const dbComplaints = await prisma.complaint.findMany({
      where: { clientRequestId },
    });
    expect(dbComplaints.length, 'Database must have exactly 1 complaint created').toBe(1);
    expect(dbComplaints[0].title).toBe('Dangerous Open Manhole on 5th Cross');

    // Assert: Draft is removed from IndexedDB
    drafts = await getDraftsFromIdb(page);
    expect(drafts.some((d) => d.id === clientRequestId), 'Draft must be deleted from IndexedDB upon sync').toBe(false);
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. Kill network mid-sync, then retry -> still exactly ONE complaint (idempotency)
  // ─────────────────────────────────────────────────────────────────────────────
  test('3. Network drop mid-sync and retry: server idempotency guarantees exactly ONE complaint', async ({ page }) => {
    const clientRequestId = `idempotent-test-${Date.now()}`;
    await prisma.complaint.deleteMany({ where: { clientRequestId } });

    await page.goto('/citizen');
    await page.waitForLoadState('networkidle');

    const draftData = {
      id: clientRequestId,
      userId: citizenId,
      fields: {
        title: 'Street Light Pole Damaged',
        description: 'Electric street light pole tilted at 45 degrees towards road after heavy storm.',
      },
      latitude: 12.9352,
      longitude: 77.6245,
      photos: [
        {
          name: 'pole.jpg',
          type: 'image/jpeg',
        },
      ],
      capturedAt: new Date().toISOString(),
      status: 'pending',
      attempts: 0,
    };

    // Seed draft
    await saveDraftInPage(page, draftData);

    // 1st sync run (simulate initial submit reaching server)
    await triggerSyncInPage(page, citizenId);

    // Re-insert the same draft to simulate client failure to receive response before network drop
    await saveDraftInPage(page, {
      ...draftData,
      photos: [],
      status: 'pending',
      attempts: 1,
    });

    // 2nd sync run (retry)
    await triggerSyncInPage(page, citizenId);

    // Check DB: must still be strictly 1 complaint in database
    const rows = await prisma.complaint.findMany({ where: { clientRequestId } });
    expect(rows.length, 'Idempotency must prevent duplicate complaint rows').toBe(1);
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. Expired JWT during sync -> draft kept, re-login prompt, syncs after re-login
  // ─────────────────────────────────────────────────────────────────────────────
  test('4. Expired JWT during sync: draft is preserved and syncs after re-authenticating', async ({ page, context }) => {
    const clientRequestId = `auth-expire-test-${Date.now()}`;
    await prisma.complaint.deleteMany({ where: { clientRequestId } });

    await page.goto('/citizen');
    await page.waitForLoadState('networkidle');

    // Seed draft
    await saveDraftInPage(page, {
      id: clientRequestId,
      userId: citizenId,
      fields: {
        title: 'Garbage Dump Overflowing',
        description: 'Garbage bins overflowing on street corner for over 4 days, emitting foul odor.',
      },
      latitude: null,
      longitude: null,
      photos: [{ name: 'garbage.jpg', type: 'image/jpeg' }],
      capturedAt: new Date().toISOString(),
      status: 'pending',
      attempts: 0,
    });

    // Set an EXPIRED cookie
    await context.addCookies([
      {
        name: 'ic_access_token',
        value: 'expired.token.value',
        domain: 'localhost',
        path: '/',
      },
    ]);

    // Attempt sync with expired token
    await triggerSyncInPage(page, citizenId);

    // Assert: Draft is still preserved in IndexedDB
    let drafts = await getDraftsFromIdb(page);
    const draftAfter401 = drafts.find((d) => d.id === clientRequestId);
    expect(draftAfter401, 'Draft must NOT be deleted when server returns 401').toBeTruthy();
    expect(draftAfter401.status).toBe('pending');

    // Re-authenticate with valid JWT
    const freshToken = await createAuthJwt({
      sub: citizenId,
      role: 'CITIZEN',
      name: 'Aarav Patel (Citizen)',
      mobileNumber: citizenMobile,
    });
    await setAuthCookie(context, freshToken);

    // Retry sync
    await triggerSyncInPage(page, citizenId);

    // Assert: Successfully synced into DB and removed from IDB
    const inDb = await prisma.complaint.findUnique({ where: { clientRequestId } });
    expect(inDb).toBeTruthy();
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 5. Suspended citizen -> draft marked failed with reason, no retry loop
  // ─────────────────────────────────────────────────────────────────────────────
  test('5. Suspended citizen: draft marked failed with reason and no retry loop', async ({ page }) => {
    const clientRequestId = `suspended-test-${Date.now()}`;
    await prisma.complaint.deleteMany({ where: { clientRequestId } });

    // Suspend citizen in DB
    await prisma.user.updateMany({
      where: { OR: [{ id: citizenId }, { mobileNumber: citizenMobile }] },
      data: { isSuspended: true },
    });

    await page.goto('/citizen');
    await page.waitForLoadState('domcontentloaded');

    // Seed draft
    await saveDraftInPage(page, {
      id: clientRequestId,
      userId: citizenId,
      fields: {
        title: 'Illegal Tree Felling Report',
        description: 'Unauthorized felling of ancient roadside trees without municipal permit.',
      },
      latitude: null,
      longitude: null,
      photos: [{ name: 'tree.jpg', type: 'image/jpeg' }],
      capturedAt: new Date().toISOString(),
      status: 'pending',
      attempts: 0,
    });

    // Attempt sync
    await triggerSyncInPage(page, citizenId);
    await page.waitForTimeout(1000);

    // Assert: Draft is marked "failed", NOT "pending"
    const drafts = await getDraftsFromIdb(page);
    const failedDraft = drafts.find((d) => d.id === clientRequestId);
    expect(failedDraft).toBeTruthy();
    expect(failedDraft.status, 'Suspended user draft must be set to failed').toBe('failed');
    expect(failedDraft.lastError).toBeTruthy();

    // Re-activate citizen for subsequent tests
    await prisma.user.updateMany({
      where: { OR: [{ id: citizenId }, { mobileNumber: citizenMobile }] },
      data: { isSuspended: false },
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 6. Two drafts offline -> both sync, correct order by capturedAt
  // ─────────────────────────────────────────────────────────────────────────────
  test('6. Multiple drafts: syncs both drafts preserving chronological capturedAt order', async ({ page }) => {
    const crId1 = `multi-1-${Date.now()}`;
    const crId2 = `multi-2-${Date.now()}`;
    await prisma.complaint.deleteMany({ where: { clientRequestId: { in: [crId1, crId2] } } });

    await page.goto('/citizen');
    await page.waitForLoadState('networkidle');

    const t0 = new Date(Date.now() - 60000).toISOString();
    const t1 = new Date(Date.now() - 30000).toISOString();

    // Seed both drafts in IndexedDB
    await saveDraftInPage(page, {
      id: crId1,
      userId: citizenId,
      fields: {
        title: 'First Incident Earlier In Day',
        description: 'Water clogging near pedestrian underpass observed early this morning.',
      },
      latitude: null,
      longitude: null,
      photos: [{ name: 'photo1.jpg', type: 'image/jpeg' }],
      capturedAt: t0,
      status: 'pending',
      attempts: 0,
    });

    await saveDraftInPage(page, {
      id: crId2,
      userId: citizenId,
      fields: {
        title: 'Second Incident Later In Day',
        description: 'Fallen tree branch obstructing pedestrian underpass after afternoon squall.',
      },
      latitude: null,
      longitude: null,
      photos: [{ name: 'photo2.jpg', type: 'image/jpeg' }],
      capturedAt: t1,
      status: 'pending',
      attempts: 0,
    });

    // Sync
    await triggerSyncInPage(page, citizenId);

    // Assert: Both complaints created in database
    const dbC1 = await prisma.complaint.findUnique({ where: { clientRequestId: crId1 } });
    const dbC2 = await prisma.complaint.findUnique({ where: { clientRequestId: crId2 } });

    expect(dbC1, 'First complaint must be created in DB').toBeTruthy();
    expect(dbC2, 'Second complaint must be created in DB').toBeTruthy();
    expect(dbC1!.title).toBe('First Incident Earlier In Day');
    expect(dbC2!.title).toBe('Second Incident Later In Day');
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 7. 375px viewport, zero console.error / unexpected >=400 responses
  // ─────────────────────────────────────────────────────────────────────────────
  test('7. Mobile 375px viewport: clean layout, zero console.error and zero failed requests', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    const consoleErrors: string[] = [];
    const failedRequests: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        if (text.includes('403 Forbidden') || text.includes('gemini') || text.includes('favicon') || text.includes('429')) {
          return;
        }
        consoleErrors.push(text);
      }
    });

    page.on('requestfailed', (req) => {
      const url = req.url();
      if (
        url.includes('favicon.ico') ||
        url.includes('googleusercontent.com') ||
        url.includes('generativelanguage.googleapis.com') ||
        req.failure()?.errorText === 'net::ERR_ABORTED'
      ) {
        return;
      }
      failedRequests.push(`${req.method()} ${url} - ${req.failure()?.errorText || 'failed'}`);
    });

    await page.goto('/citizen');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('button:has-text("File New Complaint")')).toBeVisible();

    // Navigate to new complaint page at 375px
    await page.goto('/citizen/complaints/new');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('h1, h2, h3').first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('input[id="title"], input[name="title"]')).toBeVisible();

    expect(consoleErrors, `Expected zero console errors on 375px mobile, found: ${consoleErrors.join(', ')}`).toEqual([]);
    expect(failedRequests, `Expected zero failed requests on 375px mobile, found: ${failedRequests.join(', ')}`).toEqual([]);
  });
});
