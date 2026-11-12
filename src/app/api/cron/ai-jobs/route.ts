import { NextRequest, NextResponse } from 'next/server';
import { captureException } from '@/lib/error-monitoring';
import { checkRateLimit, rateLimitErrorResponse } from '@/lib/rate-limit';
import { verifyCronSecret } from '@/services/sla-service';
import { processPendingAiJobs } from '@/services/ai-job-service';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function extractCronSecret(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization');
  if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
    return authHeader.slice(7).trim();
  }
  const customHeader = request.headers.get('x-cron-secret');
  return customHeader ? customHeader.trim() : null;
}

async function handleCron(request: NextRequest): Promise<NextResponse> {
  const expectedSecret = process.env.CRON_SECRET;
  const providedSecret = extractCronSecret(request);

  if (!verifyCronSecret(providedSecret, expectedSecret)) {
    return NextResponse.json({ statusCode: 401, message: 'Unauthorized' }, { status: 401 });
  }

  const rateLimit = await checkRateLimit(request, 'general', 'cron:ai-jobs');
  if (!rateLimit.success) {
    return rateLimitErrorResponse(rateLimit);
  }

  try {
    const summary = await processPendingAiJobs({ batchSize: 10 });
    return NextResponse.json({ success: true, ...summary }, { status: 200 });
  } catch (error) {
    captureException(error, { route: 'cron/ai-jobs' });
    return NextResponse.json({ statusCode: 500, message: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return handleCron(request);
}

export async function POST(request: NextRequest) {
  return handleCron(request);
}

