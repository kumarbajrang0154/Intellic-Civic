import { NextRequest, NextResponse } from 'next/server';
import { captureException } from '@/lib/error-monitoring';
import { checkRateLimit, rateLimitErrorResponse } from '@/lib/rate-limit';
import {
  listPublicCivicComplaints,
  publicApiComplaintsQuerySchema,
  verifyOptionalPublicApiKey,
} from '@/services/public-api-service';

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

    const rateLimit = await checkRateLimit(request, 'general', 'public:v1:complaints');
    if (!rateLimit.success) {
      return rateLimitErrorResponse(rateLimit);
    }

    const { searchParams } = new URL(request.url);
    const parsed = publicApiComplaintsQuerySchema.safeParse({
      status: searchParams.get('status') ?? undefined,
      category: searchParams.get('category') ?? undefined,
      limit: searchParams.get('limit') ?? undefined,
    });
    if (!parsed.success) {
      return NextResponse.json(
        {
          statusCode: 400,
          message: parsed.error.issues[0]?.message || 'Invalid query parameters.',
        },
        { status: 400, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    const items = await listPublicCivicComplaints(parsed.data);
    return NextResponse.json(
      {
        version: 'v1',
        authMode: keyCheck.mode,
        count: items.length,
        items,
      },
      { status: 200, headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error: unknown) {
    captureException(error, { route: 'GET /api/public/v1/complaints' });
    return NextResponse.json(
      { statusCode: 500, message: 'Failed to load public civic complaints feed.' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}

