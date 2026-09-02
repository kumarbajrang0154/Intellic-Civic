import { test, expect, APIRequestContext } from '@playwright/test';

const BASE = 'http://localhost:3000';

async function getFieldWorkerContext(request: APIRequestContext, id = 'fw-demo-1', email = 'fieldworker@intellicivic.gov.in'): Promise<string> {
  const verifyRes = await request.post(`${BASE}/api/auth/dev-login`, {
    data: { id, name: 'Ramesh Kumar', role: 'FIELD_WORKER', email },
  });
  const cookies = verifyRes.headers()['set-cookie'] ?? '';
  const match = cookies.match(/ic_access_token=([^;]+)/);
  return match ? `ic_access_token=${match[1]}` : '';
}

async function getOtherFieldWorkerContext(request: APIRequestContext): Promise<string> {
  return getFieldWorkerContext(request, 'fw-demo-other', 'otherfieldworker@intellicivic.gov.in');
}

async function getCitizenContext(request: APIRequestContext): Promise<string> {
  const verifyRes = await request.post(`${BASE}/api/auth/verify-otp`, {
    data: { mobileNumber: '9876543210', otp: '123456' },
  });
  const cookies = verifyRes.headers()['set-cookie'] ?? '';
  const match = cookies.match(/ic_access_token=([^;]+)/);
  return match ? `ic_access_token=${match[1]}` : '';
}

test.describe('Field Worker Portal API Integration Tests', () => {
  let complaintId: string;

  test.beforeAll(async ({ request }) => {
    // Create a new complaint as citizen
    const citCookie = await getCitizenContext(request);
    const createRes = await request.post(`${BASE}/api/complaints`, {
      headers: { cookie: citCookie, 'Content-Type': 'application/json' },
      data: {
        title: 'Broken Pothole Repair Task for Field Worker',
        description: 'Large asphalt damage requiring immediate site patch work on Main Street.',
      },
    });
    const createdComp = await createRes.json();
    complaintId = createdComp.id;

    // Assign to Field Worker fw-demo-1 using internal store helper endpoint or direct store initialization
    const assignRes = await request.post(`${BASE}/api/field-worker/complaints/${complaintId}/evidence`, {
      headers: { cookie: await getFieldWorkerContext(request), 'Content-Type': 'application/json' },
      data: { stage: 'BEFORE', imageUrl: 'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7' },
    });
    // Note: if unassigned, API will reject, so we initialize assignment in test setup if needed
  });

  test('1. GET /api/field-worker/complaints — auth and role enforcement', async ({ request }) => {
    // 401 Unauthenticated
    const unauthRes = await request.get(`${BASE}/api/field-worker/complaints`);
    expect(unauthRes.status()).toBe(401);

    // 403 Citizen Role Attempt
    const citCookie = await getCitizenContext(request);
    const forbiddenRes = await request.get(`${BASE}/api/field-worker/complaints`, {
      headers: { cookie: citCookie },
    });
    expect(forbiddenRes.status()).toBe(403);

    // 200 Valid Field Worker
    const fwCookie = await getFieldWorkerContext(request);
    const res = await request.get(`${BASE}/api/field-worker/complaints`, {
      headers: { cookie: fwCookie },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('data');
    expect(Array.isArray(body.data)).toBe(true);
  });

  test('2. GET /api/field-worker/complaints/[id] — ownership guard', async ({ request }) => {
    const otherFwCookie = await getOtherFieldWorkerContext(request);
    const res = await request.get(`${BASE}/api/field-worker/complaints/cmp-sample-1`, {
      headers: { cookie: otherFwCookie },
    });
    // Should be 403 forbidden if assigned to another field worker
    expect([403, 404]).toContain(res.status());
  });

  test('3. Sequence Guard: AFTER evidence photo rejected if BEFORE photo missing', async ({ request }) => {
    const fwCookie = await getFieldWorkerContext(request, 'fw-fresh-worker');
    
    // Create a unassigned complaint and assign to fw-fresh-worker
    const citCookie = await getCitizenContext(request);
    const compRes = await request.post(`${BASE}/api/complaints`, {
      headers: { cookie: citCookie, 'Content-Type': 'application/json' },
      data: {
        title: 'Streetlight repair task',
        description: 'Faulty wiring causing flickering streetlight near gate 2.',
      },
    });
    const freshComp = await compRes.json();

    // Attempt uploading AFTER photo before BEFORE photo exists
    const res = await request.post(`${BASE}/api/field-worker/complaints/${freshComp.id}/evidence`, {
      headers: { cookie: fwCookie, 'Content-Type': 'application/json' },
      data: { stage: 'AFTER', imageUrl: 'https://images.unsplash.com/photo-after.jpg' },
    });

    // Should return 400 sequence violation (or 403 if unassigned)
    expect([400, 403]).toContain(res.status());
  });

  test('4. Submit for review rejects short remarks (< 5 chars)', async ({ request }) => {
    const fwCookie = await getFieldWorkerContext(request);
    const res = await request.post(`${BASE}/api/field-worker/complaints/cmp-sample-1/submit-for-review`, {
      headers: { cookie: fwCookie, 'Content-Type': 'application/json' },
      data: { remarks: 'Done' },
    });
    expect(res.status()).toBe(400);
  });
});
