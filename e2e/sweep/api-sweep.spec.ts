import { test, expect } from '@playwright/test';
import { SignJWT } from 'jose';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'intellicivic-dev-jwt-secret-key-32bytes!');

async function createToken(payload: { sub: string; role: string; email?: string; departmentId?: string; name?: string }) {
  return new SignJWT({
    name: payload.name || 'Test User',
    email: payload.email || `${payload.role.toLowerCase()}@test.gov`,
    ...payload,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('2h')
    .sign(JWT_SECRET);
}

test.describe('API Security & Robustness Sweep across all /api/** endpoints', () => {
  let citizenToken: string;
  let fwToken: string;
  let officerToken: string;
  let deptHeadToken: string;
  let adminToken: string;

  test.beforeAll(async () => {
    citizenToken = await createToken({ sub: 'citizen_9876543210', role: 'CITIZEN' });
    fwToken = await createToken({ sub: 'fw-demo-1', role: 'FIELD_WORKER', departmentId: 'dept_roads_infra' });
    officerToken = await createToken({ sub: 'usr_officer_roads_1', role: 'DEPARTMENT_OFFICER', departmentId: 'dept_roads_infra' });
    deptHeadToken = await createToken({ sub: 'usr_dept_head_roads', role: 'DEPARTMENT_HEAD', departmentId: 'dept_roads_infra' });
    adminToken = await createToken({ sub: 'usr_super_admin', role: 'SUPER_ADMIN' });
  });

  const routes: {
    path: string;
    method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
    public?: boolean;
    allowedRoles: string[];
    sampleBody?: any;
    malformedBody?: any;
  }[] = [
    // Public routes
    { path: '/api/settings', method: 'GET', public: true, allowedRoles: ['*'] },
    { path: '/api/categories', method: 'GET', public: true, allowedRoles: ['*'] },
    { path: '/api/departments', method: 'GET', public: true, allowedRoles: ['*'] },
    { path: '/api/auth/send-otp', method: 'POST', public: true, allowedRoles: ['*'], sampleBody: { mobileNumber: '9876543210' }, malformedBody: { bad: 123 } },
    { path: '/api/auth/verify-otp', method: 'POST', public: true, allowedRoles: ['*'], sampleBody: { mobileNumber: '9876543210', otp: '123456' }, malformedBody: { bad: 123 } },

    // Citizen endpoints
    { path: '/api/complaints/check-duplicate', method: 'POST', allowedRoles: ['CITIZEN'], sampleBody: { title: 'Pothole on Road', description: 'Deep pothole creating severe traffic hazard' }, malformedBody: { bad: 123 } },
    { path: '/api/citizen/profile', method: 'GET', allowedRoles: ['CITIZEN'] },
    { path: '/api/citizen/profile', method: 'PUT', allowedRoles: ['CITIZEN'], sampleBody: { name: 'Updated Name', address: 'Updated Address', email: 'citizen@test.gov' }, malformedBody: { name: 12345 } },
    { path: '/api/complaints', method: 'GET', allowedRoles: ['*'] },
    { path: '/api/complaints', method: 'POST', allowedRoles: ['CITIZEN'], sampleBody: { title: 'New Civic Issue', description: 'Detailed description of the issue that is at least twenty characters long.', categoryId: 'cat-roads', imageUrl: 'https://placehold.co/600x400' }, malformedBody: {} },
    { path: '/api/complaints/cmp-resolved-demo/mark-satisfactory', method: 'POST', allowedRoles: ['CITIZEN'], sampleBody: {} },
    { path: '/api/complaints/cmp-resolved-demo/reopen', method: 'POST', allowedRoles: ['CITIZEN'], sampleBody: { reason: 'Pothole not fixed completely and dangerous' }, malformedBody: { reason: 'too short' } },
    { path: '/api/complaints/cmp-resolved-demo/feedback', method: 'POST', allowedRoles: ['CITIZEN'], sampleBody: { rating: 5, comments: 'Good work' }, malformedBody: { rating: 99 } },

    // Staff / Field Worker endpoints
    { path: '/api/field-worker/complaints', method: 'GET', allowedRoles: ['FIELD_WORKER'] },
    { path: '/api/field-worker/complaints/cmp-field-assigned/start', method: 'POST', allowedRoles: ['FIELD_WORKER'], sampleBody: {} },
    { path: '/api/staff/profile', method: 'GET', allowedRoles: ['FIELD_WORKER', 'DEPARTMENT_OFFICER', 'DEPARTMENT_HEAD', 'ADMIN', 'SUPER_ADMIN'] },

    // Officer / Dept Head endpoints
    { path: '/api/departments/dept_roads_infra/staff', method: 'GET', allowedRoles: ['DEPARTMENT_OFFICER', 'DEPARTMENT_HEAD', 'ADMIN', 'SUPER_ADMIN'] },
    { path: '/api/complaints/cmp-field-assigned/assign', method: 'POST', allowedRoles: ['DEPARTMENT_OFFICER', 'DEPARTMENT_HEAD', 'ADMIN', 'SUPER_ADMIN'], sampleBody: { fieldWorkerId: 'fw-demo-1' }, malformedBody: { bad: 1 } },
    { path: '/api/complaints/cmp-field-assigned/reject-suggestion', method: 'PATCH', allowedRoles: ['DEPARTMENT_HEAD', 'ADMIN', 'SUPER_ADMIN'], sampleBody: {}, malformedBody: {} },

    // Admin endpoints
    { path: '/api/admin/stats', method: 'GET', allowedRoles: ['ADMIN', 'SUPER_ADMIN'] },
    { path: '/api/admin/audit-logs', method: 'GET', allowedRoles: ['ADMIN', 'SUPER_ADMIN'] },
    { path: '/api/admin/citizens', method: 'GET', allowedRoles: ['ADMIN', 'SUPER_ADMIN'] },
    { path: '/api/admin/staff', method: 'GET', allowedRoles: ['ADMIN', 'SUPER_ADMIN'] },
    { path: '/api/admin/staff/workload-summary', method: 'GET', allowedRoles: ['ADMIN', 'SUPER_ADMIN'] },
    { path: '/api/admin/sla', method: 'GET', allowedRoles: ['ADMIN', 'SUPER_ADMIN'] },
    { path: '/api/admin/settings', method: 'GET', allowedRoles: ['ADMIN', 'SUPER_ADMIN'] },
    { path: '/api/users', method: 'GET', allowedRoles: ['ADMIN', 'SUPER_ADMIN'] },
  ];

  for (const route of routes) {
    test(`Endpoint ${route.method} ${route.path} responds correctly to auth, wrong-role, and malformed body`, async ({ request }) => {
      test.setTimeout(60000);
      // 1. Test NO AUTH
      let resNoAuth;
      if (route.method === 'GET') {
        resNoAuth = await request.get(route.path);
      } else if (route.method === 'POST') {
        resNoAuth = await request.post(route.path, { data: route.sampleBody || {} });
      } else if (route.method === 'PUT') {
        resNoAuth = await request.put(route.path, { data: route.sampleBody || {} });
      } else if (route.method === 'PATCH') {
        resNoAuth = await request.patch(route.path, { data: route.sampleBody || {} });
      }

      if (resNoAuth) {
        expect(resNoAuth.status(), `Status 500 not allowed on unauthenticated request to ${route.path}`).not.toBe(500);
        if (!route.public) {
          expect([401, 403, 404], `Protected route ${route.path} must return 401/403 when unauthenticated, got ${resNoAuth.status()}`).toContain(resNoAuth.status());
        }
      }

      // 2. Test WRONG ROLE
      if (!route.public && !route.allowedRoles.includes('*')) {
        let wrongToken: string | null = null;
        if (!route.allowedRoles.includes('CITIZEN')) wrongToken = citizenToken;
        else if (!route.allowedRoles.includes('FIELD_WORKER')) wrongToken = fwToken;
        else if (!route.allowedRoles.includes('DEPARTMENT_OFFICER')) wrongToken = officerToken;

        if (wrongToken) {
          const headers = { Cookie: `ic_access_token=${wrongToken}` };
          let resWrongRole;
          if (route.method === 'GET') {
            resWrongRole = await request.get(route.path, { headers });
          } else if (route.method === 'POST') {
            resWrongRole = await request.post(route.path, { headers, data: route.sampleBody || {} });
          } else if (route.method === 'PUT') {
            resWrongRole = await request.put(route.path, { headers, data: route.sampleBody || {} });
          } else if (route.method === 'PATCH') {
            resWrongRole = await request.patch(route.path, { headers, data: route.sampleBody || {} });
          }

          if (resWrongRole) {
            expect(resWrongRole.status(), `Status 500 not allowed on wrong-role request to ${route.path}`).not.toBe(500);
            expect([401, 403, 404], `Route ${route.path} must reject wrong role, got ${resWrongRole.status()}`).toContain(resWrongRole.status());
          }
        }
      }

      // 3. Test VALID ROLE
      let validToken: string;
      if (route.allowedRoles.includes('CITIZEN')) validToken = citizenToken;
      else if (route.allowedRoles.includes('FIELD_WORKER')) validToken = fwToken;
      else if (route.allowedRoles.includes('DEPARTMENT_OFFICER')) validToken = officerToken;
      else if (route.allowedRoles.includes('DEPARTMENT_HEAD')) validToken = deptHeadToken;
      else validToken = adminToken;

      const validHeaders = { Cookie: `ic_access_token=${validToken}` };
      let resValid;
      if (route.method === 'GET') {
        resValid = await request.get(route.path, { headers: validHeaders });
      } else if (route.method === 'POST') {
        resValid = await request.post(route.path, { headers: validHeaders, data: route.sampleBody || {} });
      } else if (route.method === 'PUT') {
        resValid = await request.put(route.path, { headers: validHeaders, data: route.sampleBody || {} });
      } else if (route.method === 'PATCH') {
        resValid = await request.patch(route.path, { headers: validHeaders, data: route.sampleBody || {} });
      }

      if (resValid) {
        expect(resValid.status(), `Valid request to ${route.path} returned 500 error: ${await resValid.text()}`).not.toBe(500);
      }

      // 4. Test MALFORMED BODY (for POST/PUT/PATCH)
      if (route.malformedBody) {
        let resMalformed;
        if (route.method === 'POST') {
          resMalformed = await request.post(route.path, { headers: validHeaders, data: route.malformedBody });
        } else if (route.method === 'PUT') {
          resMalformed = await request.put(route.path, { headers: validHeaders, data: route.malformedBody });
        } else if (route.method === 'PATCH') {
          resMalformed = await request.patch(route.path, { headers: validHeaders, data: route.malformedBody });
        }

        if (resMalformed) {
          expect(resMalformed.status(), `Malformed body on ${route.path} triggered 500 error`).not.toBe(500);
          expect([400, 422, 403, 404, 200], `Malformed body on ${route.path} should return 400/422/404, got ${resMalformed.status()}`).toContain(resMalformed.status());
        }
      }
    });
  }
});
