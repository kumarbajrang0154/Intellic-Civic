import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { accessToken, refreshToken } = await request.json();

    if (!accessToken || !refreshToken) {
      return NextResponse.json(
        { statusCode: 400, message: 'accessToken and refreshToken are required' },
        { status: 400 },
      );
    }

    const isProduction = process.env.NODE_ENV === 'production';
    const response = NextResponse.json({ success: true });

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
      { statusCode: 500, message: 'Internal server error', error: error.message },
      { status: 500 },
    );
  }
}
