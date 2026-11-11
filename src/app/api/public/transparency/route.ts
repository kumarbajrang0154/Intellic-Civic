import { NextRequest, NextResponse } from 'next/server';
import { captureException } from '@/lib/error-monitoring';
import { checkRateLimit, rateLimitErrorResponse } from '@/lib/rate-limit';
import {
  getPublicTransparencySummary,
  transparencyQuerySchema,
} from '@/services/transparency-service';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const rateLimit = await checkRateLimit(request, 'general');
    if (!rateLimit.success) {
      return rateLimitErrorResponse(rateLimit);
    }

    const { searchParams } = new URL(request.url);
    const rawParams = {
      departmentId: searchParams.get('departmentId') ?? undefined,
      ward: searchParams.get('ward') ?? undefined,
    };

    const parsed = transparencyQuerySchema.safeParse(rawParams);
    if (!parsed.success) {
      return NextResponse.json(
        {
          statusCode: 400,
          message: parsed.error.issues[0]?.message || 'Invalid query parameters.',
        },
        { status: 400 },
      );
    }

    const report = await getPublicTransparencySummary({
      departmentId: parsed.data.departmentId,
      ward: parsed.data.ward,
    });

    return NextResponse.json(
      { success: true, data: report },
      {
        status: 200,
        headers: {
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
        },
      },
    );
  } catch (error: unknown) {
    captureException(error, { route: 'GET /api/public/transparency' });
    return NextResponse.json(
      { statusCode: 500, message: 'Unable to load public transparency metrics.' },
      { status: 500 },
    );
  }
}

