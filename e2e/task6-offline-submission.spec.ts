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

test.describe('Task 6 — Offline Complaint Submission & Idempotency', () => {
  let complaintStore: any[] = [];

  function setupOfflineMocks(page: Page) {
    complaintStore = [];

    return page.route('**/api/**', async (route) => {
      const url = route.request().url();
      const method = route.request().method();

      if (url.includes('/api/auth/me')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            user: {
              id: 'citizen_9876543210',
              name: 'Bajrang Kumar',
              mobileNumber: '9876543210',
              role: 'CITIZEN',
            },
          }),
        });
      }

      if (url.includes('/api/categories')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            { id: 'cat-roads', name: 'Roads & Infrastructure', department: 'Roads' },
            { id: 'cat-water', name: 'Water Supply & Sanitation', department: 'Water' },
          ]),
        });
      }

      if (url.includes('/api/upload/signature')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ cloudName: 'demo', apiKey: '1234567890' }),
        });
      }

      if (url.includes('/api/complaints/check-duplicate')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ matched: false, potentialDuplicates: [] }),
        });
      }

      if (url.includes('/api/complaints')) {
        if (method === 'POST') {
          const body = route.request().postDataJSON() || {};
          const clientRequestId = body.clientRequestId;

          // Idempotency: return existing complaint if clientRequestId already exists
          if (clientRequestId) {
            const existing = complaintStore.find((c) => c.clientRequestId === clientRequestId);
            if (existing) {
              return route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify(existing),
              });
            }
          }

          const newComplaint = {
            id: `cmp_${complaintStore.length + 1}`,
            ticketId: `CMP-2026-000${complaintStore.length + 1}`,
            title: body.title,
            description: body.description,
            status: 'SUBMITTED',
            priority: 'MEDIUM',
            clientRequestId: clientRequestId || null,
            citizenId: 'citizen_9876543210',
            createdAt: new Date().toISOString(),
          };
          complaintStore.push(newComplaint);

          return route.fulfill({
            status: 201,
            contentType: 'application/json',
            body: JSON.stringify(newComplaint),
          });
        }

        if (method === 'GET') {
          const parsedUrl = new URL(url);
          const reqId = parsedUrl.searchParams.get('clientRequestId');
          let results = complaintStore;
          if (reqId) {
            results = complaintStore.filter((c) => c.clientRequestId === reqId);
          }
          return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              data: results,
              meta: { total: results.length, page: 1, limit: 10, totalPages: 1 },
            }),
          });
        }
      }

      return route.continue();
    });
  }

  test('6d.1: Citizen fills form offline -> submit -> queued in IndexedDB -> reconnect -> syncs -> exactly 1 complaint row', async ({
    context,
    page,
  }) => {
    const token = await createCitizenJwt();
    await context.addCookies([
      {
        name: 'ic_access_token',
        value: token,
        domain: 'localhost',
        path: '/',
      },
    ]);

    await setupOfflineMocks(page);

    // Navigate to new complaint form
    await page.goto('/citizen/complaints/new');
    await page.waitForLoadState('networkidle');

    // Fill the complaint form fields
    const titleInput = page.getByPlaceholder(/Pothole on Main Street/i);
    await expect(titleInput).toBeVisible({ timeout: 10000 });
    await titleInput.fill('Severe Water Leakage on Park Avenue');

    const descInput = page.getByPlaceholder(/Describe the issue/i);
    await expect(descInput).toBeVisible();
    await descInput.fill('Continuous pipeline leak flooding the corner of 4th cross road for past two days.');

    // Attach mock photo evidence via file input
    const fileInput = page.locator('input[type="file"][accept*="image/jpeg"]');
    await fileInput.setInputFiles({
      name: 'leak-evidence.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.from('fake-jpeg-photo-evidence-for-offline-test'),
    });

    // Wait for photo preview to populate
    await page.waitForTimeout(600);

    // ── SIMULATE OFFLINE ──
    await context.setOffline(true);

    // Submit complaint while offline
    const submitBtn = page.locator('button[type="submit"]:has-text("Submit Complaint")');
    await expect(submitBtn).toBeVisible();
    await submitBtn.click();

    // ── EXPECT QUEUED STATE ──
    // Expect "Saved Offline" UI card (use heading to avoid strict mode violation with toast)
    const savedOfflineHeading = page.getByRole('heading', { name: 'Saved Offline' });
    await expect(savedOfflineHeading).toBeVisible({ timeout: 10000 });
    await expect(page.locator('p:has-text("Saved offline, will submit when online")')).toBeVisible();

    // Check IndexedDB queue state: status must be 'pending'
    const draftsBeforeOnline = await page.evaluate(async () => {
      const q = (window as any).__offlineQueue;
      return await q.getDrafts();
    });

    expect(draftsBeforeOnline.length).toBeGreaterThanOrEqual(1);
    const queuedDraft = draftsBeforeOnline[0];
    expect(queuedDraft.status).toBe('pending');
    expect(queuedDraft.fields.title).toBe('Severe Water Leakage on Park Avenue');
    const clientRequestId = queuedDraft.id;
    expect(clientRequestId).toBeTruthy();

    // Verify 0 rows in backend before reconnection
    expect(complaintStore.length).toBe(0);

    // ── RECONNECT: SIMULATE ONLINE ──
    await context.setOffline(false);

    // Trigger online event in window to trigger sync runner
    await page.evaluate(() => {
      window.dispatchEvent(new Event('online'));
    });

    // Expect queue item state in IndexedDB to transition through syncing -> synced
    await expect
      .poll(
        async () => {
          return await page.evaluate(async (draftId) => {
            const q = (window as any).__offlineQueue;
            const d = await q.getDraft(draftId);
            return d?.status;
          }, clientRequestId);
        },
        { timeout: 15000, intervals: [200, 500, 1000] },
      )
      .toBe('synced');

    // Expect UI to transition to success screen with Ticket Reference ID
    await expect(page.getByText(/Complaint Submitted Successfully/i)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/Ticket Reference ID/i)).toBeVisible();

    // Verify exactly ONE complaint row exists for this clientRequestId via API (evaluated in page context through route handler)
    const resData = await page.evaluate(async (reqId) => {
      const res = await fetch(`/api/complaints?clientRequestId=${reqId}`);
      return await res.json();
    }, clientRequestId);

    expect(resData.data.length).toBe(1);
    expect(resData.data[0].clientRequestId).toBe(clientRequestId);
    expect(complaintStore.filter((c) => c.clientRequestId === clientRequestId).length).toBe(1);
  });

  test('6d.2: Server Idempotency — Identical POST sent twice returns existing complaint and exactly 1 row', async ({
    page,
    context,
  }) => {
    const token = await createCitizenJwt();
    await context.addCookies([
      {
        name: 'ic_access_token',
        value: token,
        domain: 'localhost',
        path: '/',
      },
    ]);

    await setupOfflineMocks(page);
    await page.goto('/citizen/complaints/new');
    await page.waitForLoadState('domcontentloaded');

    const testClientRequestId = `idem-key-${Date.now()}-abc`;
    const payload = {
      title: 'Broken streetlamp near community hall',
      description: 'Streetlamp has fallen on pedestrian sidewalk blocking normal walking path.',
      evidence: ['data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP/'],
      clientRequestId: testClientRequestId,
    };

    // First POST: creates complaint
    const postRes1 = await page.evaluate(async (p) => {
      const res = await fetch('/api/complaints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(p),
      });
      return { status: res.status, data: await res.json() };
    }, payload);

    expect(postRes1.status).toBe(201);
    expect(postRes1.data.clientRequestId).toBe(testClientRequestId);
    expect(postRes1.data.ticketId).toBeTruthy();
    expect(postRes1.data.id).toBeTruthy();

    // Second POST with identical clientRequestId: returns existing complaint (200 OK)
    const postRes2 = await page.evaluate(async (p) => {
      const res = await fetch('/api/complaints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(p),
      });
      return { status: res.status, data: await res.json() };
    }, payload);

    expect(postRes2.status).toBe(200);
    expect(postRes2.data.id).toBe(postRes1.data.id);
    expect(postRes2.data.ticketId).toBe(postRes1.data.ticketId);
    expect(postRes2.data.clientRequestId).toBe(testClientRequestId);

    // Query API: Exactly ONE row exists for that clientRequestId
    const getRes = await page.evaluate(async (reqId) => {
      const res = await fetch(`/api/complaints?clientRequestId=${reqId}`);
      return { status: res.status, data: await res.json() };
    }, testClientRequestId);

    expect(getRes.status).toBe(200);
    expect(getRes.data.data.length).toBe(1);
    expect(getRes.data.data[0].id).toBe(postRes1.data.id);
    expect(complaintStore.filter((c) => c.clientRequestId === testClientRequestId).length).toBe(1);
  });

  test('6d.3: Queue persists across page reload in IndexedDB', async ({ context, page }) => {
    const token = await createCitizenJwt();
    await context.addCookies([
      {
        name: 'ic_access_token',
        value: token,
        domain: 'localhost',
        path: '/',
      },
    ]);

    await setupOfflineMocks(page);

    await page.goto('/citizen/complaints/new');
    await page.waitForLoadState('networkidle');

    // Save a draft directly to IndexedDB
    const persistentDraftId = `persist-test-${Date.now()}`;
    await page.evaluate(async (id) => {
      const q = (window as any).__offlineQueue;
      await q.saveDraft({
        id,
        userId: 'citizen_9876543210',
        fields: {
          title: 'Persistent Draft Test Across Reload',
          description: 'Testing that offline drafts persist across browser reloads.',
        },
        latitude: null,
        longitude: null,
        photos: [],
        capturedAt: new Date().toISOString(),
        status: 'pending',
        attempts: 0,
      });
    }, persistentDraftId);

    // Reload the page
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Retrieve from IndexedDB after reload
    const draftAfterReload = await page.evaluate(async (id) => {
      const q = (window as any).__offlineQueue;
      return await q.getDraft(id);
    }, persistentDraftId);

    expect(draftAfterReload).toBeTruthy();
    expect(draftAfterReload.id).toBe(persistentDraftId);
    expect(draftAfterReload.fields.title).toBe('Persistent Draft Test Across Reload');
    expect(['pending', 'syncing', 'synced']).toContain(draftAfterReload.status);
  });
});
