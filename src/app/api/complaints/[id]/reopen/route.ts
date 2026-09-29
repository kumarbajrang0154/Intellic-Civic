import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { addAuditLog } from '@/lib/audit-store';
import { requireCitizen } from '@/lib/citizen-auth';
import { reopenComplaint } from '@/lib/complaints-store';
import { validateReopenInput } from '@/lib/validation';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const auth = await requireCitizen();
    if (!auth.authorized) return auth.response;

    const body = await request.json().catch(() => ({}));
    const validation = validateReopenInput(body);

    if (!validation.success) {
      return NextResponse.json({ statusCode: 400, message: validation.error }, { status: 400 });
    }

    const result = await reopenComplaint(params.id, auth.user.id, validation.data!.reason);
    if (!result.ok) {
      return NextResponse.json({ statusCode: result.status, message: result.message }, { status: result.status });
    }

    await addAuditLog({
      actorId: auth.user.id,
      actorName: auth.user.name || 'Citizen User',
      action: 'COMPLAINT_REOPENED',
      entityType: 'Complaint',
      targetId: params.id,
      targetName: result.complaint?.ticketId || params.id,
      metadata: {
        reason: validation.data!.reason,
        reopenCount: result.complaint?.reopenCount,
        newStatus: result.complaint?.status,
      },
    });

    return NextResponse.json({ success: true, message: result.message, complaint: result.complaint });
  } catch (error: any) {
    return NextResponse.json(
      { statusCode: 500, message: 'Internal server error', error: error.message },
      { status: 500 },
    );
  }
}
