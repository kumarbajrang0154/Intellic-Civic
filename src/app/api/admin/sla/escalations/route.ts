import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireStaff } from '@/lib/admin-auth';
import { captureException } from '@/lib/error-monitoring';
import { checkRateLimit, rateLimitErrorResponse } from '@/lib/rate-limit';
import {
  listEscalatedComplaints,
  SLA_ESCALATION_ALLOWED_ROLES,
} from '@/services/sla-service';

export const dynamic = 'force-dynamic';

const escalationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(10_000).optional(),
  limit: z.coerce.number().int().min(1).max(10_000).optional(),
});

function nonEmptyParam(value: string | null): string | undefined {
  if (value === null) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireStaff([...SLA_ESCALATION_ALLOWED_ROLES]);
    if (!auth.authorized) {
      return auth.response;
    }

    const rateLimit = await checkRateLimit(request, 'general', auth.user.id);
    if (!rateLimit.success) {
      return rateLimitErrorResponse(rateLimit);
    }

    const { searchParams } = new URL(request.url);
    const parsed = escalationQuerySchema.safeParse({
      page: nonEmptyParam(searchParams.get('page')),
      limit: nonEmptyParam(searchParams.get('limit')),
    });

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Invalid pagination query parameters',
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const result = await listEscalatedComplaints(
      {
        role: auth.user.role,
        departmentId: auth.user.departmentId,
      },
      {
        page: parsed.data.page,
        limit: parsed.data.limit,
      },
    );

    return NextResponse.json(
      {
        success: true,
        role: auth.user.role,
        items: result.items,
        pagination: result.pagination,
      },
      { status: 200 },
    );
  } catch (error) {
    captureException(error, { route: 'GET /api/admin/sla/escalations' });
    return NextResponse.json(
      { error: 'Failed to load SLA escalations' },
      { status: 500 },
    );
  }
}
