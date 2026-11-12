import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireSuperAdmin } from '@/lib/admin-auth';
import { captureException } from '@/lib/error-monitoring';
import { checkRateLimit, rateLimitErrorResponse } from '@/lib/rate-limit';
import { runSlaEscalationJob } from '@/services/sla-service';

export const dynamic = 'force-dynamic';

const runSlaBodySchema = z.object({}).strict();

export async function POST(request: NextRequest) {
  try {
    const auth = await requireSuperAdmin();
    if (!auth.authorized) {
      return auth.response;
    }

    const rateLimit = await checkRateLimit(request, 'general', auth.admin.id);
    if (!rateLimit.success) {
      return rateLimitErrorResponse(rateLimit);
    }

    const rawBody = await request.text();
    if (rawBody.trim().length > 0) {
      let json: unknown;
      try {
        json = JSON.parse(rawBody);
      } catch {
        return NextResponse.json({ error: 'Invalid JSON request body' }, { status: 400 });
      }
      const parsed = runSlaBodySchema.safeParse(json);
      if (!parsed.success) {
        return NextResponse.json(
          {
            error: 'Invalid request payload',
            details: parsed.error.flatten().fieldErrors,
          },
          { status: 400 },
        );
      }
    }

    const summary = await runSlaEscalationJob();
    return NextResponse.json(
      {
        success: true,
        ...summary,
      },
      { status: 200 },
    );
  } catch (error) {
    captureException(error, { route: 'POST /api/admin/sla/run' });
    return NextResponse.json(
      { error: 'Failed to run SLA escalation check' },
      { status: 500 },
    );
  }
}
