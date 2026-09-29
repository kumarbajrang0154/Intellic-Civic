import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { addAuditLog } from '@/lib/audit-store';
import { requireCitizen } from '@/lib/citizen-auth';
import { addFeedbackToComplaint } from '@/lib/complaints-store';
import { validateFeedbackInput } from '@/lib/validation';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const auth = await requireCitizen();
    if (!auth.authorized) return auth.response;

    const body = await request.json().catch(() => ({}));
    const validation = validateFeedbackInput(body);

    if (!validation.success) {
      return NextResponse.json({ statusCode: 400, message: validation.error }, { status: 400 });
    }

    const result = await addFeedbackToComplaint(
      params.id,
      auth.user.id,
      validation.data!.rating,
      validation.data!.comment,
    );

    if (!result.ok) {
      return NextResponse.json({ statusCode: result.status, message: result.message }, { status: result.status });
    }

    await addAuditLog({
      actorId: auth.user.id,
      actorName: auth.user.name || 'Citizen User',
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
