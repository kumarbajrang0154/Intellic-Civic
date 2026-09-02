import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { createJwtToken } from '@/lib/auth-jwt';
import { ensureSuperAdminUser } from '@/lib/staff-dept-store';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = body.email || 'kumarbajrang325@gmail.com';

    // Ensure Super Admin user is bootstrapped
    const superAdmin = ensureSuperAdminUser(email);

    const userPayload = {
      sub: superAdmin.id,
      email: superAdmin.email,
      name: superAdmin.name,
      role: 'ADMIN',
      isAuthorized: true,
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
      user: superAdmin,
      redirectUrl: '/admin',
    });
  } catch (error: any) {
    return NextResponse.json(
      { statusCode: 500, message: 'Failed to initiate Super Admin session', error: error.message },
      { status: 500 },
    );
  }
}
