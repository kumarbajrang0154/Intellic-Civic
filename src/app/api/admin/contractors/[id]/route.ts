import { NextRequest, NextResponse } from 'next/server';
import { requireStaff } from '@/lib/admin-auth';
import { captureException } from '@/lib/error-monitoring';
import { checkRateLimit, rateLimitErrorResponse } from '@/lib/rate-limit';
import {
  ContractorServiceError,
  updateContractor,
  updateContractorSchema,
} from '@/services/contractor-service';

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const auth = await requireStaff(['ADMIN', 'SUPER_ADMIN', 'DEPARTMENT_HEAD']);
    if (!auth.authorized) {
      return auth.response;
    }

    const rateLimit = await checkRateLimit(request, 'general', auth.user.id);
    if (!rateLimit.success) {
      return rateLimitErrorResponse(rateLimit);
    }

    const body = await request.json().catch(() => ({}));
    const parsed = updateContractorSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          statusCode: 400,
          message: parsed.error.issues[0]?.message || 'Invalid contractor update payload.',
        },
        { status: 400, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    const contractor = await updateContractor(
      params.id,
      {
        id: auth.user.id,
        role: auth.user.role,
        municipalityId: auth.user.municipalityId ?? null,
      },
      parsed.data,
    );

    return NextResponse.json(
      { success: true, contractor },
      { status: 200, headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error: unknown) {
    if (error instanceof ContractorServiceError) {
      return NextResponse.json(
        { statusCode: error.statusCode, message: error.message },
        { status: error.statusCode, headers: { 'Cache-Control': 'no-store' } },
      );
    }
    captureException(error, { route: 'PATCH /api/admin/contractors/[id]' });
    return NextResponse.json(
      { statusCode: 500, message: 'Failed to update contractor.' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}

