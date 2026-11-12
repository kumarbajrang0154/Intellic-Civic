import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/admin-auth';
import { captureException } from '@/lib/error-monitoring';
import { checkRateLimit, rateLimitErrorResponse } from '@/lib/rate-limit';
import {
  MunicipalityServiceError,
  updateMunicipality,
  updateMunicipalitySchema,
} from '@/services/municipality-service';

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const auth = await requireSuperAdmin();
    if (!auth.authorized) {
      return auth.response;
    }

    const rateLimit = await checkRateLimit(request, 'general', auth.admin.id);
    if (!rateLimit.success) {
      return rateLimitErrorResponse(rateLimit);
    }

    const body = await request.json().catch(() => ({}));
    const parsed = updateMunicipalitySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          statusCode: 400,
          message: parsed.error.issues[0]?.message || 'Invalid municipality update payload.',
        },
        { status: 400, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    const municipality = await updateMunicipality(params.id, parsed.data);
    return NextResponse.json(
      { success: true, municipality },
      { status: 200, headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error: unknown) {
    if (error instanceof MunicipalityServiceError) {
      return NextResponse.json(
        { statusCode: error.statusCode, message: error.message },
        { status: error.statusCode, headers: { 'Cache-Control': 'no-store' } },
      );
    }
    captureException(error, { route: 'PATCH /api/admin/municipalities/[id]' });
    return NextResponse.json(
      { statusCode: 500, message: 'Failed to update municipality.' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}

