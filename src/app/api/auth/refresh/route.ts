import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createJwtToken, decodeJwtToken } from '@/lib/auth-jwt';

export async function POST() {
  try {
    const cookieStore = cookies();
    const refreshToken = cookieStore.get('ic_refresh_token')?.value;

    if (!refreshToken) {
      return NextResponse.json(
        { statusCode: 401, message: 'No refresh token cookie found' },
        { status: 401 },
      );
    }

    const payload = decodeJwtToken(refreshToken);
    if (!payload || payload.type !== 'refresh' || (payload.exp && payload.exp * 1000 < Date.now())) {
      const errorResponse = NextResponse.json(
        { statusCode: 401, message: 'Invalid or expired refresh token' },
        { status: 401 },
      );
      errorResponse.cookies.delete('ic_access_token');
      errorResponse.cookies.delete('ic_refresh_token');
      return errorResponse;
    }

    const newPayload = { ...payload };
    delete newPayload.exp;
    delete newPayload.iat;
    delete newPayload.type;

    const accessToken = await createJwtToken(newPayload, '7d');
    const newRefreshToken = await createJwtToken({ ...newPayload, type: 'refresh' }, '30d');

    const isProduction = process.env.NODE_ENV === 'production';
    const response = NextResponse.json({ success: true, accessToken });

    response.cookies.set('ic_access_token', accessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60,
    });

    response.cookies.set('ic_refresh_token', newRefreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60,
    });

    return response;
  } catch (error: any) {
    return NextResponse.json(
      { statusCode: 500, message: 'Internal server error', error: error.message },
      { status: 500 },
    );
  }
}
