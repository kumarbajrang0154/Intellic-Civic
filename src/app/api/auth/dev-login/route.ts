import { NextRequest, NextResponse } from 'next/server';
import { createJwtToken } from '@/lib/auth-jwt';
import { getUser, getUserByEmail } from '@/lib/staff-dept-store';

export function getAllowedDevUserIds(env: Record<string, string | undefined> = process.env): Set<string> {
  const raw = env.DEV_LOGIN_ALLOWED_IDS || '';
  return new Set(
    raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

export function getAllowedDevEmails(env: Record<string, string | undefined> = process.env): Set<string> {
  const raw = env.DEV_LOGIN_ALLOWED_EMAILS || '';
  return new Set(
    raw
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
}

export async function handleDevLoginRequest(
  req: NextRequest,
  deps: {
    getUser?: (id: string) => Promise<any>;
    getUserByEmail?: (email: string) => Promise<any>;
    env?: Record<string, string | undefined>;
  } = {},
) {
  const env = deps.env || process.env;
  const isProduction =
    env.NODE_ENV === 'production' ||
    env.VERCEL_ENV === 'production';

  if (isProduction) {
    return NextResponse.json({ message: 'Not Found' }, { status: 404 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const requestedId = typeof body.id === 'string' ? body.id.trim() : undefined;
    const requestedEmail = typeof body.email === 'string' ? body.email.trim().toLowerCase() : undefined;

    if (!requestedId && !requestedEmail) {
      return NextResponse.json(
        { statusCode: 400, message: 'Both id and email are missing. Either id or email must be provided.' },
        { status: 400 },
      );
    }

    const getUserFn = deps.getUser || getUser;
    const getUserByEmailFn = deps.getUserByEmail || getUserByEmail;

    let targetUser: any = null;

    if (requestedId) {
      targetUser = await getUserFn(requestedId);
    } else if (requestedEmail) {
      targetUser = await getUserByEmailFn(requestedEmail);
    }

    const allowedUserIds = getAllowedDevUserIds(env);
    const allowedEmails = getAllowedDevEmails(env);

    const isAllowedId = Boolean(
      (requestedId && allowedUserIds.has(requestedId)) ||
      (targetUser?.id && allowedUserIds.has(targetUser.id))
    );
    const isAllowedEmail = Boolean(
      (requestedEmail && allowedEmails.has(requestedEmail)) ||
      (targetUser?.email && allowedEmails.has(targetUser.email.toLowerCase()))
    );

    if (!targetUser || (!isAllowedId && !isAllowedEmail)) {
      return NextResponse.json(
        { statusCode: 400, message: 'Invalid or unauthorized dev user ID.' },
        { status: 400 },
      );
    }

    const actualRole = targetUser.role || 'CITIZEN';

    if (body.role && body.role !== actualRole) {
      console.warn(
        `[DEV-LOGIN WARNING] Requested role "${body.role}" ignored for user "${targetUser.id}"; enforced actual DB role "${actualRole}".`,
      );
    }

    console.warn(
      `[DEV-LOGIN WARNING] Dev authentication bypass used for user ID "${targetUser.id}" (${actualRole}) at ${new Date().toISOString()}`,
    );

    const userPayload = {
      sub: targetUser.id,
      email: targetUser.email,
      name: targetUser.name,
      role: actualRole,
      isAuthorized: true,
      departmentId: targetUser.departmentId ?? null,
      municipalityId: targetUser.municipalityId ?? null,
    };

    const accessToken = await createJwtToken(userPayload, '7d');
    const refreshToken = await createJwtToken({ ...userPayload, type: 'refresh' }, '30d');

    let redirectUrl = '/citizen';
    if (actualRole === 'ADMIN' || actualRole === 'SUPER_ADMIN') redirectUrl = '/admin';
    else if (actualRole === 'DEPARTMENT_HEAD') redirectUrl = '/dept-head';
    else if (actualRole === 'DEPARTMENT_OFFICER') redirectUrl = '/officer';
    else if (actualRole === 'FIELD_WORKER') redirectUrl = '/field-worker';

    const response = NextResponse.json({
      success: true,
      user: userPayload,
      redirectUrl,
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
      { statusCode: 500, message: 'Failed to initiate session', error: error.message },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  return handleDevLoginRequest(req);
}
