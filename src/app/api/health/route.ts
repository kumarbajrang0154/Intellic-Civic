import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, rateLimitErrorResponse } from '@/lib/rate-limit';
import { checkSystemHealth } from '@/services/health-service';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const rateLimit = await checkRateLimit(request, 'general', 'public:health');
  if (!rateLimit.success) {
    return rateLimitErrorResponse(rateLimit);
  }

  const report = await checkSystemHealth();
  return NextResponse.json(report, {
    status: report.ok ? 200 : 503,
    headers: { 'Cache-Control': 'no-store' },
  });
}

