import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { listComplaints } from '@/lib/complaints-store';

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (!auth.authorized) return auth.response;

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || undefined;
    const departmentId = searchParams.get('departmentId') || undefined;
    const fromDate = searchParams.get('fromDate') || undefined;
    const toDate = searchParams.get('toDate') || undefined;

    const { data: complaints } = await listComplaints({
      status,
      departmentId,
      fromDate,
      toDate,
      limit: 5000,
    });

    const headers = [
      'Ticket ID',
      'Title',
      'Status',
      'Priority',
      'Category',
      'Department',
      'Citizen Name',
      'Address',
      'Created Date',
      'Resolved Date',
    ];

    const rows = complaints.map((c) => [
      `"${c.ticketId || ''}"`,
      `"${(c.title || '').replace(/"/g, '""')}"`,
      `"${c.status || ''}"`,
      `"${c.priority || 'MEDIUM'}"`,
      `"${(c.category?.name || 'Uncategorized').replace(/"/g, '""')}"`,
      `"${(c.department?.name || 'Unassigned').replace(/"/g, '""')}"`,
      `"${(c.citizenName || 'Citizen').replace(/"/g, '""')}"`,
      `"${(c.location?.address || '').replace(/"/g, '""')}"`,
      `"${c.createdAt}"`,
      `"${c.resolvedAt || ''}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="intellicivic_complaints_report_${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { message: 'Failed to export report', error: error.message },
      { status: 500 },
    );
  }
}
