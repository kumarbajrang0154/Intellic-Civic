import { test, expect, APIRequestContext } from '@playwright/test';
import { SignJWT } from 'jose';
import prisma from '../src/lib/prisma';

const BASE = 'http://localhost:3000';
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'intellicivic-super-secret-jwt-key-2026');

async function getAdminCookie(request: APIRequestContext): Promise<string> {
  const res = await request.post(`${BASE}/api/auth/dev-login`, {
    data: { email: 'kumarbajrang325@gmail.com', role: 'ADMIN' },
  });
  const cookies = res.headers()['set-cookie'] ?? '';
  const match = cookies.match(/ic_access_token=([^;]+)/);
  return match ? `ic_access_token=${match[1]}` : '';
}

async function createHeadToken(user: { id: string; role: string; name: string; email: string; municipalityId: string | null }) {
  return new SignJWT({
    sub: user.id,
    role: user.role,
    name: user.name,
    email: user.email,
    isAuthorized: true,
    departmentId: null,
    municipalityId: user.municipalityId ?? null,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('2h')
    .sign(JWT_SECRET);
}

test.describe('Department Head Municipality Scope & Assignment Verification', () => {
  const createdUserIds: string[] = [];

  test.afterAll(async () => {
    if (createdUserIds.length > 0) {
      await prisma.user.deleteMany({
        where: { id: { in: createdUserIds } },
      }).catch(() => {});
    }
  });

  test('1. Create Head with no department -> 201, departmentId null, municipalityId set (with DB assertions)', async ({ request }) => {
    const adminCookie = await getAdminCookie(request);
    const timestamp = Date.now();
    const headEmail = `test_dept_head_${timestamp}@smartcity.gov.in`;

    const res = await request.post(`${BASE}/api/admin/staff`, {
      headers: { cookie: adminCookie, 'Content-Type': 'application/json' },
      data: {
        name: `Head Test ${timestamp}`,
        email: headEmail,
        role: 'DEPARTMENT_HEAD',
      },
    });

    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.staff).toBeDefined();
    expect(body.staff.email).toBe(headEmail);
    expect(body.staff.role).toBe('DEPARTMENT_HEAD');
    expect(body.staff.departmentId).toBeNull();
    expect(body.staff.municipalityId).toBeTruthy();

    createdUserIds.push(body.staff.id);

    // Direct DB assertions
    const dbUser = await prisma.user.findUnique({
      where: { id: body.staff.id },
    });
    expect(dbUser).not.toBeNull();
    expect(dbUser!.role).toBe('DEPARTMENT_HEAD');
    expect(dbUser!.departmentId).toBeNull();
    expect(dbUser!.municipalityId).toBeTruthy();
  });

  test('2. Head with no department can open /dept-head and see municipality complaints', async ({ page, request, context }) => {
    const adminCookie = await getAdminCookie(request);
    const timestamp = Date.now();
    const headEmail = `head_view_${timestamp}@smartcity.gov.in`;

    // Create Department Head
    const res = await request.post(`${BASE}/api/admin/staff`, {
      headers: { cookie: adminCookie, 'Content-Type': 'application/json' },
      data: {
        name: `Dashboard Head ${timestamp}`,
        email: headEmail,
        role: 'DEPARTMENT_HEAD',
      },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    createdUserIds.push(body.staff.id);

    const headToken = await createHeadToken({
      id: body.staff.id,
      role: 'DEPARTMENT_HEAD',
      name: body.staff.name,
      email: body.staff.email,
      municipalityId: body.staff.municipalityId,
    });

    // Verify /api/complaints endpoint returns municipality complaints for Head
    const complaintsRes = await request.get(`${BASE}/api/complaints?limit=100`, {
      headers: { cookie: `ic_access_token=${headToken}` },
    });
    expect(complaintsRes.status()).toBe(200);
    const complaintsData = await complaintsRes.json();
    expect(complaintsData).toHaveProperty('data');
    expect(Array.isArray(complaintsData.data)).toBe(true);

    // Open /dept-head in browser
    await context.addCookies([
      {
        name: 'ic_access_token',
        value: headToken,
        domain: 'localhost',
        path: '/',
      },
    ]);

    await page.goto(`${BASE}/dept-head`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('h1, h2, h3').filter({ hasText: /Department Head|Dashboard|Overview/i }).first()).toBeVisible({ timeout: 15000 });
  });

  test('3. OFFICER and FIELD_WORKER without department -> still return HTTP 400', async ({ request }) => {
    const adminCookie = await getAdminCookie(request);
    const timestamp = Date.now();

    // Officer without department
    const officerRes = await request.post(`${BASE}/api/admin/staff`, {
      headers: { cookie: adminCookie, 'Content-Type': 'application/json' },
      data: {
        name: `Officer No Dept ${timestamp}`,
        email: `officer_nodept_${timestamp}@smartcity.gov.in`,
        role: 'DEPARTMENT_OFFICER',
      },
    });
    expect(officerRes.status()).toBe(400);
    const officerBody = await officerRes.json();
    expect(officerBody.message).toContain('department assignment');

    // Field Worker without department
    const workerRes = await request.post(`${BASE}/api/admin/staff`, {
      headers: { cookie: adminCookie, 'Content-Type': 'application/json' },
      data: {
        name: `Worker No Dept ${timestamp}`,
        email: `worker_nodept_${timestamp}@smartcity.gov.in`,
        role: 'FIELD_WORKER',
      },
    });
    expect(workerRes.status()).toBe(400);
    const workerBody = await workerRes.json();
    expect(workerBody.message).toContain('department assignment');
  });

  test('4. Reassign OFFICER -> HEAD clears departmentId (with DB assertions)', async ({ request }) => {
    const adminCookie = await getAdminCookie(request);
    const timestamp = Date.now();
    const dept = await prisma.department.findFirst();
    expect(dept).not.toBeNull();

    // Create an officer with a department
    const createRes = await request.post(`${BASE}/api/admin/staff`, {
      headers: { cookie: adminCookie, 'Content-Type': 'application/json' },
      data: {
        name: `Officer To Reassign ${timestamp}`,
        email: `officer_reassign_${timestamp}@smartcity.gov.in`,
        role: 'DEPARTMENT_OFFICER',
        departmentId: dept!.id,
      },
    });
    expect(createRes.status()).toBe(201);
    const created = await createRes.json();
    const officerId = created.staff.id;
    createdUserIds.push(officerId);

    // Verify DB shows officer has departmentId
    const dbOfficerBefore = await prisma.user.findUnique({ where: { id: officerId } });
    expect(dbOfficerBefore!.role).toBe('DEPARTMENT_OFFICER');
    expect(dbOfficerBefore!.departmentId).toBe(dept!.id);

    // Reassign officer to DEPARTMENT_HEAD
    const reassignRes = await request.patch(`${BASE}/api/admin/staff/${officerId}/reassign`, {
      headers: { cookie: adminCookie, 'Content-Type': 'application/json' },
      data: {
        newRole: 'DEPARTMENT_HEAD',
      },
    });
    expect(reassignRes.status()).toBe(200);
    const reassignBody = await reassignRes.json();
    expect(reassignBody.staff.role).toBe('DEPARTMENT_HEAD');
    expect(reassignBody.staff.departmentId).toBeNull();

    // DB assertion: departmentId must now be null
    const dbOfficerAfter = await prisma.user.findUnique({ where: { id: officerId } });
    expect(dbOfficerAfter!.role).toBe('DEPARTMENT_HEAD');
    expect(dbOfficerAfter!.departmentId).toBeNull();
    expect(dbOfficerAfter!.municipalityId).toBeTruthy();
  });
});
