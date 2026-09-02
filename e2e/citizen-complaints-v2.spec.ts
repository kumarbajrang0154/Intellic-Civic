import { test, expect, APIRequestContext } from '@playwright/test';

const BASE = 'http://localhost:3000';

// ── Helper: get an authenticated Citizen API context ──────────────────────────

async function getCitizenContext(request: APIRequestContext, mobile = '9876543210'): Promise<string> {
  const verifyRes = await request.post(`${BASE}/api/auth/verify-otp`, {
    data: { mobileNumber: mobile, otp: '123456' },
  });
  const cookies = verifyRes.headers()['set-cookie'] ?? '';
  const match = cookies.match(/ic_access_token=([^;]+)/);
  return match ? `ic_access_token=${match[1]}` : '';
}

async function getOtherCitizenContext(request: APIRequestContext): Promise<string> {
  return getCitizenContext(request, '9123456789');
}

// ── 1. POST /api/complaints/check-duplicate ──────────────────────────────────

test.describe('POST /api/complaints/check-duplicate', () => {
  test('returns duplicate check result for authenticated citizen', async ({ request }) => {
    const cookie = await getCitizenContext(request);
    const res = await request.post(`${BASE}/api/complaints/check-duplicate`, {
      headers: { cookie, 'Content-Type': 'application/json' },
      data: {
        title: 'Severe pothole on Main Road',
        description: 'Dangerous deep pothole near metro gate 3 causing traffic congestion',
        latitude: 28.6139,
        longitude: 77.209,
      },
    });

    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('matched');
    expect(body).toHaveProperty('potentialDuplicates');
    expect(Array.isArray(body.potentialDuplicates)).toBe(true);
  });

  test('401 for unauthenticated request', async ({ request }) => {
    const res = await request.post(`${BASE}/api/complaints/check-duplicate`, {
      data: { title: 'Pothole', description: 'Test description long enough' },
    });
    expect(res.status()).toBe(401);
  });

  test('400 for invalid title or description', async ({ request }) => {
    const cookie = await getCitizenContext(request);
    const res = await request.post(`${BASE}/api/complaints/check-duplicate`, {
      headers: { cookie, 'Content-Type': 'application/json' },
      data: { title: 'a', description: 'short' },
    });
    expect(res.status()).toBe(400);
  });
});

// ── 2. POST /api/complaints/[id]/mark-satisfactory & /reopen ───────────────

test.describe('Post-resolution endpoints: mark-satisfactory & reopen', () => {
  let createdComplaintId: string;

  test.beforeAll(async ({ request }) => {
    const cookie = await getCitizenContext(request);
    const res = await request.post(`${BASE}/api/complaints`, {
      headers: { cookie, 'Content-Type': 'application/json' },
      data: {
        title: 'Water pipe leak near park gate',
        description: 'Clean water is leaking continuously on the main walking pathway.',
      },
    });
    const data = await res.json();
    createdComplaintId = data.id;
  });

  test('cannot mark satisfactory if status is SUBMITTED (not RESOLVED)', async ({ request }) => {
    const cookie = await getCitizenContext(request);
    const res = await request.post(`${BASE}/api/complaints/${createdComplaintId}/mark-satisfactory`, {
      headers: { cookie },
    });
    expect(res.status()).toBe(400);
  });

  test('cannot reopen if status is SUBMITTED (not RESOLVED)', async ({ request }) => {
    const cookie = await getCitizenContext(request);
    const res = await request.post(`${BASE}/api/complaints/${createdComplaintId}/reopen`, {
      headers: { cookie, 'Content-Type': 'application/json' },
      data: { reason: 'Work was not completed properly by the field team.' },
    });
    expect(res.status()).toBe(400);
  });

  test('reopen rejects short reason (< 10 chars)', async ({ request }) => {
    const cookie = await getCitizenContext(request);
    const res = await request.post(`${BASE}/api/complaints/${createdComplaintId}/reopen`, {
      headers: { cookie, 'Content-Type': 'application/json' },
      data: { reason: 'Short' },
    });
    expect(res.status()).toBe(400);
  });

  test('ownership rejection when another citizen attempts action', async ({ request }) => {
    const otherCookie = await getOtherCitizenContext(request);
    const res = await request.post(`${BASE}/api/complaints/${createdComplaintId}/mark-satisfactory`, {
      headers: { cookie: otherCookie },
    });
    expect(res.status()).toBe(403);
  });
});

// ── 3. POST /api/complaints/[id]/feedback ────────────────────────────────────

test.describe('POST /api/complaints/[id]/feedback', () => {
  test('rejects rating outside 1-5 range', async ({ request }) => {
    const cookie = await getCitizenContext(request);
    const res = await request.post(`${BASE}/api/complaints/cmp-sample-1/feedback`, {
      headers: { cookie, 'Content-Type': 'application/json' },
      data: { rating: 10, comment: 'Invalid rating' },
    });
    expect(res.status()).toBe(400);
  });

  test('rejects feedback for non-RESOLVED/CLOSED complaint', async ({ request }) => {
    const cookie = await getCitizenContext(request);

    // Create a fresh SUBMITTED complaint
    const createRes = await request.post(`${BASE}/api/complaints`, {
      headers: { cookie, 'Content-Type': 'application/json' },
      data: {
        title: 'Broken streetlight on street 4',
        description: 'Dark area at night due to non-functioning LED streetlight.',
      },
    });
    const comp = await createRes.json();

    const res = await request.post(`${BASE}/api/complaints/${comp.id}/feedback`, {
      headers: { cookie, 'Content-Type': 'application/json' },
      data: { rating: 5, comment: 'Great job!' },
    });
    expect(res.status()).toBe(400);
  });
});

// ── 4. GET /api/complaints search & date-range filtering ─────────────────────

test.describe('GET /api/complaints search & date-range filters', () => {
  test('filters complaints by keyword search query', async ({ request }) => {
    const cookie = await getCitizenContext(request);
    const res = await request.get(`${BASE}/api/complaints?search=pothole`, {
      headers: { cookie },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
  });

  test('filters complaints by date range', async ({ request }) => {
    const cookie = await getCitizenContext(request);
    const today = new Date().toISOString().slice(0, 10);
    const res = await request.get(`${BASE}/api/complaints?fromDate=${today}&toDate=${today}`, {
      headers: { cookie },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
  });
});
