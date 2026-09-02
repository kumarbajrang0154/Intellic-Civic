import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { decodeJwtToken } from '@/lib/auth-jwt';
import { addAuditLog } from '@/lib/audit-store';
import { addFeedbackToComplaint } from '@/lib/complaints-store';
import { validateFeedbackInput } from '@/lib/validation';

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

    const body = await request.json().catch(() => ({}));
    const validation = validateFeedbackInput(body);

    if (!validation.success) {
      return NextResponse.json({ statusCode: 400, message: validation.error }, { status: 400 });
    }

    const result = addFeedbackToComplaint(
      params.id,
      payload.sub,
      validation.data!.rating,
      validation.data!.comment,
    );

    if (!result.ok) {
      return NextResponse.json({ statusCode: result.status, message: result.message }, { status: result.status });
    }

    addAuditLog({
      actorId: payload.sub,
      actorName: payload.name || 'Citizen User',
      action: 'COMPLAINT_FEEDBACK_SUBMITTED',
      entityType: 'Complaint',
      targetId: params.id,
      targetName: params.id,
      metadata: { rating: validation.data!.rating, comment: validation.data!.comment },
    });

    return NextResponse.json({ success: true, message: result.message, feedback: result.feedback });
  } catch (error: any) {
    return NextResponse.json(
      { statusCode: 500, message: 'Internal server error', error: error.message },
      { status: 500 },
    );
  }
}
