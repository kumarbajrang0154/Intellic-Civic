import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, rateLimitErrorResponse } from '@/lib/rate-limit';
import { buildPublicOpenApiSpec } from '@/services/public-api-service';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const rateLimit = await checkRateLimit(request, 'general', 'public:v1:openapi');
  if (!rateLimit.success) {
    return rateLimitErrorResponse(rateLimit);
  }

  const origin = request.nextUrl?.origin || 'https://smartaicity.vercel.app';
  return NextResponse.json(buildPublicOpenApiSpec(origin), {
    status: 200,
    headers: { 'Cache-Control': 'public, max-age=300' },
  });
}

