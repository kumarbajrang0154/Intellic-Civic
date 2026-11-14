import { NextRequest, NextResponse } from 'next/server';
import { addAuditLog } from '@/lib/audit-store';
import { requireCitizen } from '@/lib/citizen-auth';
import { captureException } from '@/lib/error-monitoring';
import { checkRateLimit, rateLimitErrorResponse } from '@/lib/rate-limit';
import { validateComplaintIdParam, validateFeedbackInput } from '@/lib/validation';
import { submitComplaintFeedback } from '@/services/complaint-loop-service';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const auth = await requireCitizen();
    if (!auth.authorized) return auth.response;

    const rateLimit = await checkRateLimit(request, 'general', auth.user.id);
    if (!rateLimit.success) {
      return rateLimitErrorResponse(rateLimit);
    }

    const idValidation = validateComplaintIdParam(params?.id);
    if (!idValidation.success) {
      return NextResponse.json({ statusCode: 400, message: idValidation.error }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const validation = validateFeedbackInput(body);

    if (!validation.success) {
      return NextResponse.json({ statusCode: 400, message: validation.error }, { status: 400 });
    }

    const result = await submitComplaintFeedback(
      idValidation.data!,
      auth.user.id,
      validation.data!.rating,
      validation.data!.comment,
    );

    if (!result.ok) {
      return NextResponse.json({ statusCode: result.status, message: result.message }, { status: result.status });
    }

    await addAuditLog({
      actorId: auth.user.id,
      actorName: 'Citizen User',
      action: 'COMPLAINT_FEEDBACK_SUBMITTED',
      entityType: 'Complaint',
      targetId: idValidation.data!,
      targetName: idValidation.data!,
      metadata: {
        rating: validation.data!.rating,
        hasComment: Boolean(validation.data!.comment),
      },
    }).catch(() => {});

    return NextResponse.json(
      { success: true, message: result.message, feedback: result.feedback },
      { status: 201 },
    );
  } catch (error: unknown) {
    captureException(error, { route: 'POST /api/complaints/[id]/feedback' });
    return NextResponse.json(
      { statusCode: 500, message: 'Internal server error' },
      { status: 500 },
    );
  }
}
