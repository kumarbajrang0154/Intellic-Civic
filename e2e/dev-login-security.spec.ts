import { test, expect } from '@playwright/test';

test.describe('Dev-Login Security Hardening Tests', () => {
  const baseURL = 'http://localhost:3000';

  test('1. Rejects non-allowlisted user IDs with 400 Bad Request', async ({ request }) => {
    const res = await request.post(`${baseURL}/api/auth/dev-login`, {
      data: {
        id: 'unauthorized_hacker_id_999',
        role: 'ADMIN',
      },
    });

    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.message).toContain('Invalid or unauthorized dev user ID');
  });

  test('2. Rejects invalid email not in allowlist with 400 Bad Request', async ({ request }) => {
    const res = await request.post(`${baseURL}/api/auth/dev-login`, {
      data: {
        email: 'unauthorized_user@example.com',
      },
    });

    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.message).toContain('Invalid or unauthorized dev user ID');
  });

  test('3. Allows valid allowlisted user ID (usr_super_admin) in dev mode', async ({ request }) => {
    const res = await request.post(`${baseURL}/api/auth/dev-login`, {
      data: {
        id: 'usr_super_admin',
      },
    });

    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.user.sub).toBeTruthy();
    expect(body.user.role).toBe('ADMIN');
    expect(body.redirectUrl).toBe('/admin');
  });

  test('4. Enforces actual DB role and ignores fake role requested in body', async ({ request }) => {
    // usr_officer_roads_1 is a DEPARTMENT_OFFICER in database.
    // Try to request ADMIN role in body.
    const res = await request.post(`${baseURL}/api/auth/dev-login`, {
      data: {
        id: 'usr_officer_roads_1',
        role: 'ADMIN', // Hacker trying to elevate privilege
      },
    });

    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.user.sub).toBe('usr_officer_roads_1');
    // Role MUST be DEPARTMENT_OFFICER from DB, NOT ADMIN requested in body!
    expect(body.user.role).toBe('DEPARTMENT_OFFICER');
    expect(body.redirectUrl).toBe('/officer');
  });

  test('5. Enforces actual DB role for field worker demo (fw-demo-1)', async ({ request }) => {
    const res = await request.post(`${baseURL}/api/auth/dev-login`, {
      data: {
        id: 'fw-demo-1',
        role: 'SUPER_ADMIN_FAKE',
      },
    });

    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.user.sub).toBe('fw-demo-1');
    expect(body.user.role).toBe('FIELD_WORKER');
    expect(body.redirectUrl).toBe('/field-worker');
  });
});
