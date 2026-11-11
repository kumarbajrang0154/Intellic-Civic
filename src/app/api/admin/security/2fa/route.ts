import { NextRequest, NextResponse } from 'next/server';
import { requireStaff } from '@/lib/admin-auth';
import { captureException } from '@/lib/error-monitoring';
import prisma from '@/lib/prisma';
import { checkRateLimit, rateLimitErrorResponse } from '@/lib/rate-limit';
import { isMissingTwoFactorSchemaError } from '@/services/totp-service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireStaff(['SUPER_ADMIN', 'ADMIN']);
    if (!auth.authorized) return auth.response;

    const rateLimit = await checkRateLimit(request, 'general', auth.user.id);
    if (!rateLimit.success) {
      return rateLimitErrorResponse(rateLimit);
    }

    try {
      const record = await prisma.adminTwoFactor.findUnique({
        where: { userId: auth.user.id },
        select: {
          enabled: true,
          verifiedAt: true,
          pendingSecretEncrypted: true,
          recoveryHashes: true,
        },
      });

      return NextResponse.json(
        {
          success: true,
          enabled: Boolean(record?.enabled),
          verifiedAt: record?.verifiedAt ? record.verifiedAt.toISOString() : null,
          remainingRecoveryCodes: record?.recoveryHashes?.length ?? 0,
          hasPendingEnrollment: Boolean(record?.pendingSecretEncrypted),
          migrationPending: false,
        },
        { status: 200, headers: { 'Cache-Control': 'no-store' } },
      );
    } catch (err: unknown) {
      if (isMissingTwoFactorSchemaError(err)) {
        return NextResponse.json(
          {
            success: true,
            enabled: false,
            verifiedAt: null,
            remainingRecoveryCodes: 0,
            hasPendingEnrollment: false,
            migrationPending: true,
          },
          { status: 200, headers: { 'Cache-Control': 'no-store' } },
        );
      }
      throw err;
    }
  } catch (error: unknown) {
    captureException(error, { route: 'GET /api/admin/security/2fa' });
    return NextResponse.json(
      { statusCode: 500, message: 'Unable to load two-factor authentication status.' },
      { status: 500 },
    );
  }
}

