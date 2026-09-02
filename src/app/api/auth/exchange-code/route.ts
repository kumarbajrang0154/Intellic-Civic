import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createJwtToken } from '@/lib/auth-jwt';
import { addUser, ensureSuperAdminUser, getUserByEmail } from '@/lib/staff-dept-store';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { code, email } = body;

    let userEmail = email || 'kumarbajrang325@gmail.com';

    // Extract email from code string if passed like `code_email@domain.com`
    if (code && typeof code === 'string' && code.includes('_')) {
      const parts = code.split('_');
      const potentialEmail = parts[parts.length - 1];
      if (potentialEmail && potentialEmail.includes('@')) {
        userEmail = potentialEmail;
      }
    }

    const SUPER_ADMIN_EMAIL = 'kumarbajrang325@gmail.com';
    let user;

    if (userEmail.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()) {
      user = await ensureSuperAdminUser(userEmail, 'Bajrang Kumar (Super Admin)');
    } else {
      user = await getUserByEmail(userEmail);
    }

    if (!user || !user.isAuthorized || user.isSuspended) {
      return NextResponse.json(
        { statusCode: 403, message: 'Account is not authorized or suspended' },
        { status: 403 },
      );
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

    return NextResponse.json({ success: true, user });
  } catch (error: any) {
    return NextResponse.json(
      { statusCode: 500, message: 'Internal server error', error: error.message },
      { status: 500 },
    );
  }
}
