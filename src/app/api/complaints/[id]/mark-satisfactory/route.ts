import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { addAuditLog } from '@/lib/audit-store';
import { requireCitizen } from '@/lib/citizen-auth';
import { markComplaintSatisfactory } from '@/lib/complaints-store';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const auth = await requireCitizen();
    if (!auth.authorized) return auth.response;

    const result = await markComplaintSatisfactory(params.id, auth.user.id);
    if (!result.ok) {
      return NextResponse.json({ statusCode: result.status, message: result.message }, { status: result.status });
    }

    await addAuditLog({
      actorId: auth.user.id,
      actorName: auth.user.name || 'Citizen User',
      action: 'COMPLAINT_MARKED_SATISFACTORY',
      entityType: 'Complaint',
      targetId: params.id,
      targetName: result.complaint?.ticketId || params.id,
      metadata: { newStatus: 'CLOSED' },
    });

    return NextResponse.json({ success: true, message: result.message, complaint: result.complaint });
  } catch (error: any) {
    return NextResponse.json(
      { statusCode: 500, message: 'Internal server error', error: error.message },
      { status: 500 },
    );
  }
}
