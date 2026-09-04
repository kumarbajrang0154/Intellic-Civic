import { NextRequest, NextResponse } from 'next/server';
import { createJwtToken } from '@/lib/auth-jwt';
import { getFirebaseAdminAuth } from '@/lib/firebase-admin';
import { verifySavedOtp } from '@/lib/otp-store';
import { getOrCreateCitizenProfile, normalizeMobileNumber } from '@/lib/user-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const start = Date.now();
  const log = (step: string, details?: any) =>
    console.log(`[VERIFY-OTP] ${step} at +${Date.now() - start}ms${details !== undefined ? ` | ${JSON.stringify(details)}` : ''}`);

  try {
    log('handler-start');

    const result = await Promise.race([
      (async () => {
        log('before-parse-body');
        let body: any;
        try {
          body = await req.json();
          log('after-parse-body');
        } catch (err: any) {
          log('parse-body-error', err?.message);
          return NextResponse.json(
            { statusCode: 400, message: 'Invalid or missing JSON request body' },
            { status: 400, headers: { 'Content-Type': 'application/json' } },
          );
        }

        const { mobileNumber, otp, idToken } = body || {};
        const mode = (process.env.OTP_AUTH_MODE || 'console').toLowerCase();
        let cleanNumber = normalizeMobileNumber(mobileNumber);

        log('mode-evaluated', { mode, hasIdToken: Boolean(idToken), cleanNumber });

        // =========================================================================
        // FIREBASE MODE: Verify Firebase ID Token via Firebase Admin SDK
        // =========================================================================
        if (mode === 'firebase' || idToken) {
          log('firebase-mode-start');
          if (!idToken) {
            log('firebase-mode-missing-idtoken');
            return NextResponse.json(
              { statusCode: 400, message: 'Firebase idToken is required for verification' },
              { status: 400 },
            );
          }

          let decodedToken;
          try {
            log('before-firebase-admin-auth');
            const firebaseAdminAuth = getFirebaseAdminAuth();
            log('after-firebase-admin-auth', { initialized: Boolean(firebaseAdminAuth) });

            if (!firebaseAdminAuth) {
              log('firebase-admin-auth-null');
              return NextResponse.json(
                {
                  statusCode: 500,
                  message:
                    'Firebase Admin SDK is not initialized. Please configure FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY environment variables in Vercel.',
                },
                { status: 500 },
              );
            }

            log('before-verify-id-token');
            decodedToken = await firebaseAdminAuth.verifyIdToken(idToken);
            log('after-verify-id-token');
          } catch (err: any) {
            log('firebase-auth-error', err?.message || String(err));
            console.error('[FIREBASE AUTH ERROR] ID token verification failed:', err);
            return NextResponse.json(
              { statusCode: 401, message: `Invalid or expired Firebase authentication token: ${err.message || err}` },
              { status: 401 },
            );
          }

          const tokenPhone = decodedToken.phone_number;
          if (tokenPhone) {
            cleanNumber = tokenPhone.replace(/\D/g, '').slice(-10);
          }

          if (!cleanNumber || cleanNumber.length !== 10) {
            log('firebase-mode-invalid-phone');
            return NextResponse.json(
              { statusCode: 400, message: 'Could not extract valid 10-digit mobile number from token' },
              { status: 400 },
            );
          }

          log('before-user-lookup');
          const profile = await getOrCreateCitizenProfile(cleanNumber);
          log('after-user-lookup', { userId: profile.id });

          const userPayload = {
            sub: profile.id,
            mobileNumber: cleanNumber,
            role: 'CITIZEN',
            name: profile.name || `Citizen (+91 ${cleanNumber})`,
            email: profile.email,
            isProfileComplete: profile.isProfileComplete,
          };

          log('before-jwt-sign');
          const accessToken = await createJwtToken(userPayload, '7d');
          const refreshToken = await createJwtToken({ ...userPayload, type: 'refresh' }, '30d');
          log('after-jwt-sign');

          const isProduction = process.env.NODE_ENV === 'production';

          log('before-set-cookies');
          const response = NextResponse.json({
            success: true,
            mode: 'firebase',
            isFirstTime: !profile.isProfileComplete,
            isProfileComplete: profile.isProfileComplete,
            user: profile,
          });

          response.cookies.set('ic_access_token', accessToken, {
            httpOnly: true,
            secure: isProduction,
            sameSite: 'lax',
            path: '/',
            maxAge: 7 * 24 * 60 * 60,
          });

          response.cookies.set('ic_refresh_token', refreshToken, {
            httpOnly: true,
            secure: isProduction,
            sameSite: 'lax',
            path: '/',
            maxAge: 30 * 24 * 60 * 60,
          });
          log('after-set-cookies');

          return response;
        }

        // =========================================================================
        // CONSOLE MODE (Default): Verify 6-digit OTP code against Postgres DB
        // =========================================================================
        log('console-mode-start');
        if (!cleanNumber || cleanNumber.length !== 10) {
          log('console-mode-invalid-mobile');
          return NextResponse.json(
            { statusCode: 400, message: 'Invalid 10-digit mobile number' },
            { status: 400 },
          );
        }

        if (!otp || otp.length !== 6) {
          log('console-mode-invalid-otp');
          return NextResponse.json(
            { statusCode: 400, message: 'OTP must be 6 numeric digits' },
            { status: 400 },
          );
        }

        log('before-otp-check');
        const isValid = await verifySavedOtp(cleanNumber, otp);
        log('after-otp-check', { isValid });

        if (!isValid) {
          log('console-mode-otp-invalid');
          return NextResponse.json(
            { statusCode: 401, message: 'Invalid or expired OTP code. Try 123456 or resend OTP.' },
            { status: 401 },
          );
        }

        log('before-user-lookup');
        const profile = await getOrCreateCitizenProfile(cleanNumber);
        log('after-user-lookup', { userId: profile.id });

        const userPayload = {
          sub: profile.id,
          mobileNumber: cleanNumber,
          role: 'CITIZEN',
          name: profile.name || `Citizen (+91 ${cleanNumber})`,
          email: profile.email,
          isProfileComplete: profile.isProfileComplete,
        };

        log('before-jwt-sign');
        const accessToken = await createJwtToken(userPayload, '7d');
        const refreshToken = await createJwtToken({ ...userPayload, type: 'refresh' }, '30d');
        log('after-jwt-sign');

        const isProduction = process.env.NODE_ENV === 'production';

        log('before-set-cookies');
        const response = NextResponse.json({
          success: true,
          mode: 'console',
          isFirstTime: !profile.isProfileComplete,
          isProfileComplete: profile.isProfileComplete,
          user: profile,
        });

        response.cookies.set('ic_access_token', accessToken, {
          httpOnly: true,
          secure: isProduction,
          sameSite: 'lax',
          path: '/',
          maxAge: 7 * 24 * 60 * 60,
        });

        response.cookies.set('ic_refresh_token', refreshToken, {
          httpOnly: true,
          secure: isProduction,
          sameSite: 'lax',
          path: '/',
          maxAge: 30 * 24 * 60 * 60,
        });
        log('after-set-cookies');

        return response;
      })(),
      new Promise<NextResponse>((_, reject) =>
        setTimeout(() => reject(new Error('INTERNAL_TIMEOUT_8000ms')), 8000)
      ),
    ]);

    log('handler-success');
    return result;
  } catch (error: any) {
    log(`handler-error: ${error?.message || error}`);
    console.error('[VERIFY-OTP FATAL]', error?.name, error?.message, error?.stack);
    return NextResponse.json(
      {
        success: false,
        message:
          error?.message === 'INTERNAL_TIMEOUT_8000ms'
            ? 'Request timed out internally — check logs for last checkpoint reached'
            : 'Server verification error',
        debug: error?.message || String(error),
      },
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
}

