import { test, expect } from '@playwright/test';
import { NextRequest } from 'next/server';
import { handleDevLoginRequest } from '@/app/api/auth/dev-login/route';

test.describe('Task C1 & C2: Dev-Login Allowlist, Production Guard & Security Tests', () => {
  const dummyUser = {
    id: 'test_allowed_super_admin',
    name: 'Test Super Admin',
    email: 'superadmin.test@smartcity.gov.in',
    role: 'SUPER_ADMIN',
    isAuthorized: true,
    departmentId: null,
    municipalityId: null,
  };

  test('C2.1: production returns 404', async () => {
    const req = new NextRequest('http://localhost:3000/api/auth/dev-login', {
      method: 'POST',
      body: JSON.stringify({ id: 'test_allowed_super_admin' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await handleDevLoginRequest(req, {
      env: {
        NODE_ENV: 'production',
        DEV_LOGIN_ALLOWED_IDS: 'test_allowed_super_admin',
      },
      getUser: async () => dummyUser,
    });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.message).toBe('Not Found');
  });

  test('C2.2: non-allowlisted id returns 400', async () => {
    const req = new NextRequest('http://localhost:3000/api/auth/dev-login', {
      method: 'POST',
      body: JSON.stringify({ id: 'unauthorized_attacker_id' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await handleDevLoginRequest(req, {
      env: {
        NODE_ENV: 'development',
        DEV_LOGIN_ALLOWED_IDS: 'test_allowed_super_admin,allowed_officer_id',
      },
      getUser: async (id) => (id === 'unauthorized_attacker_id' ? { id, role: 'CITIZEN', isAuthorized: true } : undefined),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.message).toBe('Invalid or unauthorized dev user ID.');
  });

  test('C2.3: allowlisted id in dev returns 200', async () => {
    const req = new NextRequest('http://localhost:3000/api/auth/dev-login', {
      method: 'POST',
      body: JSON.stringify({ id: 'test_allowed_super_admin' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await handleDevLoginRequest(req, {
      env: {
        NODE_ENV: 'development',
        DEV_LOGIN_ALLOWED_IDS: 'test_allowed_super_admin,allowed_officer_id',
        JWT_SECRET: 'test-jwt-secret-key-32-chars-long!',
      },
      getUser: async (id) => (id === 'test_allowed_super_admin' ? dummyUser : undefined),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.user.sub).toBe('test_allowed_super_admin');
    expect(body.user.role).toBe('SUPER_ADMIN');
    expect(body.redirectUrl).toBe('/admin');

    // Verify JWT cookies were set
    const accessTokenCookie = res.cookies.get('ic_access_token');
    const refreshTokenCookie = res.cookies.get('ic_refresh_token');
    expect(accessTokenCookie).toBeTruthy();
    expect(accessTokenCookie?.value).toBeTruthy();
    expect(refreshTokenCookie).toBeTruthy();
  });

  test('C2.4: missing body with neither id nor email returns 400', async () => {
    const req = new NextRequest('http://localhost:3000/api/auth/dev-login', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await handleDevLoginRequest(req, {
      env: {
        NODE_ENV: 'development',
        DEV_LOGIN_ALLOWED_IDS: 'test_allowed_super_admin',
      },
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.message).toContain('Both id and email are missing');
  });

  test('C2.5: allowlisted email in dev returns 200 and enforces actual DB role', async () => {
    const officerUser = {
      id: 'officer_roads_id',
      name: 'Officer Roads',
      email: 'officer.roads@smartcity.gov.in',
      role: 'DEPARTMENT_OFFICER',
      isAuthorized: true,
      departmentId: 'dept_roads',
      municipalityId: null,
    };

    const req = new NextRequest('http://localhost:3000/api/auth/dev-login', {
      method: 'POST',
      body: JSON.stringify({ email: 'officer.roads@smartcity.gov.in', role: 'SUPER_ADMIN' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await handleDevLoginRequest(req, {
      env: {
        NODE_ENV: 'development',
        DEV_LOGIN_ALLOWED_EMAILS: 'officer.roads@smartcity.gov.in,head.roads@smartcity.gov.in',
        JWT_SECRET: 'test-jwt-secret-key-32-chars-long!',
      },
      getUserByEmail: async (email) => (email === 'officer.roads@smartcity.gov.in' ? officerUser : undefined),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.user.role).toBe('DEPARTMENT_OFFICER');
    expect(body.redirectUrl).toBe('/officer');
  });
});
