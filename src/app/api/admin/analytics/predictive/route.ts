import { NextRequest, NextResponse } from 'next/server';
import { requireStaff } from '@/lib/admin-auth';
import { captureException } from '@/lib/error-monitoring';
import { checkRateLimit, rateLimitErrorResponse } from '@/lib/rate-limit';
import {
  getPredictiveAnalytics,
  predictiveQuerySchema,
} from '@/services/predictive-analytics-service';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireStaff(['ADMIN', 'SUPER_ADMIN', 'DEPARTMENT_HEAD']);
    if (!auth.authorized) {
      return auth.response;
    }

    const rateLimit = await checkRateLimit(request, 'general', auth.user.id);
    if (!rateLimit.success) {
      return rateLimitErrorResponse(rateLimit);
    }

    const { searchParams } = new URL(request.url);
    const parsed = predictiveQuerySchema.safeParse({
      lookbackDays: searchParams.get('lookbackDays') ?? undefined,
      horizonDays: searchParams.get('horizonDays') ?? undefined,
      limit: searchParams.get('limit') ?? undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        {
          statusCode: 400,
          message: parsed.error.issues[0]?.message || 'Invalid analytics parameters.',
        },
        { status: 400, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    const report = await getPredictiveAnalytics({
      municipalityId:
        auth.user.role === 'SUPER_ADMIN' ? undefined : auth.user.municipalityId ?? undefined,
      departmentId:
        auth.user.role === 'DEPARTMENT_HEAD' ? auth.user.departmentId ?? undefined : undefined,
      lookbackDays: parsed.data.lookbackDays,
      horizonDays: parsed.data.horizonDays,
      limit: parsed.data.limit,
    });

    return NextResponse.json(
      { success: true, ...report },
      { status: 200, headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error: unknown) {
    captureException(error, { route: 'GET /api/admin/analytics/predictive' });
    return NextResponse.json(
      { statusCode: 500, message: 'Failed to generate predictive ward analytics.' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}

