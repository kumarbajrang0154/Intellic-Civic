import { NextRequest, NextResponse } from 'next/server';
import { addAuditLog } from '@/lib/audit-store';
import {
  TWO_FACTOR_CHALLENGE_COOKIE,
} from '@/lib/admin-2fa-gate';
import { createJwtToken, verifyJwtToken } from '@/lib/auth-jwt';
import { captureException } from '@/lib/error-monitoring';
import { getPortalRouteForRole } from '@/lib/portal-routes';
import prisma from '@/lib/prisma';
import { checkRateLimit, rateLimitErrorResponse } from '@/lib/rate-limit';
import {
  consumeRecoveryCode,
  decryptTotpSecret,
  isAdminTwoFactorEligibleRole,
  isMissingTwoFactorSchemaError,
  totpChallengeSchema,
  verifyTotpCode,
} from '@/services/totp-service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const challengeToken = request.cookies.get(TWO_FACTOR_CHALLENGE_COOKIE)?.value;
    if (!challengeToken) {
      return NextResponse.json(
        { statusCode: 401, message: 'Two-factor verification session expired. Please sign in again.' },
        { status: 401 },
      );
    }

    const challenge = await verifyJwtToken(challengeToken);
    if (!challenge || challenge.type !== '2fa_challenge' || typeof challenge.sub !== 'string') {
      return NextResponse.json(
        { statusCode: 401, message: 'Invalid or expired two-factor session. Please sign in again.' },
        { status: 401 },
      );
    }

    const rateLimit = await checkRateLimit(request, 'auth', `2fa-login:${challenge.sub}`);
    if (!rateLimit.success) {
      return rateLimitErrorResponse(rateLimit);
    }

    const body = await request.json().catch(() => null);
    const parsed = totpChallengeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { statusCode: 400, message: parsed.error.issues[0]?.message || 'Verification code is required.' },
        { status: 400 },
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: challenge.sub },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        departmentId: true,
        municipalityId: true,
        isAuthorized: true,
        isSuspended: true,
        deletedAt: true,
      },
    });

    if (
      !user ||
      user.isSuspended ||
      user.deletedAt !== null ||
      !user.isAuthorized ||
      !isAdminTwoFactorEligibleRole(user.role)
    ) {
      return NextResponse.json(
        { statusCode: 401, message: 'Unauthorized staff account.' },
        { status: 401 },
      );
    }

    let verifiedResult: { ok: boolean; status?: number; message?: string; remainingCodes?: number };
    try {
      verifiedResult = await prisma.$transaction(async (tx) => {
        const record = await tx.adminTwoFactor.findUnique({
          where: { userId: user.id },
          select: {
            id: true,
            enabled: true,
            secretEncrypted: true,
            recoveryHashes: true,
          },
        });

        if (!record?.enabled || !record.secretEncrypted) {
          return { ok: false, status: 401, message: 'Two-factor authentication is not active.' };
        }

        if (parsed.data.useRecoveryCode) {
          const consumed = await consumeRecoveryCode(parsed.data.code, record.recoveryHashes);
          if (!consumed.valid) {
            return { ok: false, status: 401, message: 'Invalid or already used recovery code.' };
          }
          await tx.adminTwoFactor.update({
            where: { id: record.id },
            data: { recoveryHashes: consumed.remainingHashes },
          });
          return { ok: true, remainingCodes: consumed.remainingHashes.length };
        }

        const secret = decryptTotpSecret(record.secretEncrypted);
        const isValid = verifyTotpCode(secret, parsed.data.code);
        if (!isValid) {
          return { ok: false, status: 401, message: 'Invalid or expired verification code.' };
        }

        return { ok: true, remainingCodes: record.recoveryHashes.length };
      });
    } catch (err: unknown) {
      if (isMissingTwoFactorSchemaError(err)) {
        return NextResponse.json(
          { statusCode: 503, message: 'Two-factor authentication database migration is pending.' },
          { status: 503 },
        );
      }
      throw err;
    }

    if (!verifiedResult.ok) {
      return NextResponse.json(
        { statusCode: verifiedResult.status || 401, message: verifiedResult.message || 'Invalid verification code.' },
        { status: verifiedResult.status || 401 },
      );
    }

    const userPayload = {
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      departmentId: user.departmentId,
      municipalityId: user.municipalityId,
      isAuthorized: true,
    };

    const accessToken = await createJwtToken(userPayload, '7d');
    const refreshToken = await createJwtToken({ ...userPayload, type: 'refresh' }, '30d');
    const targetPortal = getPortalRouteForRole(user.role);
    const isProduction = process.env.NODE_ENV === 'production';

    await addAuditLog({
      actorId: user.id,
      actorName: user.name,
      action: 'ADMIN_2FA_LOGIN_VERIFIED',
      entityType: 'AdminTwoFactor',
      targetId: user.id,
      targetName: user.name,
      metadata: {
        role: user.role,
        method: parsed.data.useRecoveryCode ? 'recovery_code' : 'totp',
        remainingRecoveryCodes: verifiedResult.remainingCodes ?? 0,
      },
    });

    const response = NextResponse.json(
      {
        success: true,
        role: user.role,
        redirectUrl: targetPortal,
        redirectPath: targetPortal,
        remainingRecoveryCodes: verifiedResult.remainingCodes,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          departmentId: user.departmentId,
        },
      },
      { status: 200, headers: { 'Cache-Control': 'no-store' } },
    );

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

    response.cookies.set(TWO_FACTOR_CHALLENGE_COOKIE, '', {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    });

    return response;
  } catch (error: unknown) {
    captureException(error, { route: 'POST /api/auth/staff-2fa' });
    return NextResponse.json(
      { statusCode: 500, message: 'Unable to complete two-factor verification.' },
      { status: 500 },
    );
  }
}
