import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      return NextResponse.json({ statusCode: 500, message: 'Google OAuth not configured' }, { status: 500 });
    }

    // Build Google OAuth 2.0 authorization URL with sanitized base URL (strip trailing slashes)
    const baseUrl = (process.env.NEXT_PUBLIC_FRONTEND_URL || 'http://localhost:3000').replace(/\/+$/, '');
    const redirectUri = `${baseUrl}/api/auth/google/callback`;

    const state = crypto.randomUUID();

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      access_type: 'offline',
      prompt: 'select_account',
      state,
    });

    const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    const response = NextResponse.redirect(googleAuthUrl);
    response.cookies.set('oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 600, // 10 minutes
    });
    return response;
  } catch (error: any) {
    return NextResponse.json(
      { statusCode: 500, message: 'Google OAuth initiation failed', ...(process.env.NODE_ENV !== 'production' ? { error: error?.message || String(error) } : {}) },
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
}
