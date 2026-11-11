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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = (body.email || '').trim().toLowerCase();
    const googleName = (body.name || '').trim();
    const googleId = body.googleId || body.sub || null;
    const emailVerified = body.email_verified ?? body.emailVerified;

    if (!email) {
      return NextResponse.json(
        { statusCode: 400, message: 'Google account email is required' },
        { status: 400 },
      );
    }

    // Require email_verified === true to prevent unverified email impersonation
    if (emailVerified !== true) {
      return NextResponse.json(
        { statusCode: 401, message: 'Google email address is not verified.' },
        { status: 401 },
      );
    }

    let user;

    if (isSuperAdminEmail(email)) {
      user = await ensureSuperAdminUser(email, googleName || 'Bajrang Kumar (Super Admin)');
    } else {
      user = await getUserByEmail(email);
    }

    if (!user) {
      // New user registering via Google
      user = await addUser({
        name: googleName || email.split('@')[0],
        email: email,
        role: null,
        departmentId: null,
        isAuthorized: false,
      });

      if (googleId) {
        await prisma.user.update({
          where: { id: user.id },
          data: { googleId },
        });
      }

      const res = NextResponse.json({
        success: false,
        status: 'PENDING',
        message: 'Your Google staff account has been registered and is awaiting approval by Super Admin.',
        redirectUrl: '/pending-approval',
      });
      res.cookies.delete('ic_access_token');
      res.cookies.delete('ic_refresh_token');
      return res;
    }

    // Existing staff row found: link googleId and preserve role/department/municipality
    if (googleId && user.googleId !== googleId) {
      await prisma.user.update({
        where: { id: user.id },
        data: { googleId },
      });
    }

    // Respect archived / soft-deleted state
    if (user.deletedAt !== null) {
      const res = NextResponse.json(
        {
          success: false,
          status: 'DEACTIVATED',
          message: 'Your staff account has been archived. Contact Super Admin.',
          redirectUrl: '/denied',
        },
        { status: 403 },
      );
      res.cookies.delete('ic_access_token');
      res.cookies.delete('ic_refresh_token');
      return res;
    }

    // Respect suspended state
    if (user.isSuspended) {
      const res = NextResponse.json(
        {
          success: false,
          status: 'SUSPENDED',
          message: 'Your staff account has been suspended. Contact Super Admin.',
          redirectUrl: '/denied',
        },
        { status: 403 },
      );
      res.cookies.delete('ic_access_token');
      res.cookies.delete('ic_refresh_token');
      return res;
    }

    // Respect unauthorized state
    if (!user.isAuthorized) {
      const res = NextResponse.json({
        success: false,
        status: 'PENDING',
        message: 'Your staff account is awaiting authorization and role assignment by Super Admin.',
        redirectUrl: '/pending-approval',
      });
      res.cookies.delete('ic_access_token');
      res.cookies.delete('ic_refresh_token');
      return res;
    }

    const isProduction = process.env.NODE_ENV === 'production';

    const challengeToken = await issueTwoFactorChallengeIfRequired(user.id, user.role);
    if (challengeToken) {
      const challengeResponse = NextResponse.json(
        {
          success: true,
          requiresTwoFactor: true,
          challengeExpiresInSec: TWO_FACTOR_CHALLENGE_MAX_AGE_SEC,
          role: user.role,
        },
        { status: 200, headers: { 'Cache-Control': 'no-store' } },
      );
      challengeResponse.cookies.delete('ic_access_token');
      challengeResponse.cookies.delete('ic_refresh_token');
      challengeResponse.cookies.set(TWO_FACTOR_CHALLENGE_COOKIE, challengeToken, {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'lax',
        path: '/',
        maxAge: TWO_FACTOR_CHALLENGE_MAX_AGE_SEC,
      });
      return challengeResponse;
    }

    const userPayload = {
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      departmentId: user.departmentId,
      municipalityId: user.municipalityId,
      isAuthorized: true,
    };

    const accessToken = await createJwtToken(userPayload, '7d');
    const refreshToken = await createJwtToken({ ...userPayload, type: 'refresh' }, '30d');

    const targetPortal = getPortalRouteForRole(user.role);

    const response = NextResponse.json({
      success: true,
      status: 'AUTHORIZED',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        departmentId: user.departmentId,
        googleId: googleId || user.googleId || null,
      },
      redirectUrl: targetPortal,
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

    return response;
  } catch (error: any) {
    return NextResponse.json(
      { statusCode: 500, message: 'Google authentication failed', error: error.message },
      { status: 500 },
    );
  }
}
