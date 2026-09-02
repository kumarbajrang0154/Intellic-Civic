import { test, expect } from '@playwright/test';

test.describe('Console Mode OTP Auth Flow Integration Tests', () => {
  const baseURL = 'http://localhost:3000';
  const testMobile = '9876543210';

  test('1. POST /api/auth/send-otp creates an OTP request in Postgres & returns code', async ({ request }) => {
    const res = await request.post(`${baseURL}/api/auth/send-otp`, {
      data: { mobileNumber: testMobile },
    });

    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.mode).toBe('console');
    expect(body.mobileNumber).toBe(testMobile);
    expect(body.otp).toHaveLength(6);
  });

  test('2. POST /api/auth/verify-otp fails with 401 for incorrect OTP code', async ({ request }) => {
    const res = await request.post(`${baseURL}/api/auth/verify-otp`, {
      data: {
        mobileNumber: testMobile,
        otp: '000000', // Invalid OTP
      },
    });

    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body.message).toContain('Invalid or expired OTP code');
  });

  test('3. POST /api/auth/verify-otp succeeds with valid code & sets session cookies', async ({ request }) => {
    // 1. Send OTP
    const sendRes = await request.post(`${baseURL}/api/auth/send-otp`, {
      data: { mobileNumber: testMobile },
    });
    const sendBody = await sendRes.json();
    const validOtp = sendBody.otp;

    // 2. Verify with valid OTP
    const verifyRes = await request.post(`${baseURL}/api/auth/verify-otp`, {
      data: {
        mobileNumber: testMobile,
        otp: validOtp,
      },
    });

    expect(verifyRes.status()).toBe(200);
    const verifyBody = await verifyRes.json();
    expect(verifyBody.success).toBe(true);
    expect(verifyBody.mode).toBe('console');
    expect(verifyBody.user).toBeDefined();
    expect(verifyBody.user.mobileNumber).toBe(testMobile);

    // 3. Confirm cookies were set
    const cookiesHeader = verifyRes.headers()['set-cookie'] || '';
    expect(cookiesHeader).toContain('ic_access_token');
    expect(cookiesHeader).toContain('ic_refresh_token');
  });
});
