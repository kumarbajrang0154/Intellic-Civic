import { NextRequest, NextResponse } from 'next/server';
import { requireStaff } from '@/lib/admin-auth';
import { captureException } from '@/lib/error-monitoring';
import { checkRateLimit, rateLimitErrorResponse } from '@/lib/rate-limit';
import {
  getDepartmentMaterialCostSummary,
  materialCostReportQuerySchema,
  MaterialServiceError,
} from '@/services/material-cost-service';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireStaff(['SUPER_ADMIN', 'ADMIN']);
    if (!auth.authorized) {
      return auth.response;
    }

    const rateLimit = await checkRateLimit(request, 'general', auth.user.id);
    if (!rateLimit.success) {
      return rateLimitErrorResponse(rateLimit);
    }

    const { searchParams } = new URL(request.url);
    const parsed = materialCostReportQuerySchema.safeParse({
      from: searchParams.get('from') ?? undefined,
      to: searchParams.get('to') ?? undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: parsed.error.issues[0]?.message || 'Invalid report query parameters',
        },
        { status: 400, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    const report = await getDepartmentMaterialCostSummary(
      {
        from: parsed.data.from,
        to: parsed.data.to,
      },
      { role: auth.user.role },
    );

    return NextResponse.json(
      { success: true, data: report },
      { status: 200, headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    if (error instanceof MaterialServiceError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status, headers: { 'Cache-Control': 'no-store' } },
      );
    }
    captureException(error, { route: 'api/admin/reports/material-cost' });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}

