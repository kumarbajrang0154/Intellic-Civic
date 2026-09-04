import { NextRequest, NextResponse } from 'next/server';
import { createJwtToken } from '@/lib/auth-jwt';
import { addUser, ensureSuperAdminUser, getUserByEmail } from '@/lib/staff-dept-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getPortalRouteForRole(role?: string | null): string {
  switch (role) {
    case 'ADMIN':
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
    const body = await req.json();
    const email = (body.email || '').trim().toLowerCase();
    const googleName = (body.name || '').trim();

    if (!email) {
      return NextResponse.json(
        { statusCode: 400, message: 'Google account email is required' },
        { status: 400 },
      );
    }

    const SUPER_ADMIN_EMAIL = 'kumarbajrang325@gmail.com';
    let user;

    if (email === SUPER_ADMIN_EMAIL.toLowerCase()) {
      user = await ensureSuperAdminUser(email, googleName || 'Bajrang Kumar (Super Admin)');
    } else {
      user = await getUserByEmail(email);
    }

    if (!user) {
      user = await addUser({
        name: googleName || email.split('@')[0],
        email: email,
        role: null,
        departmentId: null,
        isAuthorized: false,
      });

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

    const userPayload = {
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      departmentId: user.departmentId,
      isAuthorized: true,
    };

    const accessToken = await createJwtToken(userPayload, '7d');
    const refreshToken = await createJwtToken({ ...userPayload, type: 'refresh' }, '30d');

    const isProduction = process.env.NODE_ENV === 'production';
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
