import { NextRequest, NextResponse } from 'next/server';
import { requireStaff } from '@/lib/admin-auth';
import { addAuditLog } from '@/lib/audit-store';
import { captureException } from '@/lib/error-monitoring';
import prisma from '@/lib/prisma';
import { checkRateLimit, rateLimitErrorResponse } from '@/lib/rate-limit';
import {
  consumeRecoveryCode,
  decryptTotpSecret,
  isMissingTwoFactorSchemaError,
  totpChallengeSchema,
  verifyTotpCode,
} from '@/services/totp-service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireStaff(['SUPER_ADMIN', 'ADMIN']);
    if (!auth.authorized) return auth.response;

    const rateLimit = await checkRateLimit(request, 'auth', `2fa-disable:${auth.user.id}`);
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

    try {
      const result = await prisma.$transaction(async (tx) => {
        const record = await tx.adminTwoFactor.findUnique({
          where: { userId: auth.user.id },
          select: {
            id: true,
            enabled: true,
            secretEncrypted: true,
            recoveryHashes: true,
          },
        });

        if (!record?.enabled || !record.secretEncrypted) {
          return { ok: false as const, status: 400, message: 'Two-factor authentication is not enabled.' };
        }

        let verified = false;
        if (parsed.data.useRecoveryCode) {
          const consumed = await consumeRecoveryCode(parsed.data.code, record.recoveryHashes);
          verified = consumed.valid;
        } else {
          const secret = decryptTotpSecret(record.secretEncrypted);
          verified = verifyTotpCode(secret, parsed.data.code);
        }

        if (!verified) {
          return { ok: false as const, status: 401, message: 'Invalid verification code.' };
        }

        await tx.adminTwoFactor.update({
          where: { id: record.id },
          data: {
            enabled: false,
            secretEncrypted: null,
            pendingSecretEncrypted: null,
            verifiedAt: null,
            recoveryHashes: [],
          },
        });

        return { ok: true as const };
      });

      if (!result.ok) {
        return NextResponse.json(
          { statusCode: result.status, message: result.message },
          { status: result.status },
        );
      }

      await addAuditLog({
        actorId: auth.user.id,
        actorName: auth.user.name,
        action: 'ADMIN_2FA_DISABLED',
        entityType: 'AdminTwoFactor',
        targetId: auth.user.id,
        targetName: auth.user.name,
        metadata: {
          role: auth.user.role,
          method: parsed.data.useRecoveryCode ? 'recovery_code' : 'totp',
        },
      });

      return NextResponse.json(
        { success: true, enabled: false },
        { status: 200, headers: { 'Cache-Control': 'no-store' } },
      );
    } catch (err: unknown) {
      if (isMissingTwoFactorSchemaError(err)) {
        return NextResponse.json(
          { statusCode: 503, message: 'Two-factor authentication database migration is pending.' },
          { status: 503 },
        );
      }
      throw err;
    }
  } catch (error: unknown) {
    captureException(error, { route: 'POST /api/admin/security/2fa/disable' });
    return NextResponse.json(
      { statusCode: 500, message: 'Unable to disable two-factor authentication.' },
      { status: 500 },
    );
  }
}

