import { test, expect } from '@playwright/test';
import {
  buildConsoleOtpResponsePayload,
  isProductionOtpEnv,
  OtpRequestStore,
  shouldExposeOtpInResponse,
  shouldLogConsoleOtp,
  verifySavedOtp,
} from '@/lib/otp-store';
import { handleSendOtpRequest } from '@/lib/send-otp-handler';
import type { RateLimitResult } from '@/lib/rate-limit';

const ALLOW_RATE_LIMIT: RateLimitResult = {
  success: true,
  limit: 3,
  remaining: 2,
  reset: Date.now() + 600_000,
  retryAfterSeconds: 600,
  source: 'memory',
};

async function withOtpEnv<T>(
  overrides: { NODE_ENV?: string; VERCEL_ENV?: string },
  fn: () => Promise<T> | T,
): Promise<T> {
  const mutableEnv = process.env as Record<string, string | undefined>;
  const prevNodeEnv = mutableEnv.NODE_ENV;
  const prevVercelEnv = mutableEnv.VERCEL_ENV;

  try {
    if (overrides.NODE_ENV === undefined) {
      delete mutableEnv.NODE_ENV;
    } else {
      mutableEnv.NODE_ENV = overrides.NODE_ENV;
    }
    if (overrides.VERCEL_ENV === undefined) {
      delete mutableEnv.VERCEL_ENV;
    } else {
      mutableEnv.VERCEL_ENV = overrides.VERCEL_ENV;
    }
    return await fn();
  } finally {
    if (prevNodeEnv === undefined) {
      delete mutableEnv.NODE_ENV;
    } else {
      mutableEnv.NODE_ENV = prevNodeEnv;
    }
    if (prevVercelEnv === undefined) {
      delete mutableEnv.VERCEL_ENV;
    } else {
      mutableEnv.VERCEL_ENV = prevVercelEnv;
    }
  }
}

test.describe('send-otp OTP response behaviour across console and sms modes', () => {
  test('includes otp key in console mode across production, preview, and development environments', () => {
    for (const env of [
      { NODE_ENV: 'production', VERCEL_ENV: undefined, expectedProd: true, expectedLog: false },
      { NODE_ENV: 'development', VERCEL_ENV: 'production', expectedProd: true, expectedLog: false },
      { NODE_ENV: 'test', VERCEL_ENV: undefined, expectedProd: false, expectedLog: false },
      { NODE_ENV: undefined, VERCEL_ENV: 'preview', expectedProd: false, expectedLog: false },
      { NODE_ENV: 'development', VERCEL_ENV: undefined, expectedProd: false, expectedLog: true },
      { NODE_ENV: 'development', VERCEL_ENV: 'preview', expectedProd: false, expectedLog: true },
    ]) {
      expect(isProductionOtpEnv(env)).toBe(env.expectedProd);
      expect(shouldExposeOtpInResponse(env)).toBe(true);
      expect(shouldLogConsoleOtp(env)).toBe(env.expectedLog);

      const payload = buildConsoleOtpResponsePayload('9999999999', '482910', env);
      expect('otp' in payload).toBe(true);
      expect(payload).toEqual({
        success: true,
        message: 'OTP sent successfully',
        mobileNumber: '9999999999',
        mode: 'console',
        otp: '482910',
      });
    }
  });

  test('reads live process.env by default and returns console otp in both production and development', async () => {
    await withOtpEnv({ NODE_ENV: 'production' }, () => {
      const prodPayload = buildConsoleOtpResponsePayload('9999999999', '482910');
      expect(prodPayload.otp).toBe('482910');
      expect(prodPayload.mode).toBe('console');
      expect(shouldLogConsoleOtp()).toBe(false);
    });

    await withOtpEnv({ NODE_ENV: 'development', VERCEL_ENV: 'production' }, () => {
      const vercelProdPayload = buildConsoleOtpResponsePayload('9999999999', '482910');
      expect(vercelProdPayload.otp).toBe('482910');
      expect(vercelProdPayload.mode).toBe('console');
      expect(shouldLogConsoleOtp()).toBe(false);
    });

    await withOtpEnv({ NODE_ENV: 'development' }, () => {
      const devPayload = buildConsoleOtpResponsePayload('9999999999', '482910');
      expect(devPayload.otp).toBe('482910');
      expect(shouldLogConsoleOtp()).toBe(true);
    });
  });

  test('console mode send-otp returns a 6-digit otp string in production and development while logging only in dev', async () => {
    for (const scenario of [
      { env: { NODE_ENV: 'production', OTP_AUTH_MODE: 'console' }, expectConsoleLog: false },
      { env: { NODE_ENV: 'development', VERCEL_ENV: 'production', OTP_AUTH_MODE: 'console' }, expectConsoleLog: false },
      { env: { NODE_ENV: 'development', OTP_AUTH_MODE: 'console' }, expectConsoleLog: true },
    ]) {
      let saveCalls = 0;
      const logs: string[] = [];
      const origLog = console.log;
      console.log = (...args: unknown[]) => {
        logs.push(args.map(String).join(' '));
      };

      try {
        const req = new Request('http://localhost/api/auth/send-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mobileNumber: '9999999999' }),
        });

        const res = await handleSendOtpRequest(req, {
          env: scenario.env,
          checkRateLimit: async () => ALLOW_RATE_LIMIT,
          generateOtp: async () => {
            saveCalls += 1;
            return '639284';
          },
        });

        expect(res.status).toBe(200);
        expect(saveCalls).toBe(1);

        const body = await res.json();
        expect(body.success).toBe(true);
        expect(body.mode).toBe('console');
        expect(body.mobileNumber).toBe('9999999999');
        expect(typeof body.otp).toBe('string');
        expect(body.otp).toMatch(/^\d{6}$/);
        expect(logs.some((line) => line.includes('[CONSOLE OTP]'))).toBe(scenario.expectConsoleLog);
      } finally {
        console.log = origLog;
      }
    }
  });

  test('in sms mode, send-otp returns no otp key in production or development', async () => {
    for (const env of [
      { NODE_ENV: 'production', OTP_AUTH_MODE: 'sms' },
      { NODE_ENV: 'development', VERCEL_ENV: 'production', OTP_AUTH_MODE: 'sms' },
      { NODE_ENV: 'development', OTP_AUTH_MODE: 'sms' },
    ]) {
      let sentOtp = '';
      const req = new Request('http://localhost/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobileNumber: '9999999999' }),
      });

      const res = await handleSendOtpRequest(req, {
        env,
        checkRateLimit: async () => ALLOW_RATE_LIMIT,
        generateOtp: async () => '753190',
        smsProvider: {
          send: async (_phone, otp) => {
            sentOtp = otp;
            return { ok: true, providerRef: 'mock_ref' };
          },
        },
      });

      expect(res.status).toBe(200);
      expect(sentOtp).toBe('753190');

      const body = await res.json();
      expect(body).toEqual({ success: true, mode: 'sms' });
      expect('otp' in body).toBe(false);
    }
  });
});

