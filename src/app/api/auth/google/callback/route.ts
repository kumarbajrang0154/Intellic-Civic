import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import {
  issueTwoFactorChallengeIfRequired,
  TWO_FACTOR_CHALLENGE_COOKIE,
  TWO_FACTOR_CHALLENGE_MAX_AGE_SEC,
} from '@/lib/admin-2fa-gate';
import prisma from '@/lib/prisma';
import { createJwtToken } from '@/lib/auth-jwt';
import { getPortalRouteForRole } from '@/lib/portal-routes';
import { addUser, ensureSuperAdminUser, getUserByEmail, isSuperAdminEmail } from '@/lib/staff-dept-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const frontendUrl = (process.env.NEXT_PUBLIC_FRONTEND_URL || 'http://localhost:3000').replace(/\/+$/, '');
  const redirectUri = `${frontendUrl}/api/auth/google/callback`;

  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const state = searchParams.get('state');
  const cookieState = req.cookies.get('oauth_state')?.value;

  // Google cancelled or denied
  if (error || !code) {
    return NextResponse.redirect(new URL('/login/staff?error=google_cancelled', frontendUrl));
  }

  // Validate state against CSRF if state cookie was set
  if (cookieState && state && state !== cookieState) {
    console.warn('[SECURITY] Google OAuth CSRF state mismatch detected.');
    return NextResponse.redirect(new URL('/login/staff?error=csrf_detected', frontendUrl));
  }

  try {
    // Step 1: Exchange authorization code for tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }).toString(),
    });

    if (!tokenRes.ok) {
      console.error('Token exchange failed:', await tokenRes.text());
      return NextResponse.redirect(new URL('/login/staff?error=token_exchange_failed', frontendUrl));
    }

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;

    if (!accessToken) {
      return NextResponse.redirect(new URL('/login/staff?error=no_access_token', frontendUrl));
    }

    // Step 2: Fetch Google user profile info
    const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!userInfoRes.ok) {
      return NextResponse.redirect(new URL('/login/staff?error=userinfo_failed', frontendUrl));
    }

    const googleUser = await userInfoRes.json();
    const googleEmail = googleUser.email?.toLowerCase().trim();
    const googleName = googleUser.name || googleUser.email?.split('@')[0] || 'Staff Member';
    const emailVerified = googleUser.email_verified === true || googleUser.email_verified === 'true';
    const googleId = googleUser.sub || null;

    if (!googleEmail || !emailVerified) {
      return NextResponse.redirect(new URL('/login/staff?error=unverified_email', frontendUrl));
    }

    // Step 3: Look up the user in the staff database
    let staffUser;

    if (isSuperAdminEmail(googleEmail)) {
      // Super Admin bootstrap — always elevate as SUPER_ADMIN, authorized
      staffUser = await ensureSuperAdminUser(googleEmail, googleName);
    } else {
      staffUser = await getUserByEmail(googleEmail);
    }

    // Step 4: If user not in database, register as pending and redirect
    if (!staffUser) {
      const newUser = await addUser({
        name: googleName,
        email: googleEmail,
        role: null,
        departmentId: null,
        isAuthorized: false,
      });
      if (googleId) {
        await prisma.user.update({
          where: { id: newUser.id },
          data: { googleId },
        });
      }
      const res = NextResponse.redirect(new URL('/login/staff?error=pending_approval', frontendUrl));
      res.cookies.delete('ic_access_token');
      res.cookies.delete('ic_refresh_token');
      return res;
    }

    // Link googleId to existing staff row if needed
    if (googleId && staffUser.googleId !== googleId) {
      await prisma.user.update({
        where: { id: staffUser.id },
        data: { googleId },
      });
    }

    // Step 5: Check archive & suspension
    if (staffUser.deletedAt) {
      const res = NextResponse.redirect(new URL('/login/staff?error=account_deactivated', frontendUrl));
      res.cookies.delete('ic_access_token');
      res.cookies.delete('ic_refresh_token');
      return res;
    }

    if (staffUser.isSuspended) {
      const res = NextResponse.redirect(new URL('/login/staff?error=account_suspended', frontendUrl));
      res.cookies.delete('ic_access_token');
      res.cookies.delete('ic_refresh_token');
      return res;
    }

    // Step 6: Check authorization
    if (!staffUser.isAuthorized) {
      const res = NextResponse.redirect(new URL('/login/staff?error=pending_approval', frontendUrl));
      res.cookies.delete('ic_access_token');
      res.cookies.delete('ic_refresh_token');
      return res;
    }

    const isProduction = process.env.NODE_ENV === 'production';

    // Step 7a: Require Admin 2FA challenge if enabled on account
    const challengeToken = await issueTwoFactorChallengeIfRequired(staffUser.id, staffUser.role);
    if (challengeToken) {
      const challengeRes = NextResponse.redirect(new URL('/login/staff?step=2fa', frontendUrl));
      challengeRes.cookies.delete('ic_access_token');
      challengeRes.cookies.delete('ic_refresh_token');
      challengeRes.cookies.set(TWO_FACTOR_CHALLENGE_COOKIE, challengeToken, {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'lax',
        path: '/',
        maxAge: TWO_FACTOR_CHALLENGE_MAX_AGE_SEC,
      });
      return challengeRes;
    }

    // Step 7b: Issue JWT session cookies
    const jwtPayload = {
      sub: staffUser.id,
      email: staffUser.email,
      name: staffUser.name,
      role: staffUser.role,
      departmentId: staffUser.departmentId,
      isAuthorized: true,
    };

    const jwtAccess = await createJwtToken(jwtPayload, '7d');
    const jwtRefresh = await createJwtToken({ ...jwtPayload, type: 'refresh' }, '30d');

    const cookieStore = cookies();

    cookieStore.set('ic_access_token', jwtAccess, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60,
    });

    cookieStore.set('ic_refresh_token', jwtRefresh, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60,
    });

    // Step 8: Redirect to role-specific portal
    const targetPortal = getPortalRouteForRole(staffUser.role);
    return NextResponse.redirect(new URL(targetPortal, frontendUrl));
  } catch (err: any) {
    console.error('Google OAuth callback error:', err);
    return NextResponse.redirect(new URL('/login/staff?error=server_error', frontendUrl));
  }
}
