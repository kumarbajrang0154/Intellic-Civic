import { NextRequest, NextResponse } from 'next/server';
import { requireStaff } from '@/lib/admin-auth';
import { captureException } from '@/lib/error-monitoring';
import { checkRateLimit, rateLimitErrorResponse } from '@/lib/rate-limit';
import {
  assignContractorWorkOrder,
  assignContractorWorkOrderSchema,
  ContractorServiceError,
} from '@/services/contractor-service';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const auth = await requireStaff(['ADMIN', 'SUPER_ADMIN', 'DEPARTMENT_HEAD', 'OFFICER']);
    if (!auth.authorized) {
      return auth.response;
    }

    const rateLimit = await checkRateLimit(request, 'general', auth.user.id);
    if (!rateLimit.success) {
      return rateLimitErrorResponse(rateLimit);
    }

    const body = await request.json().catch(() => ({}));
    const parsed = assignContractorWorkOrderSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          statusCode: 400,
          message: parsed.error.issues[0]?.message || 'Invalid work-order payload.',
        },
        { status: 400, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    const result = await assignContractorWorkOrder(
      params.id,
      {
        id: auth.user.id,
        role: auth.user.role,
        municipalityId: auth.user.municipalityId ?? null,
      },
      parsed.data,
    );

    return NextResponse.json(
      { success: true, ...result },
      { status: 201, headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error: unknown) {
    if (error instanceof ContractorServiceError) {
      return NextResponse.json(
        { statusCode: error.statusCode, message: error.message },
        { status: error.statusCode, headers: { 'Cache-Control': 'no-store' } },
      );
    }
    captureException(error, { route: 'POST /api/admin/complaints/[id]/contractor' });
    return NextResponse.json(
      { statusCode: 500, message: 'Failed to assign contractor work order.' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}

