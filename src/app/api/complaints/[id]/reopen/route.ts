import { NextRequest, NextResponse } from 'next/server';
import { addAuditLog } from '@/lib/audit-store';
import { requireCitizen } from '@/lib/citizen-auth';
import { captureException } from '@/lib/error-monitoring';
import { checkRateLimit, rateLimitErrorResponse } from '@/lib/rate-limit';
import { validateComplaintIdParam, validateReopenInput } from '@/lib/validation';
import { reopenCitizenComplaint } from '@/services/complaint-loop-service';

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
    const validation = validateReopenInput(body);

    if (!validation.success) {
      return NextResponse.json({ statusCode: 400, message: validation.error }, { status: 400 });
    }

    const result = await reopenCitizenComplaint(
      idValidation.data!,
      auth.user.id,
      validation.data!.reason,
    );
    if (!result.ok) {
      return NextResponse.json({ statusCode: result.status, message: result.message }, { status: result.status });
    }

    await addAuditLog({
      actorId: auth.user.id,
      actorName: 'Citizen User',
      action: 'COMPLAINT_REOPENED',
      entityType: 'Complaint',
      targetId: result.complaint?.id || idValidation.data!,
      targetName: result.complaint?.ticketId || idValidation.data!,
      metadata: {
        reopenCount: result.complaint?.reopenCount,
        newStatus: result.complaint?.status,
      },
    }).catch(() => {});

    return NextResponse.json({ success: true, message: result.message, complaint: result.complaint });
  } catch (error: unknown) {
    captureException(error, { route: 'POST /api/complaints/[id]/reopen' });
    return NextResponse.json(
      { statusCode: 500, message: 'Internal server error' },
      { status: 500 },
    );
  }
}
