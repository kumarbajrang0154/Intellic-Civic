import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, requireSuperAdmin } from '@/lib/admin-auth';
import { captureException } from '@/lib/error-monitoring';
import { checkRateLimit, rateLimitErrorResponse } from '@/lib/rate-limit';
import {
  createMunicipalitySchema,
  listMunicipalities,
  MunicipalityServiceError,
  onboardMunicipality,
} from '@/services/municipality-service';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (!auth.authorized) {
      return auth.response;
    }

    const rateLimit = await checkRateLimit(request, 'general', auth.admin.id);
    if (!rateLimit.success) {
      return rateLimitErrorResponse(rateLimit);
    }

    const items = await listMunicipalities({
      role: auth.admin.role,
      municipalityId: auth.admin.municipalityId ?? null,
    });

    return NextResponse.json(
      { success: true, items },
      { status: 200, headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error: unknown) {
    captureException(error, { route: 'GET /api/admin/municipalities' });
    return NextResponse.json(
      { statusCode: 500, message: 'Failed to load municipalities.' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}

export async function POST(request: NextRequest) {
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
    const parsed = createMunicipalitySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          statusCode: 400,
          message: parsed.error.issues[0]?.message || 'Invalid municipality payload.',
        },
        { status: 400, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    const created = await onboardMunicipality(parsed.data);
    return NextResponse.json(
      { success: true, ...created },
      { status: 201, headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error: unknown) {
    if (error instanceof MunicipalityServiceError) {
      return NextResponse.json(
        { statusCode: error.statusCode, message: error.message },
        { status: error.statusCode, headers: { 'Cache-Control': 'no-store' } },
      );
    }
    captureException(error, { route: 'POST /api/admin/municipalities' });
    return NextResponse.json(
      { statusCode: 500, message: 'Failed to onboard municipality.' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}

