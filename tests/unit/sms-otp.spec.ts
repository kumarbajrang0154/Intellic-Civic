import { test, expect } from '@playwright/test';
import { getSmsProvider, Msg91SmsProvider } from '@/lib/sms';
import { handleSendOtpRequest } from '@/lib/send-otp-handler';
import type { RateLimitResult } from '@/lib/rate-limit';

const SAMPLE_PHONE = '9876543210';
const SAMPLE_OTP = '482910';
const SECRET_KEY = 'super-secret-msg91-key';

const ALLOW_RATE_LIMIT: RateLimitResult = {
  success: true,
  limit: 3,
  remaining: 2,
  reset: Date.now() + 600_000,
  retryAfterSeconds: 600,
  source: 'memory',
};

function makeSendOtpRequest(mobileNumber: string): Request {
  return new Request('http://localhost/api/auth/send-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mobileNumber }),
  });
}

async function captureConsoleOutput(fn: () => Promise<void>) {
  const logs: string[] = [];
  const origLog = console.log;
  const origWarn = console.warn;
  const origError = console.error;
  const record = (...args: unknown[]) => {
    logs.push(args.map((arg) => (arg instanceof Error ? `${arg.name}:${arg.message}` : String(arg))).join(' '));
  };
  console.log = record;
  console.warn = record;
  console.error = record;
  try {
    await fn();
  } finally {
    console.log = origLog;
    console.warn = origWarn;
    console.error = origError;
  }
  return logs.join('\n');
}

