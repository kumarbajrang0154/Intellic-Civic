import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createJwtToken } from '@/lib/auth-jwt';
import { getFirebaseAdminAuth } from '@/lib/firebase-admin';
import { verifySavedOtp } from '@/lib/otp-store';
import { getOrCreateCitizenProfile, normalizeMobileNumber } from '@/lib/user-store';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { mobileNumber, otp, idToken } = body;

    const mode = (process.env.OTP_AUTH_MODE || 'console').toLowerCase();

    let cleanNumber = normalizeMobileNumber(mobileNumber);

    // =========================================================================
    // FIREBASE MODE: Verify Firebase ID Token via Firebase Admin SDK
    // =========================================================================
    if (mode === 'firebase' || idToken) {
      if (!idToken) {
        return NextResponse.json(
          { statusCode: 400, message: 'Firebase idToken is required for verification' },
          { status: 400 },
        );
      }

      let decodedToken;
      try {
        const firebaseAdminAuth = getFirebaseAdminAuth();
        if (!firebaseAdminAuth) {
          return NextResponse.json(
            { statusCode: 500, message: 'Firebase Admin SDK is not initialized. Please configure FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY environment variables.' },
            { status: 500 },
          );
        }
        decodedToken = await firebaseAdminAuth.verifyIdToken(idToken);
      } catch (err: any) {
        console.error('[FIREBASE AUTH ERROR] ID token verification failed:', err);
        return NextResponse.json(
          { statusCode: 401, message: `Invalid or expired Firebase authentication token: ${err.message || err}` },
          { status: 401 },
        );
      }

      // Extract verified phone number from decoded token
      const tokenPhone = decodedToken.phone_number;
      if (tokenPhone) {
        cleanNumber = tokenPhone.replace(/\D/g, '').slice(-10);
      }

      if (!cleanNumber || cleanNumber.length !== 10) {
        return NextResponse.json(
          { statusCode: 400, message: 'Could not extract valid 10-digit mobile number from token' },
          { status: 400 },
        );
      }

      const profile = await getOrCreateCitizenProfile(cleanNumber);
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
        mode: 'firebase',
        isFirstTime: !profile.isProfileComplete,
        isProfileComplete: profile.isProfileComplete,
        user: profile,
      });
    }

    // =========================================================================
    // CONSOLE MODE (Default): Verify 6-digit OTP code against Postgres DB
    // =========================================================================
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

    const isValid = await verifySavedOtp(cleanNumber, otp);
    if (!isValid) {
      return NextResponse.json(
        { statusCode: 401, message: 'Invalid or expired OTP code. Try 123456 or resend OTP.' },
        { status: 401 },
      );
    }

    const profile = await getOrCreateCitizenProfile(cleanNumber);
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
      mode: 'console',
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
