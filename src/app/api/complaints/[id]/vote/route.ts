import { NextRequest, NextResponse } from 'next/server';
import { requireCitizen } from '@/lib/citizen-auth';
import { captureException } from '@/lib/error-monitoring';
import { checkRateLimit, rateLimitErrorResponse } from '@/lib/rate-limit';
import { validateComplaintIdParam } from '@/lib/validation';
import { castComplaintVote, removeComplaintVote } from '@/services/complaint-loop-service';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const auth = await requireCitizen();
    if (!auth.authorized) return auth.response;

    const rateLimit = await checkRateLimit(request, 'complaintCreate', auth.user.id);
    if (!rateLimit.success) {
      return rateLimitErrorResponse(rateLimit);
    }

    const idValidation = validateComplaintIdParam(params?.id);
    if (!idValidation.success) {
      return NextResponse.json({ statusCode: 400, message: idValidation.error }, { status: 400 });
    }

    const result = await castComplaintVote(idValidation.data!, auth.user.id);
    if (!result.ok) {
      return NextResponse.json({ statusCode: result.status, message: result.message }, { status: result.status });
    }

    return NextResponse.json({
      success: true,
      message: result.message,
      voted: result.voted,
      voteCount: result.voteCount,
    });
  } catch (error: unknown) {
    captureException(error, { route: 'POST /api/complaints/[id]/vote' });
    return NextResponse.json(
      { statusCode: 500, message: 'Internal server error' },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const auth = await requireCitizen();
    if (!auth.authorized) return auth.response;

    const rateLimit = await checkRateLimit(request, 'complaintCreate', auth.user.id);
    if (!rateLimit.success) {
      return rateLimitErrorResponse(rateLimit);
    }

    const idValidation = validateComplaintIdParam(params?.id);
    if (!idValidation.success) {
      return NextResponse.json({ statusCode: 400, message: idValidation.error }, { status: 400 });
    }

    const result = await removeComplaintVote(idValidation.data!, auth.user.id);
    if (!result.ok) {
      return NextResponse.json({ statusCode: result.status, message: result.message }, { status: result.status });
    }

    return NextResponse.json({
      success: true,
      message: result.message,
      voted: result.voted,
      voteCount: result.voteCount,
    });
  } catch (error: unknown) {
    captureException(error, { route: 'DELETE /api/complaints/[id]/vote' });
    return NextResponse.json(
      { statusCode: 500, message: 'Internal server error' },
      { status: 500 },
    );
  }
}
