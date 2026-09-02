/**
 * Integration tests for /api/admin/staff/* endpoints
 *
 * Usage: npx playwright test tests/admin-staff.spec.ts
 * Requires the dev server running: npm run dev
 *
 * Test Strategy:
 * - Uses a dev-login cookie via /api/auth/dev-login to simulate ADMIN session
 * - Tests happy paths, RBAC rejection, validation, self-deactivation guard, audit log creation
 */

import { test, expect, APIRequestContext } from '@playwright/test';

const BASE = 'http://localhost:3000';

// ── Helper: get an authenticated ADMIN API context ────────────────────────────

async function getAdminContext(request: APIRequestContext): Promise<string> {
  const res = await request.post(`${BASE}/api/auth/dev-login`, {
    data: { email: 'kumarbajrang325@gmail.com', role: 'ADMIN' },
  });
  const cookies = res.headers()['set-cookie'] ?? '';
  const match = cookies.match(/ic_access_token=([^;]+)/);
  return match ? `ic_access_token=${match[1]}` : '';
}

async function getNonAdminContext(request: APIRequestContext): Promise<string> {
  const res = await request.post(`${BASE}/api/auth/dev-login`, {
    data: { email: 'officer.roads@smartcity.gov.in', role: 'DEPARTMENT_OFFICER' },
  });
  const cookies = res.headers()['set-cookie'] ?? '';
  const match = cookies.match(/ic_access_token=([^;]+)/);
  return match ? `ic_access_token=${match[1]}` : '';
}

// ── 1. GET /api/admin/staff ───────────────────────────────────────────────────

