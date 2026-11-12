import { NextRequest, NextResponse } from 'next/server';
import { requireStaff } from '@/lib/admin-auth';
import { captureException } from '@/lib/error-monitoring';
import { checkRateLimit, rateLimitErrorResponse } from '@/lib/rate-limit';
import {
  getFieldWorkerPlannedRoute,
  routePlanQuerySchema,
} from '@/services/route-planning-service';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireStaff(['FIELD_WORKER']);
    if (!auth.authorized) {
      return auth.response;
    }

    const rateLimit = await checkRateLimit(request, 'general', auth.user.id);
    if (!rateLimit.success) {
      return rateLimitErrorResponse(rateLimit);
    }

    const { searchParams } = new URL(request.url);
    const parsed = routePlanQuerySchema.safeParse({
      startLat: searchParams.get('startLat') ?? undefined,
      startLng: searchParams.get('startLng') ?? undefined,
      mode: searchParams.get('mode') ?? undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        {
          statusCode: 400,
          message: parsed.error.issues[0]?.message || 'Invalid route query parameters.',
        },
        { status: 400, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    const route = await getFieldWorkerPlannedRoute(auth.user.id, parsed.data);
    return NextResponse.json(
      { success: true, ...route },
      { status: 200, headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error: unknown) {
    captureException(error, { route: 'GET /api/field-worker/route-plan' });
    return NextResponse.json(
      { statusCode: 500, message: 'Failed to generate field worker route plan.' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}

