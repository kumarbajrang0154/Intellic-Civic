import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { decodeJwtToken } from '@/lib/auth-jwt';
import { addAuditLog } from '@/lib/audit-store';
import { markComplaintSatisfactory } from '@/lib/complaints-store';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const cookieStore = cookies();
    const accessToken = cookieStore.get('ic_access_token')?.value;

    if (!accessToken) {
      return NextResponse.json({ statusCode: 401, message: 'Unauthorized session' }, { status: 401 });
    }

    const payload = decodeJwtToken(accessToken);
    if (!payload || !payload.sub) {
      return NextResponse.json({ statusCode: 401, message: 'Unauthorized session' }, { status: 401 });
    }

    const result = await markComplaintSatisfactory(params.id, payload.sub);
    if (!result.ok) {
      return NextResponse.json({ statusCode: result.status, message: result.message }, { status: result.status });
    }

    await addAuditLog({
      actorId: payload.sub,
      actorName: payload.name || 'Citizen User',
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
