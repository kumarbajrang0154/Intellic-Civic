import { NextRequest, NextResponse } from 'next/server';
import { requireStaff } from '@/lib/admin-auth';
import { captureException } from '@/lib/error-monitoring';
import { checkRateLimit, rateLimitErrorResponse } from '@/lib/rate-limit';
import {
  ContractorServiceError,
  createContractor,
  createContractorSchema,
  listContractors,
} from '@/services/contractor-service';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireStaff(['ADMIN', 'SUPER_ADMIN', 'DEPARTMENT_HEAD', 'OFFICER']);
    if (!auth.authorized) {
      return auth.response;
    }

    const rateLimit = await checkRateLimit(request, 'general', auth.user.id);
    if (!rateLimit.success) {
      return rateLimitErrorResponse(rateLimit);
    }

    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get('activeOnly') === 'true';
    const departmentId = searchParams.get('departmentId') ?? undefined;

    const result = await listContractors(
      {
        id: auth.user.id,
        role: auth.user.role,
        municipalityId: auth.user.municipalityId ?? null,
      },
      { activeOnly, departmentId },
    );

    return NextResponse.json(
      { success: true, ...result },
      { status: 200, headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error: unknown) {
    captureException(error, { route: 'GET /api/admin/contractors' });
    return NextResponse.json(
      { statusCode: 500, message: 'Failed to load contractors.' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}

export async function POST(request: NextRequest) {
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
    const parsed = createContractorSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          statusCode: 400,
          message: parsed.error.issues[0]?.message || 'Invalid contractor payload.',
        },
        { status: 400, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    const contractor = await createContractor(
      {
        id: auth.user.id,
        role: auth.user.role,
        municipalityId: auth.user.municipalityId ?? null,
      },
      parsed.data,
    );

    return NextResponse.json(
      { success: true, contractor },
      { status: 201, headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error: unknown) {
    if (error instanceof ContractorServiceError) {
      return NextResponse.json(
        { statusCode: error.statusCode, message: error.message },
        { status: error.statusCode, headers: { 'Cache-Control': 'no-store' } },
      );
    }
    captureException(error, { route: 'POST /api/admin/contractors' });
    return NextResponse.json(
      { statusCode: 500, message: 'Failed to create contractor.' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}

