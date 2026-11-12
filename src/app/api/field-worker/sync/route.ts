import { NextRequest, NextResponse } from 'next/server';
import { requireStaff } from '@/lib/admin-auth';
import { captureException } from '@/lib/error-monitoring';
import { checkRateLimit, rateLimitErrorResponse } from '@/lib/rate-limit';
import {
  fieldWorkerBatchSyncSchema,
  processFieldWorkerOfflineBatch,
} from '@/services/field-worker-sync-service';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireStaff(['FIELD_WORKER']);
    if (!auth.authorized) {
      return auth.response;
    }

    const rateLimit = await checkRateLimit(request, 'upload', auth.user.id);
    if (!rateLimit.success) {
      return rateLimitErrorResponse(rateLimit);
    }

    const body = await request.json().catch(() => ({}));
    const parsed = fieldWorkerBatchSyncSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          statusCode: 400,
          message: parsed.error.issues[0]?.message || 'Invalid offline sync batch payload.',
        },
        { status: 400, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    const summary = await processFieldWorkerOfflineBatch(parsed.data.actions, {
      id: auth.user.id,
      name: auth.user.name,
    });

    return NextResponse.json(
      { success: true, ...summary },
      { status: 200, headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error: unknown) {
    captureException(error, { route: 'POST /api/field-worker/sync' });
    return NextResponse.json(
      { statusCode: 500, message: 'Failed to sync offline field actions.' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}

