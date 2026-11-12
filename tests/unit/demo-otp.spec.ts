import { test, expect } from '@playwright/test';
import {
  getDemoOtpCode,
  isDemoOtpNumber,
  parseDemoOtpNumbers,
  verifySavedOtp,
  type OtpRequestStore,
} from '@/lib/otp-store';
import { handleSendOtpRequest } from '@/lib/send-otp-handler';
import type { RateLimitResult } from '@/lib/rate-limit';

const DEMO_NUMBER_A = '9000000001';
const DEMO_NUMBER_B = '9000000002';
const NON_DEMO_NUMBER = '9000000099';
const DEMO_CODE = '739204';

const ALLOW_RATE_LIMIT: RateLimitResult = {
  success: true,
  limit: 3,
  remaining: 2,
  reset: Date.now() + 600_000,
  retryAfterSeconds: 600,
  source: 'memory',
};

function createTrackedOtpStore(record: { id: string; otpCode: string } | null = null) {
  let findFirstCalls = 0;
  let updateCalls = 0;

  const store: OtpRequestStore = {
    findFirst: async () => {
      findFirstCalls += 1;
      return record;
    },
    update: async ({ where }) => {
      updateCalls += 1;
      return { id: where.id, isVerified: true };
    },
  };

  return {
    store,
    getFindFirstCalls: () => findFirstCalls,
    getUpdateCalls: () => updateCalls,
  };
}

