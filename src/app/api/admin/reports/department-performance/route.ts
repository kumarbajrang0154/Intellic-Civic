import { NextRequest, NextResponse } from 'next/server';
import { requireStaff } from '@/lib/admin-auth';
import { captureException } from '@/lib/error-monitoring';
import { checkRateLimit, rateLimitErrorResponse } from '@/lib/rate-limit';
import { handleScheduledReportDownload } from '@/lib/scheduled-report-http';
import {
  departmentReportQuerySchema,
  formatDepartmentPerformanceCsv,
  getDepartmentPerformanceReport,
} from '@/services/department-report-service';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    if (request.nextUrl.searchParams.get('format') === 'html') {
      return handleScheduledReportDownload(request, 'department-performance');
    }

    const auth = await requireStaff(['SUPER_ADMIN', 'ADMIN']);
    if (!auth.authorized) return auth.response;

    const rateLimit = await checkRateLimit(request, 'general', auth.user.id);
    if (!rateLimit.success) {
      return rateLimitErrorResponse(rateLimit);
    }

    const { searchParams } = new URL(request.url);
    const parsed = departmentReportQuerySchema.safeParse({
      from: searchParams.get('from') ?? undefined,
      to: searchParams.get('to') ?? undefined,
      departmentId: searchParams.get('departmentId') ?? undefined,
      format: searchParams.get('format') ?? undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        {
          statusCode: 400,
          message: parsed.error.issues[0]?.message || 'Invalid report query parameters.',
        },
        { status: 400 },
      );
    }

    const report = await getDepartmentPerformanceReport({
      from: parsed.data.from,
      to: parsed.data.to,
      departmentId: parsed.data.departmentId,
    });

    if (parsed.data.format === 'csv') {
      const csv = formatDepartmentPerformanceCsv(report);
      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="department-performance-${report.range.from}-to-${report.range.to}.csv"`,
          'Cache-Control': 'no-store',
        },
      });
    }

    return NextResponse.json(
      { success: true, data: report },
      { status: 200, headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error: unknown) {
    captureException(error, { route: 'GET /api/admin/reports/department-performance' });
    return NextResponse.json(
      { statusCode: 500, message: 'Unable to generate department performance report.' },
      { status: 500 },
    );
  }
}

