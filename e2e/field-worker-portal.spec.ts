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

  test('2. GET /api/field-worker/complaints/[id] — ownership guard and detail fetching', async ({ request }) => {
    // 403 when wrong field worker attempts access
    const otherFwCookie = await getOtherFieldWorkerContext(request);
    const forbiddenRes = await request.get(`${BASE}/api/field-worker/complaints/cmp-field-assigned`, {
      headers: { cookie: otherFwCookie },
    });
    expect(forbiddenRes.status()).toBe(403);

    // 200 when assigned field worker requests detail
    const fwCookie = await getFieldWorkerContext(request);
    const res = await request.get(`${BASE}/api/field-worker/complaints/cmp-field-assigned`, {
      headers: { cookie: fwCookie },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.id).toBe('cmp-field-assigned');
    expect(body.assignedFieldWorkerId).toBe('fw-demo-1');
  });

  test('3. Sequence Guard: AFTER evidence photo rejected if BEFORE photo missing', async ({ request }) => {
    const fwCookie = await getFieldWorkerContext(request, 'fw-fresh-worker');
    
    // Create an unassigned complaint
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

    expect([400, 403]).toContain(res.status());
  });

  test('4. Submit for review rejects short remarks (< 5 chars)', async ({ request }) => {
    const fwCookie = await getFieldWorkerContext(request);
    const res = await request.post(`${BASE}/api/field-worker/complaints/cmp-field-assigned/submit-for-review`, {
      headers: { cookie: fwCookie, 'Content-Type': 'application/json' },
      data: { remarks: 'Done' },
    });
    expect(res.status()).toBe(400);
  });

  test('5. Happy Path: Start work, upload BEFORE/AFTER evidence, submit for officer review', async ({ request }) => {
    const fwCookie = await getFieldWorkerContext(request);

    // Step 5a: Start Work (ASSIGNED -> IN_PROGRESS)
    const startRes = await request.post(`${BASE}/api/field-worker/complaints/cmp-field-assigned/start`, {
      headers: { cookie: fwCookie },
    });
    expect(startRes.status()).toBe(200);
    const startData = await startRes.json();
    expect(startData.complaint.status).toBe('IN_PROGRESS');

    // Step 5b: Upload BEFORE evidence photo
    const beforeRes = await request.post(`${BASE}/api/field-worker/complaints/cmp-field-assigned/evidence`, {
      headers: { cookie: fwCookie, 'Content-Type': 'application/json' },
      data: { stage: 'BEFORE', imageUrl: 'https://images.unsplash.com/photo-before.jpg', notes: 'Initial site inspection photo' },
    });
    expect(beforeRes.status()).toBe(201);

    // Step 5c: Upload AFTER evidence photo (now valid since BEFORE exists)
    const afterRes = await request.post(`${BASE}/api/field-worker/complaints/cmp-field-assigned/evidence`, {
      headers: { cookie: fwCookie, 'Content-Type': 'application/json' },
      data: { stage: 'AFTER', imageUrl: 'https://images.unsplash.com/photo-after.jpg', notes: 'Repair completed photo' },
    });
    expect(afterRes.status()).toBe(201);

    // Step 5d: Submit work for officer review
    const submitRes = await request.post(`${BASE}/api/field-worker/complaints/cmp-field-assigned/submit-for-review`, {
      headers: { cookie: fwCookie, 'Content-Type': 'application/json' },
      data: { remarks: 'Traffic signal control box re-wired and door securely locked.' },
    });
    expect(submitRes.status()).toBe(200);
    const submitData = await submitRes.json();
    expect(submitData.complaint.readyForReview).toBe(true);
    expect(submitData.complaint.fieldWorkerRemarks).toContain('Traffic signal control box');
  });
});
