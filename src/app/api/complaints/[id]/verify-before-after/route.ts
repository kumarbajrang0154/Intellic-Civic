import { NextRequest, NextResponse } from 'next/server';
import { requireStaff } from '@/lib/admin-auth';
import { captureException } from '@/lib/error-monitoring';
import { checkRateLimit, rateLimitErrorResponse } from '@/lib/rate-limit';
import {
  beforeAfterVerifyRequestSchema,
  BeforeAfterVerificationError,
  verifyComplaintBeforeAfterPhotos,
} from '@/services/before-after-verification-service';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const auth = await requireStaff(['ADMIN', 'SUPER_ADMIN', 'DEPARTMENT_HEAD', 'OFFICER']);
    if (!auth.authorized) {
      return auth.response;
    }

    const rateLimit = await checkRateLimit(request, 'ai', auth.user.id);
    if (!rateLimit.success) {
      return rateLimitErrorResponse(rateLimit);
    }

    const body = await request.json().catch(() => ({}));
    const parsed = beforeAfterVerifyRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          statusCode: 400,
          message: parsed.error.issues[0]?.message || 'Invalid verification payload.',
        },
        { status: 400, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    const result = await verifyComplaintBeforeAfterPhotos(params.id, auth.user, {
      beforeEvidenceId: parsed.data.beforeEvidenceId,
      afterEvidenceId: parsed.data.afterEvidenceId,
    });

    return NextResponse.json(result, {
      status: 200,
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error: unknown) {
    if (error instanceof BeforeAfterVerificationError) {
      return NextResponse.json(
        { statusCode: error.statusCode, message: error.message },
        { status: error.statusCode, headers: { 'Cache-Control': 'no-store' } },
      );
    }
    captureException(error, { route: 'POST /api/complaints/[id]/verify-before-after' });
    return NextResponse.json(
      { statusCode: 500, message: 'Failed to verify before/after evidence photos.' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}

