import { NextRequest, NextResponse } from 'next/server';
import { requireStaff } from '@/lib/admin-auth';
import { addAuditLog } from '@/lib/audit-store';
import { captureException } from '@/lib/error-monitoring';
import prisma from '@/lib/prisma';
import { checkRateLimit, rateLimitErrorResponse } from '@/lib/rate-limit';
import {
  decryptTotpSecret,
  generateRecoveryCodes,
  isMissingTwoFactorSchemaError,
  totpVerifyTokenSchema,
  verifyTotpCode,
} from '@/services/totp-service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireStaff(['SUPER_ADMIN', 'ADMIN']);
    if (!auth.authorized) return auth.response;

    const rateLimit = await checkRateLimit(request, 'auth', `2fa-verify:${auth.user.id}`);
    if (!rateLimit.success) {
      return rateLimitErrorResponse(rateLimit);
    }

    const body = await request.json().catch(() => null);
    const parsed = totpVerifyTokenSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { statusCode: 400, message: parsed.error.issues[0]?.message || 'Invalid verification code.' },
        { status: 400 },
      );
    }

    let record;
    try {
      record = await prisma.adminTwoFactor.findUnique({
        where: { userId: auth.user.id },
        select: { id: true, pendingSecretEncrypted: true },
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

    if (!record?.pendingSecretEncrypted) {
      return NextResponse.json(
        { statusCode: 400, message: 'Start two-factor setup before verifying a code.' },
        { status: 400 },
      );
    }

    const pendingSecret = decryptTotpSecret(record.pendingSecretEncrypted);
    const isCodeValid = verifyTotpCode(pendingSecret, parsed.data.code);
    if (!isCodeValid) {
      return NextResponse.json(
        { statusCode: 401, message: 'Invalid or expired authenticator code.' },
        { status: 401 },
      );
    }

    const { codes: recoveryCodes, hashes } = await generateRecoveryCodes();
    const verifiedAt = new Date();

    await prisma.adminTwoFactor.update({
      where: { id: record.id },
      data: {
        enabled: true,
        secretEncrypted: record.pendingSecretEncrypted,
        pendingSecretEncrypted: null,
        verifiedAt,
        recoveryHashes: hashes,
      },
    });

    await addAuditLog({
      actorId: auth.user.id,
      actorName: auth.user.name,
      action: 'ADMIN_2FA_ENABLED',
      entityType: 'AdminTwoFactor',
      targetId: auth.user.id,
      targetName: auth.user.name,
      metadata: {
        role: auth.user.role,
        recoveryCodeCount: recoveryCodes.length,
      },
    });

    return NextResponse.json(
      {
        success: true,
        enabled: true,
        verifiedAt: verifiedAt.toISOString(),
        recoveryCodes,
      },
      { status: 200, headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error: unknown) {
    captureException(error, { route: 'POST /api/admin/security/2fa/verify' });
    return NextResponse.json(
      { statusCode: 500, message: 'Unable to activate two-factor authentication.' },
      { status: 500 },
    );
  }
}

