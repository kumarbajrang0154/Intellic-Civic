import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createJwtToken } from '@/lib/auth-jwt';
import { verifySavedOtp } from '@/lib/otp-store';
import { getOrCreateCitizenProfile, normalizeMobileNumber } from '@/lib/user-store';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { mobileNumber, otp } = body;

    const cleanNumber = normalizeMobileNumber(mobileNumber);
    if (!cleanNumber || cleanNumber.length !== 10) {
      return NextResponse.json(
        { statusCode: 400, message: 'Invalid 10-digit mobile number' },
        { status: 400 },
      );
    }

    if (!otp || otp.length !== 6) {
      return NextResponse.json(
        { statusCode: 400, message: 'OTP must be 6 numeric digits' },
        { status: 400 },
      );
    }

    const isValid = verifySavedOtp(cleanNumber, otp);
    if (!isValid) {
      return NextResponse.json(
        { statusCode: 401, message: 'Invalid or expired OTP code. Try 123456 or resend OTP.' },
        { status: 401 },
      );
    }

    const profile = getOrCreateCitizenProfile(cleanNumber);
    const userId = profile.id;

    const userPayload = {
      sub: userId,
      mobileNumber: cleanNumber,
      role: 'CITIZEN',
      name: profile.name || `Citizen (+91 ${cleanNumber})`,
      email: profile.email,
      isProfileComplete: profile.isProfileComplete,
    };

    const accessToken = await createJwtToken(userPayload, '7d');
    const refreshToken = await createJwtToken({ ...userPayload, type: 'refresh' }, '30d');

    const cookieStore = cookies();
    const isProduction = process.env.NODE_ENV === 'production';

    cookieStore.set('ic_access_token', accessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60,
    });

    cookieStore.set('ic_refresh_token', refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60,
    });

    return NextResponse.json({
      success: true,
      isFirstTime: !profile.isProfileComplete,
      isProfileComplete: profile.isProfileComplete,
      user: profile,
    });
  } catch (error: any) {
    return NextResponse.json(
      { statusCode: 500, message: 'Internal server error', error: error.message },
      { status: 500 },
    );
  }
}
