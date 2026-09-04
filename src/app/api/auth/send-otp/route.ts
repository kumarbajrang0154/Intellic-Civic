import { NextResponse } from 'next/server';
import { generateAndSaveOtp } from '@/lib/otp-store';
import { normalizeMobileNumber } from '@/lib/user-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
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

    const mode = (process.env.OTP_AUTH_MODE || 'console').toLowerCase();

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

    // Console mode (Default for dev/testing): Generate OTP, save in Postgres, log to console.
    const otp = await generateAndSaveOtp(cleanNumber);
    console.log(`[CONSOLE OTP] Mobile: +91${cleanNumber} | Code: ${otp} | Timestamp: ${new Date().toISOString()}`);

    return NextResponse.json(
      {
        success: true,
        message: 'OTP sent successfully',
        otp,
        mobileNumber: cleanNumber,
        mode: 'console',
      },
      { headers: { 'Content-Type': 'application/json' } },
    );
  } catch (error: any) {
    console.error('[SEND OTP SERVER ERROR]', error);
    return NextResponse.json(
      { statusCode: 500, message: 'Internal server error', error: error?.message || String(error) },
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
}