test.describe('GET /api/admin/staff', () => {
  test('returns staff list for ADMIN', async ({ request }) => {
    const cookie = await getAdminContext(request);
    const res = await request.get(`${BASE}/api/admin/staff`, {
      headers: { cookie },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('items');
    expect(body).toHaveProperty('total');
    expect(body).toHaveProperty('page');
    expect(body).toHaveProperty('totalPages');
    expect(Array.isArray(body.items)).toBe(true);
  });

  test('403 for non-admin', async ({ request }) => {
    const cookie = await getNonAdminContext(request);
    const res = await request.get(`${BASE}/api/admin/staff`, {
      headers: { cookie },
    });
    expect(res.status()).toBe(403);
  });

  test('401 for unauthenticated', async ({ request }) => {
    const res = await request.get(`${BASE}/api/admin/staff`);
    expect(res.status()).toBe(401);
  });

  test('filters by role', async ({ request }) => {
    const cookie = await getAdminContext(request);
    const res = await request.get(`${BASE}/api/admin/staff?role=DEPARTMENT_HEAD`, {
      headers: { cookie },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    body.items.forEach((s: any) => expect(s.role).toBe('DEPARTMENT_HEAD'));
  });

  test('filters by status=active', async ({ request }) => {
    const cookie = await getAdminContext(request);
    const res = await request.get(`${BASE}/api/admin/staff?status=active`, {
      headers: { cookie },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    body.items.forEach((s: any) => expect(s.isActive).toBe(true));
  });

  test('search by name returns matching results', async ({ request }) => {
    const cookie = await getAdminContext(request);
    const res = await request.get(`${BASE}/api/admin/staff?search=Rajesh`, {
      headers: { cookie },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    if (body.items.length > 0) {
      expect(body.items[0].name.toLowerCase()).toContain('rajesh');
    }
  });

  test('pagination returns correct page size', async ({ request }) => {
    const cookie = await getAdminContext(request);
    const res = await request.get(`${BASE}/api/admin/staff?page=1&limit=2`, {
      headers: { cookie },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.items.length).toBeLessThanOrEqual(2);
  });
});

// ── 2. POST /api/admin/staff ──────────────────────────────────────────────────

test.describe('POST /api/admin/staff', () => {
  const testEmail = `test_officer_${Date.now()}@smartcity.gov.in`;

  test('creates staff with valid data', async ({ request }) => {
    const cookie = await getAdminContext(request);
    const res = await request.post(`${BASE}/api/admin/staff`, {
      headers: { cookie, 'Content-Type': 'application/json' },
      data: {
        name: 'Test Officer Playwright',
        email: testEmail,
        role: 'DEPARTMENT_OFFICER',
        departmentId: 'dept_roads_infra',
      },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.staff).toBeDefined();
    expect(body.staff.email).toBe(testEmail);
    expect(body.staff.role).toBe('DEPARTMENT_OFFICER');
    expect(body.staff.isActive).toBe(true);
  });

  test('403 for non-admin', async ({ request }) => {
    const cookie = await getNonAdminContext(request);
    const res = await request.post(`${BASE}/api/admin/staff`, {
      headers: { cookie, 'Content-Type': 'application/json' },
      data: { name: 'Test', email: 'test@test.com', role: 'DEPARTMENT_OFFICER' },
    });
    expect(res.status()).toBe(403);
  });

  test('400 for missing required fields', async ({ request }) => {
    const cookie = await getAdminContext(request);
    const res = await request.post(`${BASE}/api/admin/staff`, {
      headers: { cookie, 'Content-Type': 'application/json' },
      data: { name: 'Test Officer' }, // missing email and role
    });
    expect(res.status()).toBe(400);
  });

  test('400 for invalid email', async ({ request }) => {
    const cookie = await getAdminContext(request);
    const res = await request.post(`${BASE}/api/admin/staff`, {
      headers: { cookie, 'Content-Type': 'application/json' },
      data: { name: 'Test', email: 'not-an-email', role: 'DEPARTMENT_OFFICER', departmentId: 'dept_roads_infra' },
    });
    expect(res.status()).toBe(400);
  });

  test('400 when role requires department but none provided', async ({ request }) => {
    const cookie = await getAdminContext(request);
    const res = await request.post(`${BASE}/api/admin/staff`, {
      headers: { cookie, 'Content-Type': 'application/json' },
      data: { name: 'Test Officer', email: `test_nd_${Date.now()}@test.com`, role: 'DEPARTMENT_OFFICER' },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.message).toContain('department');
  });

  test('409 for duplicate email', async ({ request }) => {
    const cookie = await getAdminContext(request);
    // Use existing officer email
    const res = await request.post(`${BASE}/api/admin/staff`, {
      headers: { cookie, 'Content-Type': 'application/json' },
      data: {
        name: 'Duplicate Test',
        email: 'officer.roads@smartcity.gov.in', // already exists
        role: 'DEPARTMENT_OFFICER',
        departmentId: 'dept_roads_infra',
      },
    });
    expect(res.status()).toBe(409);
  });
});

// ── 3. PATCH /api/admin/staff/[id]/deactivate ────────────────────────────────

test.describe('PATCH /api/admin/staff/[id]/deactivate', () => {
  test('deactivates a staff member', async ({ request }) => {
    const cookie = await getAdminContext(request);

    // First create a disposable staff member
    const email = `deact_test_${Date.now()}@smartcity.gov.in`;
    const createRes = await request.post(`${BASE}/api/admin/staff`, {
      headers: { cookie, 'Content-Type': 'application/json' },
      data: { name: 'Deactivation Test', email, role: 'DEPARTMENT_OFFICER', departmentId: 'dept_roads_infra' },
    });
    expect(createRes.status()).toBe(201);
    const { staff } = await createRes.json();

    // Deactivate
    const res = await request.patch(`${BASE}/api/admin/staff/${staff.id}/deactivate`, {
      headers: { cookie },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.staff.isActive).toBe(false);
  });

  test('400 when trying to deactivate own account (self-deactivation guard)', async ({ request }) => {
    // We need the admin's own ID first
    const cookie = await getAdminContext(request);
    const listRes = await request.get(`${BASE}/api/admin/staff?role=ADMIN`, {
      headers: { cookie },
    });
    const listBody = await listRes.json();
    const adminId = listBody.items?.[0]?.id;

    if (!adminId) {
      test.skip();
      return;
    }

    const res = await request.patch(`${BASE}/api/admin/staff/${adminId}/deactivate`, {
      headers: { cookie },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.message).toContain('yourself');
  });

  test('404 for non-existent staff id', async ({ request }) => {
    const cookie = await getAdminContext(request);
    const res = await request.patch(`${BASE}/api/admin/staff/nonexistent_id_xyz/deactivate`, {
      headers: { cookie },
    });
    expect(res.status()).toBe(404);
  });
});

// ── 4. PATCH /api/admin/staff/[id]/reactivate ────────────────────────────────

test.describe('PATCH /api/admin/staff/[id]/reactivate', () => {
  test('reactivates a deactivated staff member', async ({ request }) => {
    const cookie = await getAdminContext(request);

    // Create + deactivate + reactivate cycle
    const email = `react_test_${Date.now()}@smartcity.gov.in`;
    const createRes = await request.post(`${BASE}/api/admin/staff`, {
      headers: { cookie, 'Content-Type': 'application/json' },
      data: { name: 'Reactivate Test', email, role: 'DEPARTMENT_OFFICER', departmentId: 'dept_roads_infra' },
    });
    const { staff } = await createRes.json();

    await request.patch(`${BASE}/api/admin/staff/${staff.id}/deactivate`, { headers: { cookie } });

    const res = await request.patch(`${BASE}/api/admin/staff/${staff.id}/reactivate`, {
      headers: { cookie },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.staff.isActive).toBe(true);
  });

  test('400 when trying to reactivate already-active staff', async ({ request }) => {
    const cookie = await getAdminContext(request);
    // Use an always-active existing officer
    const listRes = await request.get(`${BASE}/api/admin/staff?status=active&limit=5`, { headers: { cookie } });
    const listBody = await listRes.json();
    const activeId = listBody.items?.[0]?.id;
    if (!activeId) { test.skip(); return; }

    const res = await request.patch(`${BASE}/api/admin/staff/${activeId}/reactivate`, { headers: { cookie } });
    expect(res.status()).toBe(400);
  });
});

// ── 5. PATCH /api/admin/staff/[id]/reassign ──────────────────────────────────

test.describe('PATCH /api/admin/staff/[id]/reassign', () => {
  test('reassigns role and department', async ({ request }) => {
    const cookie = await getAdminContext(request);

    const email = `reassign_test_${Date.now()}@smartcity.gov.in`;
    const createRes = await request.post(`${BASE}/api/admin/staff`, {
      headers: { cookie, 'Content-Type': 'application/json' },
      data: { name: 'Reassign Test', email, role: 'DEPARTMENT_OFFICER', departmentId: 'dept_roads_infra' },
    });
    const { staff } = await createRes.json();

    const res = await request.patch(`${BASE}/api/admin/staff/${staff.id}/reassign`, {
      headers: { cookie, 'Content-Type': 'application/json' },
      data: { newRole: 'DEPARTMENT_HEAD', newDepartmentId: 'dept_water_sanitation' },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.staff.role).toBe('DEPARTMENT_HEAD');
    expect(body.staff.departmentId).toBe('dept_water_sanitation');
  });

  test('400 when no fields provided', async ({ request }) => {
    const cookie = await getAdminContext(request);
    const res = await request.patch(`${BASE}/api/admin/staff/some_id/reassign`, {
      headers: { cookie, 'Content-Type': 'application/json' },
      data: {},
    });
    expect(res.status()).toBe(400);
  });
});

// ── 6. GET /api/admin/staff/[id]/activity ────────────────────────────────────

test.describe('GET /api/admin/staff/[id]/activity', () => {
  test('returns activity list for valid staff', async ({ request }) => {
    const cookie = await getAdminContext(request);

    // Create a staff member first to ensure they exist in the store
    const email = `activity_test_${Date.now()}@smartcity.gov.in`;
    const createRes = await request.post(`${BASE}/api/admin/staff`, {
      headers: { cookie, 'Content-Type': 'application/json' },
      data: { name: 'Activity Test', email, role: 'DEPARTMENT_OFFICER', departmentId: 'dept_roads_infra' },
    });
    const { staff } = await createRes.json();

    const res = await request.get(`${BASE}/api/admin/staff/${staff.id}/activity`, {
      headers: { cookie },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('activity');
    expect(Array.isArray(body.activity)).toBe(true);
    // Should contain the STAFF_CREATED event
    const created = body.activity.find((e: any) => e.action === 'STAFF_CREATED');
    expect(created).toBeDefined();
  });

  test('403 for non-admin', async ({ request }) => {
    const cookie = await getNonAdminContext(request);
    const res = await request.get(`${BASE}/api/admin/staff/some_id/activity`, { headers: { cookie } });
    expect(res.status()).toBe(403);
  });
});

// ── 7. GET /api/admin/staff/workload-summary ─────────────────────────────────

test.describe('GET /api/admin/staff/workload-summary', () => {
  test('returns workload summary for ADMIN', async ({ request }) => {
    const cookie = await getAdminContext(request);
    const res = await request.get(`${BASE}/api/admin/staff/workload-summary`, {
      headers: { cookie },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('workload');
    expect(Array.isArray(body.workload)).toBe(true);
    if (body.workload.length > 0) {
      const dept = body.workload[0];
      expect(dept).toHaveProperty('departmentId');
      expect(dept).toHaveProperty('departmentName');
      expect(dept).toHaveProperty('heads');
      expect(dept).toHaveProperty('officers');
      expect(dept).toHaveProperty('fieldWorkers');
      expect(dept).toHaveProperty('totalStaff');
    }
  });

  test('403 for non-admin', async ({ request }) => {
    const cookie = await getNonAdminContext(request);
    const res = await request.get(`${BASE}/api/admin/staff/workload-summary`, { headers: { cookie } });
    expect(res.status()).toBe(403);
  });

  test('401 for unauthenticated', async ({ request }) => {
    const res = await request.get(`${BASE}/api/admin/staff/workload-summary`);
    expect(res.status()).toBe(401);
  });
});
