import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { createJwtToken } from '@/lib/auth-jwt';
import { ensureSuperAdminUser, getUserByEmail } from '@/lib/staff-dept-store';

export async function POST(req: NextRequest) {
  // Only allow in non-production environments
  const nodeEnv: string = process.env.NODE_ENV ?? 'development';
  if (nodeEnv === 'production') {
    return NextResponse.json({ message: 'Not available in production.' }, { status: 403 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const email = body.email || 'kumarbajrang325@gmail.com';
    const requestedRole = body.role;

    let userPayload;

    if (!requestedRole || requestedRole === 'ADMIN') {
      const superAdmin = ensureSuperAdminUser(email);
      userPayload = {
        sub: superAdmin.id,
        email: superAdmin.email,
        name: superAdmin.name,
        role: 'ADMIN',
        isAuthorized: true,
      };
    } else {
      // Look up staff member or create a minimal token for testing
      const staffUser = getUserByEmail(email);
      userPayload = {
        sub: staffUser?.id ?? `test_${Date.now()}`,
        email: staffUser?.email ?? email,
        name: staffUser?.name ?? 'Test User',
        role: requestedRole,
        isAuthorized: true,
        departmentId: staffUser?.departmentId ?? null,
      };
    }

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
      user: userPayload,
      redirectUrl: userPayload.role === 'ADMIN' ? '/admin' : '/officer',
    });
  } catch (error: any) {
    return NextResponse.json(
      { statusCode: 500, message: 'Failed to initiate session', error: error.message },
      { status: 500 },
    );
  }
}