test.describe('Demo Allowlist OTP Login (Production Console Mode)', () => {
  test('parseDemoOtpNumbers trims, strips non-digits, and drops empty or invalid entries', () => {
    expect(parseDemoOtpNumbers(undefined)).toEqual(new Set());
    expect(parseDemoOtpNumbers('')).toEqual(new Set());
    expect(parseDemoOtpNumbers('   , ,  ')).toEqual(new Set());

    const parsed = parseDemoOtpNumbers(
      ` ${DEMO_NUMBER_A} , 90000-00002 , , invalid , 12345 , 12345678901 , 91${DEMO_NUMBER_A} `,
    );
    expect(parsed).toEqual(new Set([DEMO_NUMBER_A, DEMO_NUMBER_B]));
  });

  test('getDemoOtpCode validates exactly 6 digits with no hardcoded default', () => {
    expect(getDemoOtpCode({ DEMO_OTP_CODE: undefined })).toBeNull();
    expect(getDemoOtpCode({ DEMO_OTP_CODE: '' })).toBeNull();
    expect(getDemoOtpCode({ DEMO_OTP_CODE: '12345' })).toBeNull();
    expect(getDemoOtpCode({ DEMO_OTP_CODE: '1234567' })).toBeNull();
    expect(getDemoOtpCode({ DEMO_OTP_CODE: '12ab56' })).toBeNull();
    expect(getDemoOtpCode({ DEMO_OTP_CODE: '123 456' })).toBeNull();
    expect(getDemoOtpCode({ DEMO_OTP_CODE: ` ${DEMO_CODE} ` })).toBe(DEMO_CODE);
  });

  test('in production, demo number with correct demo code returns true without touching DB', async () => {
    for (const env of [
      { NODE_ENV: 'production', DEMO_OTP_NUMBERS: `${DEMO_NUMBER_A}, ${DEMO_NUMBER_B}`, DEMO_OTP_CODE: DEMO_CODE },
      { NODE_ENV: 'development', VERCEL_ENV: 'production', DEMO_OTP_NUMBERS: DEMO_NUMBER_A, DEMO_OTP_CODE: DEMO_CODE },
    ]) {
      const tracker = createTrackedOtpStore(null);
      expect(isDemoOtpNumber(DEMO_NUMBER_A, env)).toBe(true);

      const accepted = await verifySavedOtp(DEMO_NUMBER_A, DEMO_CODE, {
        env,
        otpRequestStore: tracker.store,
      });
      expect(accepted).toBe(true);
      expect(tracker.getFindFirstCalls()).toBe(0);
      expect(tracker.getUpdateCalls()).toBe(0);
    }
  });

  test('in production, demo number with wrong code and non-demo number with demo code both return false', async () => {
    const env = {
      NODE_ENV: 'production',
      DEMO_OTP_NUMBERS: `${DEMO_NUMBER_A},${DEMO_NUMBER_B}`,
      DEMO_OTP_CODE: DEMO_CODE,
    };

    const demoWrongCode = createTrackedOtpStore(null);
    expect(
      await verifySavedOtp(DEMO_NUMBER_A, '000000', {
        env,
        otpRequestStore: demoWrongCode.store,
      }),
    ).toBe(false);
    expect(demoWrongCode.getFindFirstCalls()).toBe(1);

    const demoHardcodedBypass = createTrackedOtpStore(null);
    expect(
      await verifySavedOtp(DEMO_NUMBER_A, '123456', {
        env,
        otpRequestStore: demoHardcodedBypass.store,
      }),
    ).toBe(false);
    expect(demoHardcodedBypass.getFindFirstCalls()).toBe(1);

    const nonDemoWithDemoCode = createTrackedOtpStore(null);
    expect(isDemoOtpNumber(NON_DEMO_NUMBER, env)).toBe(false);
    expect(
      await verifySavedOtp(NON_DEMO_NUMBER, DEMO_CODE, {
        env,
        otpRequestStore: nonDemoWithDemoCode.store,
      }),
    ).toBe(false);
    expect(nonDemoWithDemoCode.getFindFirstCalls()).toBe(1);

    const nonDemoWithMatchingDbRow = createTrackedOtpStore({ id: 'otp_row_1', otpCode: '847291' });
    expect(
      await verifySavedOtp(NON_DEMO_NUMBER, '847291', {
        env,
        otpRequestStore: nonDemoWithMatchingDbRow.store,
      }),
    ).toBe(true);
    expect(nonDemoWithMatchingDbRow.getUpdateCalls()).toBe(1);
  });

  test('in production, send-otp for a demo number stores generated OTP, returns console otp, and never leaks DEMO_OTP_CODE', async () => {
    for (const env of [
      {
        NODE_ENV: 'production',
        OTP_AUTH_MODE: 'console',
        DEMO_OTP_NUMBERS: DEMO_NUMBER_A,
        DEMO_OTP_CODE: DEMO_CODE,
      },
      {
        NODE_ENV: 'development',
        VERCEL_ENV: 'production',
        OTP_AUTH_MODE: 'console',
        DEMO_OTP_NUMBERS: DEMO_NUMBER_A,
        DEMO_OTP_CODE: DEMO_CODE,
      },
    ]) {
      let generatedFor: string | null = null;
      const req = new Request('http://localhost/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobileNumber: DEMO_NUMBER_A }),
      });

      const res = await handleSendOtpRequest(req, {
        env,
        checkRateLimit: async () => ALLOW_RATE_LIMIT,
        generateOtp: async (mobile) => {
          generatedFor = mobile;
          return '591024';
        },
      });

      expect(res.status).toBe(200);
      expect(generatedFor).toBe(DEMO_NUMBER_A);

      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.mode).toBe('console');
      expect(body.otp).toBe('591024');
      expect(JSON.stringify(body)).not.toContain(DEMO_CODE);
    }
  });

  test('in development, existing 123456 behaviour and demo OTP both work unchanged', async () => {
    const devEnv = {
      NODE_ENV: 'development',
      OTP_AUTH_MODE: 'console',
      DEMO_OTP_NUMBERS: DEMO_NUMBER_A,
      DEMO_OTP_CODE: DEMO_CODE,
    };

    const nonDemoTracker = createTrackedOtpStore(null);
    expect(
      await verifySavedOtp(NON_DEMO_NUMBER, '123456', {
        env: devEnv,
        otpRequestStore: nonDemoTracker.store,
      }),
    ).toBe(true);
    expect(nonDemoTracker.getFindFirstCalls()).toBe(0);

    const demoTracker = createTrackedOtpStore(null);
    expect(
      await verifySavedOtp(DEMO_NUMBER_A, DEMO_CODE, {
        env: devEnv,
        otpRequestStore: demoTracker.store,
      }),
    ).toBe(true);
    expect(demoTracker.getFindFirstCalls()).toBe(0);

    const devReq = new Request('http://localhost/api/auth/send-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mobileNumber: DEMO_NUMBER_A }),
    });
    const devRes = await handleSendOtpRequest(devReq, {
      env: devEnv,
      checkRateLimit: async () => ALLOW_RATE_LIMIT,
      generateOtp: async () => '591024',
    });
    expect(devRes.status).toBe(200);
    const devBody = await devRes.json();
    expect(devBody.otp).toBe('591024');
  });

  test('when DEMO_OTP_CODE is missing or not 6 digits, demo login is disabled and returns false', async () => {
    for (const invalidCode of [undefined, '', '12345', '1234567', 'abcdef']) {
      const env = {
        NODE_ENV: 'production',
        DEMO_OTP_NUMBERS: DEMO_NUMBER_A,
        DEMO_OTP_CODE: invalidCode,
      };
      const tracker = createTrackedOtpStore(null);
      const accepted = await verifySavedOtp(DEMO_NUMBER_A, invalidCode ?? '000000', {
        env,
        otpRequestStore: tracker.store,
      });
      expect(accepted).toBe(false);
      expect(tracker.getFindFirstCalls()).toBe(1);
    }
  });
});

