import { NextRequest, NextResponse } from 'next/server';
import { requireCitizen } from '@/lib/citizen-auth';
import { captureException } from '@/lib/error-monitoring';
import { checkRateLimit, rateLimitErrorResponse } from '@/lib/rate-limit';
import {
  getAreaStatusCounts,
  getCitizenOwnStatusPins,
  liveStatusMapQuerySchema,
} from '@/services/live-status-map-service';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireCitizen();
    if (!auth.authorized) {
      return auth.response;
    }

    const rateLimit = await checkRateLimit(request, 'general', auth.user.id);
    if (!rateLimit.success) {
      return rateLimitErrorResponse(rateLimit);
    }

    const { searchParams } = new URL(request.url);
    const rawParams = Object.fromEntries(searchParams.entries());
    const parsed = liveStatusMapQuerySchema.safeParse(rawParams);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Invalid query parameters',
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const [own, areas] = await Promise.all([
      getCitizenOwnStatusPins(auth.user.id, { status: parsed.data.status }),
      getAreaStatusCounts(),
    ]);

    return NextResponse.json(
      {
        success: true,
        own,
        areas,
      },
      {
        status: 200,
        headers: { 'Cache-Control': 'no-store' },
      },
    );
  } catch (error) {
    captureException(error, { route: 'GET /api/citizen/live-status-map' });
    return NextResponse.json(
      { error: 'Failed to load citizen live status map' },
      { status: 500 },
    );
  }
}
