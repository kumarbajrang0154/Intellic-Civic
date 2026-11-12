import { NextRequest, NextResponse } from 'next/server';
import { captureException } from '@/lib/error-monitoring';
import { checkRateLimit, rateLimitErrorResponse } from '@/lib/rate-limit';
import { verifyOptionalPublicApiKey } from '@/services/public-api-service';
import { getPublicTransparencySummary } from '@/services/transparency-service';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const keyCheck = verifyOptionalPublicApiKey(request.headers.get('x-api-key'));
    if (!keyCheck.authorized) {
      return NextResponse.json(
        { statusCode: 401, message: 'Valid X-API-Key header required.' },
        { status: 401, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    const rateLimit = await checkRateLimit(request, 'general', 'public:v1:stats');
    if (!rateLimit.success) {
      return rateLimitErrorResponse(rateLimit);
    }

    const stats = await getPublicTransparencySummary({});
    return NextResponse.json(
      {
        version: 'v1',
        authMode: keyCheck.mode,
        ...stats,
      },
      { status: 200, headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error: unknown) {
    captureException(error, { route: 'GET /api/public/v1/stats' });
    return NextResponse.json(
      { statusCode: 500, message: 'Failed to load public statistics.' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