test.describe('SMS OTP Provider (MSG91) & send-otp OTP_AUTH_MODE=sms', () => {
  test('Msg91SmsProvider sends POST request to MSG91 API, returns ok & providerRef, and never logs OTP, phone, or secret', async () => {
    let capturedUrl = '';
    let capturedInit: RequestInit | undefined;

    const provider = new Msg91SmsProvider(
      {
        authKey: SECRET_KEY,
        templateId: 'tpl_civic_123',
        senderId: 'ICIVIC',
      },
      async (input, init) => {
        capturedUrl = String(input);
        capturedInit = init;
        return new Response(JSON.stringify({ type: 'success', request_id: 'req_msg91_001' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      },
    );

    const logOutput = await captureConsoleOutput(async () => {
      const result = await provider.send(SAMPLE_PHONE, SAMPLE_OTP);
      expect(result).toEqual({ ok: true, providerRef: 'req_msg91_001' });
    });

    const parsed = new URL(capturedUrl);
    expect(parsed.origin + parsed.pathname).toBe('https://control.msg91.com/api/v5/otp');
    expect(parsed.searchParams.get('mobile')).toBe(`91${SAMPLE_PHONE}`);
    expect(parsed.searchParams.get('otp')).toBe(SAMPLE_OTP);
    expect(parsed.searchParams.get('template_id')).toBe('tpl_civic_123');
    expect(parsed.searchParams.get('sender')).toBe('ICIVIC');
    expect(capturedInit?.method).toBe('POST');
    expect((capturedInit?.headers as Record<string, string>)?.authkey).toBe(SECRET_KEY);

    expect(logOutput).not.toContain(SAMPLE_OTP);
    expect(logOutput).not.toContain(SAMPLE_PHONE);
    expect(logOutput).not.toContain(SECRET_KEY);
  });

  test('Msg91SmsProvider returns ok:false cleanly on HTTP error, provider error, or fetch rejection without logging PII', async () => {
    const scenarios = [
      async () => new Response('Bad Gateway', { status: 502 }),
      async () =>
        new Response(JSON.stringify({ type: 'error', message: 'Invalid auth key' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      async () => {
        throw new TypeError(`Network error for mobile=91${SAMPLE_PHONE}&otp=${SAMPLE_OTP}`);
      },
    ];

    for (const mockFetch of scenarios) {
      const provider = new Msg91SmsProvider(
        {
          authKey: SECRET_KEY,
          templateId: 'tpl_civic_123',
          senderId: 'ICIVIC',
        },
        mockFetch,
      );

      const logOutput = await captureConsoleOutput(async () => {
        const result = await provider.send(SAMPLE_PHONE, SAMPLE_OTP);
        expect(result).toEqual({ ok: false });
      });

      expect(logOutput).not.toContain(SAMPLE_OTP);
      expect(logOutput).not.toContain(SAMPLE_PHONE);
      expect(logOutput).not.toContain(SECRET_KEY);
    }
  });

  test('getSmsProvider throws non-PII error when MSG91 env vars are missing in production', () => {
    for (const env of [
      { NODE_ENV: 'production' },
      { NODE_ENV: 'development', VERCEL_ENV: 'production' },
      {
        NODE_ENV: 'production',
        MSG91_AUTH_KEY: 'present',
        MSG91_TEMPLATE_ID: 'present',
      },
      {
        NODE_ENV: 'production',
        MSG91_AUTH_KEY: 'present',
        MSG91_SENDER_ID: 'ICIVIC',
      },
    ]) {
      let caught: Error | undefined;
      try {
        getSmsProvider({ env });
      } catch (err) {
        caught = err as Error;
      }
      expect(caught).toBeInstanceOf(Error);
      expect(caught?.message).toBe('SMS provider configuration missing in production environment');
      expect(caught?.message).not.toContain('present');
    }
  });

  test('send-otp with OTP_AUTH_MODE=sms returns 200 { success: true, mode: "sms" } with no otp key via mocked global fetch', async () => {
    const origFetch = globalThis.fetch;
    let fetchCalls = 0;

    globalThis.fetch = (async () => {
      fetchCalls += 1;
      return new Response(JSON.stringify({ type: 'success', request_id: 'req_abc' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as typeof fetch;

    try {
      for (const nodeEnv of ['production', 'development']) {
        const response = await handleSendOtpRequest(makeSendOtpRequest(SAMPLE_PHONE), {
          env: {
            NODE_ENV: nodeEnv,
            OTP_AUTH_MODE: 'sms',
            MSG91_AUTH_KEY: SECRET_KEY,
            MSG91_TEMPLATE_ID: 'tpl_civic_123',
            MSG91_SENDER_ID: 'ICIVIC',
          },
          generateOtp: async () => SAMPLE_OTP,
          checkRateLimit: async () => ALLOW_RATE_LIMIT,
        });

        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body).toEqual({ success: true, mode: 'sms' });
        expect('otp' in body).toBe(false);
        expect(JSON.stringify(body)).not.toContain(SAMPLE_OTP);
      }
      expect(fetchCalls).toBe(2);
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  test('send-otp with OTP_AUTH_MODE=sms returns 502 generic error without revealing OTP when provider fails', async () => {
    const response = await handleSendOtpRequest(makeSendOtpRequest(SAMPLE_PHONE), {
      env: {
        NODE_ENV: 'production',
        OTP_AUTH_MODE: 'sms',
        MSG91_AUTH_KEY: SECRET_KEY,
        MSG91_TEMPLATE_ID: 'tpl_civic_123',
        MSG91_SENDER_ID: 'ICIVIC',
      },
      fetchFn: async () =>
        new Response(JSON.stringify({ type: 'error', message: 'Insufficient balance' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }),
      generateOtp: async () => SAMPLE_OTP,
      checkRateLimit: async () => ALLOW_RATE_LIMIT,
    });

    expect(response.status).toBe(502);
    const body = await response.json();
    expect(body).toEqual({
      statusCode: 502,
      message: 'Failed to send verification OTP. Please try again later.',
    });
    expect('otp' in body).toBe(false);
    expect(JSON.stringify(body)).not.toContain(SAMPLE_OTP);
  });

  test('preserves development console behaviour and enforces rate limit before SMS delivery', async () => {
    const devConsoleRes = await handleSendOtpRequest(makeSendOtpRequest(SAMPLE_PHONE), {
      env: { NODE_ENV: 'development', OTP_AUTH_MODE: 'console' },
      generateOtp: async () => SAMPLE_OTP,
      checkRateLimit: async () => ALLOW_RATE_LIMIT,
    });
    expect(devConsoleRes.status).toBe(200);
    const devBody = await devConsoleRes.json();
    expect(devBody.mode).toBe('console');
    expect(devBody.otp).toBe(SAMPLE_OTP);

    let smsCalled = false;
    const rateLimitedRes = await handleSendOtpRequest(makeSendOtpRequest(SAMPLE_PHONE), {
      env: {
        NODE_ENV: 'production',
        OTP_AUTH_MODE: 'sms',
        MSG91_AUTH_KEY: SECRET_KEY,
        MSG91_TEMPLATE_ID: 'tpl_civic_123',
        MSG91_SENDER_ID: 'ICIVIC',
      },
      fetchFn: async () => {
        smsCalled = true;
        return new Response('{}', { status: 200 });
      },
      generateOtp: async () => SAMPLE_OTP,
      checkRateLimit: async () => ({
        ...ALLOW_RATE_LIMIT,
        success: false,
        remaining: 0,
        retryAfterSeconds: 600,
      }),
    });
    expect(rateLimitedRes.status).toBe(429);
    expect(smsCalled).toBe(false);
  });
});

