import { test, expect } from '@playwright/test';
import {
  buildConsoleOtpResponsePayload,
  isProductionOtpEnv,
  OtpRequestStore,
  shouldExposeOtpInResponse,
  verifySavedOtp,
} from '@/lib/otp-store';

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

test.describe('send-otp OTP response exposure guard', () => {
  test('never includes otp key when NODE_ENV is production', () => {
    const env = { NODE_ENV: 'production', VERCEL_ENV: undefined };
    expect(isProductionOtpEnv(env)).toBe(true);
    expect(shouldExposeOtpInResponse(env)).toBe(false);

    const payload = buildConsoleOtpResponsePayload('9999999999', '482910', env);
    expect('otp' in payload).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(payload, 'otp')).toBe(false);
    expect(payload).toEqual({
      success: true,
      message: 'OTP sent successfully',
      mobileNumber: '9999999999',
      mode: 'console',
    });
  });

  test('never includes otp key when VERCEL_ENV is production even if NODE_ENV is development', () => {
    const env = { NODE_ENV: 'development', VERCEL_ENV: 'production' };
    expect(isProductionOtpEnv(env)).toBe(true);
    expect(shouldExposeOtpInResponse(env)).toBe(false);

    const payload = buildConsoleOtpResponsePayload('9999999999', '482910', env);
    expect('otp' in payload).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(payload, 'otp')).toBe(false);
  });

  test('omits otp key in non-development environments such as test or unset', () => {
    for (const env of [
      { NODE_ENV: 'test', VERCEL_ENV: undefined },
      { NODE_ENV: undefined, VERCEL_ENV: 'preview' },
      { NODE_ENV: 'staging', VERCEL_ENV: undefined },
    ]) {
      expect(shouldExposeOtpInResponse(env)).toBe(false);
      const payload = buildConsoleOtpResponsePayload('9999999999', '482910', env);
      expect('otp' in payload).toBe(false);
    }
  });

  test('includes otp key in development when VERCEL_ENV is not production', () => {
    for (const env of [
      { NODE_ENV: 'development', VERCEL_ENV: undefined },
      { NODE_ENV: 'development', VERCEL_ENV: 'development' },
      { NODE_ENV: 'development', VERCEL_ENV: 'preview' },
    ]) {
      expect(isProductionOtpEnv(env)).toBe(false);
      expect(shouldExposeOtpInResponse(env)).toBe(true);

      const payload = buildConsoleOtpResponsePayload('9999999999', '482910', env);
      expect('otp' in payload).toBe(true);
      expect(payload).toEqual({
        success: true,
        message: 'OTP sent successfully',
        otp: '482910',
        mobileNumber: '9999999999',
        mode: 'console',
      });
    }
  });

  test('reads live process.env by default without leaking otp in production', async () => {
    await withOtpEnv({ NODE_ENV: 'production' }, () => {
      const prodPayload = buildConsoleOtpResponsePayload('9999999999', '482910');
      expect('otp' in prodPayload).toBe(false);
    });

    await withOtpEnv({ NODE_ENV: 'development', VERCEL_ENV: 'production' }, () => {
      const vercelProdPayload = buildConsoleOtpResponsePayload('9999999999', '482910');
      expect('otp' in vercelProdPayload).toBe(false);
    });

    await withOtpEnv({ NODE_ENV: 'development' }, () => {
      const devPayload = buildConsoleOtpResponsePayload('9999999999', '482910');
      expect('otp' in devPayload).toBe(true);
      expect(devPayload.otp).toBe('482910');
    });
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

