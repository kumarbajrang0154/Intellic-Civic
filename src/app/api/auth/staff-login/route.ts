import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import prisma from '@/lib/prisma';
import { createJwtToken } from '@/lib/auth-jwt';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALLOWED_STAFF_ROLES = ['DEPARTMENT_HEAD', 'DEPARTMENT_OFFICER', 'FIELD_WORKER', 'ADMIN', 'SUPER_ADMIN'];

function getPortalRouteForRole(role?: string | null): string {
  switch (role) {
    case 'ADMIN':
    case 'SUPER_ADMIN':
      return '/admin';
    case 'DEPARTMENT_HEAD':
      return '/dept-head';
    case 'DEPARTMENT_OFFICER':
      return '/officer';
    case 'FIELD_WORKER':
      return '/field-worker';
    case 'CITIZEN':
      return '/citizen';
    default:
      return '/pending-approval';
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const rawLoginId = typeof body.loginId === 'string' ? body.loginId.trim() : '';
    const rawPassword = typeof body.password === 'string' ? body.password : '';

    const GENERIC_ERROR_RESPONSE = {
      statusCode: 401,
      message: 'Invalid login ID or password.',
    };

    if (!rawLoginId || !rawPassword) {
      return NextResponse.json(GENERIC_ERROR_RESPONSE, { status: 401 });
    }

    // Look up staff user by unique loginId (case-insensitive)
    const user = await prisma.user.findFirst({
      where: {
        loginId: {
          equals: rawLoginId,
          mode: 'insensitive',
        },
      },
    });

    if (!user) {
      return NextResponse.json(GENERIC_ERROR_RESPONSE, { status: 401 });
    }

    // Lockout check: if account is locked until a future time, reject
    const now = new Date();
    if (user.lockedUntil && user.lockedUntil > now) {
      return NextResponse.json(GENERIC_ERROR_RESPONSE, { status: 401 });
    }

    // If account has no password hash set
    if (!user.passwordHash) {
      return NextResponse.json(GENERIC_ERROR_RESPONSE, { status: 401 });
    }

    // Verify hash
    const isPasswordValid = await bcrypt.compare(rawPassword, user.passwordHash);

    if (!isPasswordValid) {
      // Increment failed count; lockout after 5 failures for 15 minutes
      const newFailures = (user.failedLoginCount || 0) + 1;
      const isNowLocked = newFailures >= 5;
      const lockedUntil = isNowLocked ? new Date(Date.now() + 15 * 60 * 1000) : null;

      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginCount: newFailures,
          ...(isNowLocked ? { lockedUntil } : {}),
        },
      });

      return NextResponse.json(GENERIC_ERROR_RESPONSE, { status: 401 });
    }

    // Reject suspended, archived, unauthorized, or non-staff accounts
    if (user.isSuspended) {
      return NextResponse.json(GENERIC_ERROR_RESPONSE, { status: 401 });
    }

    if (user.deletedAt !== null) {
      return NextResponse.json(GENERIC_ERROR_RESPONSE, { status: 401 });
    }

    if (!user.isAuthorized) {
      return NextResponse.json(GENERIC_ERROR_RESPONSE, { status: 401 });
    }

    // Citizens and accounts without staff role cannot use this endpoint
    if (!user.role || user.role === 'CITIZEN' || !ALLOWED_STAFF_ROLES.includes(user.role)) {
      return NextResponse.json(GENERIC_ERROR_RESPONSE, { status: 401 });
    }

    // Authentication succeeded: reset failure counters and update lastLoginAt
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginCount: 0,
        lockedUntil: null,
        lastLoginAt: now,
      },
    });

    // Issue the SAME session JWT cookies as Google login
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

    const isProduction = process.env.NODE_ENV === 'production';
    const targetPortal = getPortalRouteForRole(user.role);

    const response = NextResponse.json({
      success: true,
      role: user.role,
      redirectUrl: targetPortal,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        departmentId: user.departmentId,
      },
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
  } catch {
    return NextResponse.json(
      { statusCode: 401, message: 'Invalid login ID or password.' },
      { status: 401 },
    );
  }
}
