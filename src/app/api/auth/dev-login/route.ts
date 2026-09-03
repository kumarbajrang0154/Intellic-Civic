import { NextRequest, NextResponse } from 'next/server';
import { createJwtToken } from '@/lib/auth-jwt';
import { getUser, getUserByEmail } from '@/lib/staff-dept-store';

const ALLOWED_DEV_USER_IDS = new Set([
  'usr_super_admin',
  'usr_dept_head_roads',
  'usr_officer_roads_1',
  'fw-demo-1',
  'citizen_9876543210',
  'd86d46dc-0d8b-4726-a151-bd7ab4e13ead',
]);

const ALLOWED_DEV_EMAILS = new Set([
  'kumarbajrang325@gmail.com',
  'head.roads@smartcity.gov.in',
  'officer.roads@smartcity.gov.in',
  'fieldworker@intellicivic.gov.in',
  'kumarbajrang0154@gmail.com',
]);

export async function POST(req: NextRequest) {
  const isDevMode = process.env.NODE_ENV !== 'production';
  const isDevLoginEnabled = process.env.ENABLE_DEV_LOGIN === 'true';

  if (!isDevMode || !isDevLoginEnabled) {
    return NextResponse.json({ message: 'Not Found' }, { status: 404 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const requestedId = typeof body.id === 'string' ? body.id.trim() : undefined;
    const requestedEmail = typeof body.email === 'string' ? body.email.trim().toLowerCase() : undefined;

    let targetUser: any = null;

    if (requestedId) {
      targetUser = await getUser(requestedId);
      if (!targetUser && requestedId === 'usr_super_admin') {
        targetUser = await getUserByEmail('kumarbajrang325@gmail.com');
      }
    } else if (requestedEmail) {
      targetUser = await getUserByEmail(requestedEmail);
    } else {
      targetUser = (await getUser('usr_super_admin')) || (await getUserByEmail('kumarbajrang325@gmail.com'));
    }

    const isAllowedId = targetUser && ALLOWED_DEV_USER_IDS.has(targetUser.id);
    const isAllowedEmail = targetUser?.email && ALLOWED_DEV_EMAILS.has(targetUser.email.toLowerCase());

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
    };

    const accessToken = await createJwtToken(userPayload, '7d');
    const refreshToken = await createJwtToken({ ...userPayload, type: 'refresh' }, '30d');

    const isProduction = process.env.NODE_ENV === 'production';

    let redirectUrl = '/citizen';
    if (actualRole === 'ADMIN') redirectUrl = '/admin';
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
