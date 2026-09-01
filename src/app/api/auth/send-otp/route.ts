import { NextResponse } from 'next/server';
import { generateAndSaveOtp } from '@/lib/otp-store';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { mobileNumber } = body;

    const cleanNumber = (mobileNumber || '').replace(/\D/g, '');
    if (!cleanNumber || cleanNumber.length !== 10) {
      return NextResponse.json(
        { statusCode: 400, message: 'Mobile number must be 10 numeric digits' },
        { status: 400 },
      );
    }

    const otp = generateAndSaveOtp(cleanNumber);

    return NextResponse.json({
      success: true,
      message: 'OTP sent successfully',
      otp,
      mobileNumber: cleanNumber,
    });
  } catch (error: any) {
    return NextResponse.json(
      { statusCode: 500, message: 'Internal server error', error: error.message },
      { status: 500 },
    );
  }
}
