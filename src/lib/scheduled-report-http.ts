import { NextRequest, NextResponse } from 'next/server';
import { requireStaff } from '@/lib/admin-auth';
import { captureException } from '@/lib/error-monitoring';
import { checkRateLimit, rateLimitErrorResponse } from '@/lib/rate-limit';
import {
  generateFormattedReport,
  scheduledReportQuerySchema,
  type ReportId,
} from '@/services/scheduled-report-service';

/**
 * Shared HTTP handler for downloading or opening scheduled aggregate reports in CSV or print HTML.
 */
export async function handleScheduledReportDownload(
  request: NextRequest,
  reportId: string,
): Promise<NextResponse> {
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
    const parsed = scheduledReportQuerySchema.safeParse({
      reportId,
      format: searchParams.get('format') ?? undefined,
      from: searchParams.get('from') ?? undefined,
      to: searchParams.get('to') ?? undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: parsed.error.issues[0]?.message || 'Invalid report request parameters',
        },
        { status: 400, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    const generated = await generateFormattedReport({
      reportId: parsed.data.reportId as ReportId,
      format: parsed.data.format,
      from: parsed.data.from,
      to: parsed.data.to,
    });

    const isInlineHtml =
      generated.format === 'html' && searchParams.get('inline') === '1';
    const dispositionType = isInlineHtml ? 'inline' : 'attachment';

    return new NextResponse(generated.content, {
      status: 200,
      headers: {
        'Content-Type': generated.contentType,
        'Content-Disposition': `${dispositionType}; filename="${generated.filename}"`,
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    captureException(error, {
      route: 'GET /api/admin/reports/[reportId]',
      reportId,
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}