test.describe('verifySavedOtp hardcoded bypass guard', () => {
  function createMockOtpStore(record: { id: string; otpCode: string } | null = null) {
    let findFirstCalls = 0;
    const verifiedIds: string[] = [];

    const store: OtpRequestStore = {
      findFirst: async () => {
        findFirstCalls += 1;
        return record;
      },
      update: async ({ where }) => {
        verifiedIds.push(where.id);
        return { id: where.id, isVerified: true };
      },
    };

    return { store, getFindFirstCalls: () => findFirstCalls, verifiedIds };
  }

  test('returns false for 123456 in production env when no matching row exists', async () => {
    for (const env of [
      { NODE_ENV: 'production', VERCEL_ENV: undefined },
      { NODE_ENV: 'development', VERCEL_ENV: 'production' },
      { NODE_ENV: 'test', VERCEL_ENV: undefined },
    ]) {
      const { store, getFindFirstCalls } = createMockOtpStore(null);
      const accepted = await verifySavedOtp('9999999999', '123456', {
        env,
        otpRequestStore: store,
      });
      expect(accepted).toBe(false);
      expect(getFindFirstCalls()).toBe(1);
    }
  });

  test('verifies a real matching OTP row in production and marks it verified', async () => {
    const { store, verifiedIds } = createMockOtpStore({ id: 'otp_1', otpCode: '482910' });

    const wrongRejected = await verifySavedOtp('9999999999', '123456', {
      env: { NODE_ENV: 'production' },
      otpRequestStore: store,
    });
    expect(wrongRejected).toBe(false);
    expect(verifiedIds).toEqual([]);

    const validAccepted = await verifySavedOtp('9999999999', '482910', {
      env: { NODE_ENV: 'production' },
      otpRequestStore: store,
    });
    expect(validAccepted).toBe(true);
    expect(verifiedIds).toEqual(['otp_1']);
  });

  test('accepts 123456 in development for local console-mode testing', async () => {
    const { store, getFindFirstCalls } = createMockOtpStore(null);
    const accepted = await verifySavedOtp('9999999999', '123456', {
      env: { NODE_ENV: 'development', VERCEL_ENV: undefined },
      otpRequestStore: store,
    });
    expect(accepted).toBe(true);
    expect(getFindFirstCalls()).toBe(0);
  });

  test('reads live process.env by default when enforcing 123456 restriction', async () => {
    const emptyProd = createMockOtpStore(null);
    const prodAccepted = await withOtpEnv({ NODE_ENV: 'production' }, () =>
      verifySavedOtp('9999999999', '123456', { otpRequestStore: emptyProd.store }),
    );
    expect(prodAccepted).toBe(false);
    expect(emptyProd.getFindFirstCalls()).toBe(1);

    const emptyVercelProd = createMockOtpStore(null);
    const vercelProdAccepted = await withOtpEnv(
      { NODE_ENV: 'development', VERCEL_ENV: 'production' },
      () => verifySavedOtp('9999999999', '123456', { otpRequestStore: emptyVercelProd.store }),
    );
    expect(vercelProdAccepted).toBe(false);
    expect(emptyVercelProd.getFindFirstCalls()).toBe(1);

    const devMock = createMockOtpStore(null);
    const devAccepted = await withOtpEnv({ NODE_ENV: 'development' }, () =>
      verifySavedOtp('9999999999', '123456', { otpRequestStore: devMock.store }),
    );
    expect(devAccepted).toBe(true);
    expect(devMock.getFindFirstCalls()).toBe(0);
  });
});

