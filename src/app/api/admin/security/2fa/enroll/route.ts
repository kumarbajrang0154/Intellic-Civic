import { NextRequest, NextResponse } from 'next/server';
import { requireStaff } from '@/lib/admin-auth';
import { captureException } from '@/lib/error-monitoring';
import prisma from '@/lib/prisma';
import { checkRateLimit, rateLimitErrorResponse } from '@/lib/rate-limit';
import { generateTotpSetup, isMissingTwoFactorSchemaError } from '@/services/totp-service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireStaff(['SUPER_ADMIN', 'ADMIN']);
    if (!auth.authorized) return auth.response;

    const rateLimit = await checkRateLimit(request, 'auth', `2fa-enroll:${auth.user.id}`);
    if (!rateLimit.success) {
      return rateLimitErrorResponse(rateLimit);
    }

    const accountLabel = auth.user.email || auth.user.name || auth.user.id;
    const setup = await generateTotpSetup(accountLabel);

    try {
      await prisma.adminTwoFactor.upsert({
        where: { userId: auth.user.id },
        create: {
          userId: auth.user.id,
          enabled: false,
          pendingSecretEncrypted: setup.encryptedSecret,
        },
        update: {
          pendingSecretEncrypted: setup.encryptedSecret,
        },
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

    return NextResponse.json(
      {
        success: true,
        secretBase32: setup.secretBase32,
        otpauthUri: setup.otpauthUri,
        qrDataUrl: setup.qrDataUrl,
      },
      { status: 200, headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error: unknown) {
    captureException(error, { route: 'POST /api/admin/security/2fa/enroll' });
    return NextResponse.json(
      { statusCode: 500, message: 'Unable to initialize two-factor enrollment.' },
      { status: 500 },
    );
  }
}

