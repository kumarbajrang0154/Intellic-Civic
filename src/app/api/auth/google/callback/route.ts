import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { createJwtToken } from '@/lib/auth-jwt';
import { addUser, ensureSuperAdminUser, getUserByEmail } from '@/lib/staff-dept-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getDashboardForRole(role: string | null | undefined): string {
  switch (role) {
    case 'ADMIN':
      return '/admin';
    case 'DEPARTMENT_HEAD':
      return '/dept-head';
    case 'DEPARTMENT_OFFICER':
      return '/officer';
    case 'FIELD_WORKER':
      return '/field-worker';
    default:
      return '/pending-approval';
  }
}

export async function GET(req: NextRequest) {
  const frontendUrl = (process.env.NEXT_PUBLIC_FRONTEND_URL || 'http://localhost:3000').replace(/\/+$/, '');
  const redirectUri = `${frontendUrl}/api/auth/google/callback`;

  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  // Google cancelled or denied
  if (error || !code) {
    return NextResponse.redirect(new URL('/login/staff?error=google_cancelled', frontendUrl));
  }

  try {
    // Step 1: Exchange authorization code for tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }).toString(),
    });

    if (!tokenRes.ok) {
      console.error('Token exchange failed:', await tokenRes.text());
      return NextResponse.redirect(new URL('/login/staff?error=token_exchange_failed', frontendUrl));
    }

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;

    if (!accessToken) {
      return NextResponse.redirect(new URL('/login/staff?error=no_access_token', frontendUrl));
    }

    // Step 2: Fetch Google user profile info
    const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!userInfoRes.ok) {
      return NextResponse.redirect(new URL('/login/staff?error=userinfo_failed', frontendUrl));
    }

    const googleUser = await userInfoRes.json();
    const googleEmail = googleUser.email?.toLowerCase();
    const googleName = googleUser.name || googleUser.email?.split('@')[0] || 'Staff Member';

    if (!googleEmail) {
      return NextResponse.redirect(new URL('/login/staff?error=no_email', frontendUrl));
    }

    const SUPER_ADMIN_EMAIL = process.env.SUPER_ADMIN_BOOTSTRAP_EMAIL || 'kumarbajrang325@gmail.com';

    // Step 3: Look up the user in the staff database
    let staffUser;

    if (googleEmail === SUPER_ADMIN_EMAIL.toLowerCase()) {
      // Super Admin bootstrap — always elevate as ADMIN, authorized
      staffUser = await ensureSuperAdminUser(googleEmail, googleName);
    } else {
      staffUser = await getUserByEmail(googleEmail);
    }

    // Step 4: If user not in database, register as pending and redirect
    if (!staffUser) {
      await addUser({
        name: googleName,
        email: googleEmail,
        role: null,
        departmentId: null,
        isAuthorized: false,
      });
      const res = NextResponse.redirect(new URL('/pending-approval', frontendUrl));
      res.cookies.delete('ic_access_token');
      res.cookies.delete('ic_refresh_token');
      return res;
    }

    // Step 5: Check suspension
    if (staffUser.isSuspended) {
      const res = NextResponse.redirect(new URL('/denied', frontendUrl));
      res.cookies.delete('ic_access_token');
      res.cookies.delete('ic_refresh_token');
      return res;
    }

    // Step 6: Check authorization
    if (!staffUser.isAuthorized) {
      const res = NextResponse.redirect(new URL('/pending-approval', frontendUrl));
      res.cookies.delete('ic_access_token');
      res.cookies.delete('ic_refresh_token');
      return res;
    }

    // Step 7: Issue JWT session cookies
    const jwtPayload = {
      sub: staffUser.id,
      email: staffUser.email,
      name: staffUser.name,
      role: staffUser.role,
      departmentId: staffUser.departmentId,
      isAuthorized: true,
    };

    const jwtAccess = await createJwtToken(jwtPayload, '7d');
    const jwtRefresh = await createJwtToken({ ...jwtPayload, type: 'refresh' }, '30d');

    const cookieStore = cookies();
    const isProduction = process.env.NODE_ENV === 'production';

    cookieStore.set('ic_access_token', jwtAccess, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60,
    });

    cookieStore.set('ic_refresh_token', jwtRefresh, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60,
    });

    // Step 8: Redirect to role-specific portal
    const targetPortal = getDashboardForRole(staffUser.role);
    return NextResponse.redirect(new URL(targetPortal, frontendUrl));
  } catch (err: any) {
    console.error('Google OAuth callback error:', err);
    return NextResponse.redirect(new URL('/login/staff?error=server_error', frontendUrl));
  }
}
