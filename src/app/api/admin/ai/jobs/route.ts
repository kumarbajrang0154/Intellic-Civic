import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { captureException } from '@/lib/error-monitoring';
import { checkRateLimit, rateLimitErrorResponse } from '@/lib/rate-limit';
import {
  listAiJobs,
  processPendingAiJobs,
  triggerAiJobsSchema,
} from '@/services/ai-job-service';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

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

    const { searchParams } = new URL(request.url);
    const limit = Number(searchParams.get('limit') || '30');
    const result = await listAiJobs(Number.isFinite(limit) ? limit : 30);

    return NextResponse.json(
      { success: true, ...result },
      { status: 200, headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error: unknown) {
    captureException(error, { route: 'GET /api/admin/ai/jobs' });
    return NextResponse.json(
      { statusCode: 500, message: 'Failed to load AI processing jobs.' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (!auth.authorized) {
      return auth.response;
    }

    const rateLimit = await checkRateLimit(request, 'ai', auth.admin.id);
    if (!rateLimit.success) {
      return rateLimitErrorResponse(rateLimit);
    }

    const body = await request.json().catch(() => ({}));
    const parsed = triggerAiJobsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { statusCode: 400, message: 'Invalid batchSize parameter.' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    const summary = await processPendingAiJobs({ batchSize: parsed.data.batchSize });
    return NextResponse.json(
      { success: true, ...summary },
      { status: 200, headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error: unknown) {
    captureException(error, { route: 'POST /api/admin/ai/jobs' });
    return NextResponse.json(
      { statusCode: 500, message: 'Failed to execute AI job batch.' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}

