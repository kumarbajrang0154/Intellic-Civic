import { test, expect } from '@playwright/test';

test.describe('C2: Sentry Diagnostic Route Guard (/api/admin/sentry-test)', () => {
  test('Non-production environments allow diagnostic test route execution (HTTP 200)', async ({ request }) => {
    // In development and test environments (where NODE_ENV and VERCEL_ENV are not 'production'),
    // the route executes safely and dispatches diagnostic events without crashing.
    const res = await request.get('/api/admin/sentry-test');
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body).toHaveProperty('sentryConfigured');
    expect(body).toHaveProperty('message');
  });

  test('POST request is supported in non-production environments', async ({ request }) => {
    const res = await request.post('/api/admin/sentry-test');
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
  });
});
