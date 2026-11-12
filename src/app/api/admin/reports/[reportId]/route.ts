import { NextRequest } from 'next/server';
import { handleScheduledReportDownload } from '@/lib/scheduled-report-http';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { reportId: string } },
) {
  return handleScheduledReportDownload(request, params?.reportId ?? '');
}
