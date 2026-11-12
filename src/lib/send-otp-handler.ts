import { NextResponse } from 'next/server';
import {
  buildConsoleOtpResponsePayload,
  generateAndSaveOtp,
  isProductionOtpEnv,
  shouldExposeOtpInResponse,
  type DemoOtpEnv,
} from '@/lib/otp-store';
import { normalizeMobileNumber } from '@/lib/user-store';
import {
  checkSendOtpRateLimit,
  rateLimitErrorResponse,
  type RateLimitResult,
} from '@/lib/rate-limit';
import { getSmsProvider, type SmsEnv, type SmsProvider } from '@/lib/sms';
import type { FetchLike } from '@/lib/sms/msg91';

export type SendOtpEnv = SmsEnv &
  DemoOtpEnv & {
    OTP_AUTH_MODE?: string;
  };

export interface SendOtpHandlerDeps {
  env?: SendOtpEnv;
  fetchFn?: FetchLike;
  smsProvider?: SmsProvider;
  generateOtp?: (mobileNumber: string) => Promise<string>;
  checkRateLimit?: (request: Request, cleanNumber: string) => Promise<RateLimitResult>;
}

/** Executes the /api/auth/send-otp flow across firebase, sms, and console modes. */
export async function handleSendOtpRequest(
  request: Request,
  deps: SendOtpHandlerDeps = {},
): Promise<NextResponse> {
  const env = deps.env ?? (process.env as SendOtpEnv);
  const checkRateLimit = deps.checkRateLimit ?? checkSendOtpRateLimit;
  const saveOtp = deps.generateOtp ?? generateAndSaveOtp;

  try {
    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { statusCode: 400, message: 'Invalid or missing JSON request body' },
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const { mobileNumber } = body || {};

    const cleanNumber = normalizeMobileNumber(mobileNumber);
    if (!cleanNumber || cleanNumber.length !== 10) {
      return NextResponse.json(
        { statusCode: 400, message: 'Mobile number must be a valid 10-digit number' },
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    // Rate limiting: IP (10 / 10m) + Phone (3 / 10m)
    const rateLimitResult = await checkRateLimit(request, cleanNumber);
    if (!rateLimitResult.success) {
      return rateLimitErrorResponse(rateLimitResult);
    }

    const mode = (env.OTP_AUTH_MODE || 'console').toLowerCase();

    // Firebase mode: OTP SMS generation and verification are handled by Firebase Client SDK on frontend.
    if (mode === 'firebase') {
      return NextResponse.json(
        {
          success: true,
          message: 'Firebase Phone Auth active. SMS sent via Firebase Client SDK.',
          mode: 'firebase',
          mobileNumber: cleanNumber,
        },
        { headers: { 'Content-Type': 'application/json' } },
      );
    }

    // SMS mode: Generate & persist OTP in Postgres, send via SMS provider, never return OTP in response.
    if (mode === 'sms') {
      const smsProvider =
        deps.smsProvider ?? getSmsProvider({ env, fetchFn: deps.fetchFn });
      const otp = await saveOtp(cleanNumber);

      let smsResult: { ok: boolean; providerRef?: string };
      try {
        smsResult = await smsProvider.send(cleanNumber, otp);
      } catch {
        smsResult = { ok: false };
      }

      if (!smsResult.ok) {
        return NextResponse.json(
          { statusCode: 502, message: 'Failed to send verification OTP. Please try again later.' },
          { status: 502, headers: { 'Content-Type': 'application/json' } },
        );
      }

      return NextResponse.json(
        {
          success: true,
          mode: 'sms',
        },
        { headers: { 'Content-Type': 'application/json' } },
      );
    }

    // Console mode (Default for dev/testing): Generate OTP, save in Postgres, log to console in development only.
    const otp = await saveOtp(cleanNumber);
    if (shouldExposeOtpInResponse(env)) {
      console.log(`[CONSOLE OTP] Mobile: +91${cleanNumber} | Code: ${otp} | Timestamp: ${new Date().toISOString()}`);
    }

    return NextResponse.json(
      buildConsoleOtpResponsePayload(cleanNumber, otp, env),
      { headers: { 'Content-Type': 'application/json' } },
    );
  } catch (error: unknown) {
    console.error(
      '[SEND OTP SERVER ERROR]',
      isProductionOtpEnv(env) && error instanceof Error ? error.name : error,
    );
    return NextResponse.json(
      { statusCode: 500, message: 'Internal server error' },
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
}

