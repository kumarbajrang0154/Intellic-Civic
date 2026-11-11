import { test, expect } from '@playwright/test';
import {
  buildConsoleOtpResponsePayload,
  isProductionOtpEnv,
  shouldExposeOtpInResponse,
} from '@/lib/otp-store';

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

  test('reads live process.env by default without leaking otp in production', () => {
    const mutableEnv = process.env as Record<string, string | undefined>;
    const prevNodeEnv = mutableEnv.NODE_ENV;
    const prevVercelEnv = mutableEnv.VERCEL_ENV;

    try {
      mutableEnv.NODE_ENV = 'production';
      delete mutableEnv.VERCEL_ENV;
      const prodPayload = buildConsoleOtpResponsePayload('9999999999', '482910');
      expect('otp' in prodPayload).toBe(false);

      mutableEnv.NODE_ENV = 'development';
      mutableEnv.VERCEL_ENV = 'production';
      const vercelProdPayload = buildConsoleOtpResponsePayload('9999999999', '482910');
      expect('otp' in vercelProdPayload).toBe(false);

      mutableEnv.NODE_ENV = 'development';
      delete mutableEnv.VERCEL_ENV;
      const devPayload = buildConsoleOtpResponsePayload('9999999999', '482910');
      expect('otp' in devPayload).toBe(true);
      expect(devPayload.otp).toBe('482910');
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
  });
});

