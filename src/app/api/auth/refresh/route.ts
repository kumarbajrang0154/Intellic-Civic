import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

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

    const response = await fetch(`${API_URL}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    const data = await response.json();

    if (!response.ok) {
      cookieStore.delete('ic_access_token');
      cookieStore.delete('ic_refresh_token');
      return NextResponse.json(data, { status: response.status });
    }

    const isProduction = process.env.NODE_ENV === 'production';

    cookieStore.set('ic_access_token', data.accessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60,
    });

    cookieStore.set('ic_refresh_token', data.refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { statusCode: 500, message: 'Internal server error', error: error.message },
      { status: 500 },
    );
  }
}
