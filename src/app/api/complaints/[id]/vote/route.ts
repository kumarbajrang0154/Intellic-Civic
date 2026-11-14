import { NextRequest, NextResponse } from 'next/server';
import { requireCitizen } from '@/lib/citizen-auth';
import { captureException } from '@/lib/error-monitoring';
import { checkRateLimit, rateLimitErrorResponse } from '@/lib/rate-limit';
import { validateComplaintIdParam } from '@/lib/validation';
import { castComplaintVote, removeComplaintVote } from '@/services/complaint-loop-service';

export interface VoteRouteDeps {
  requireCitizen?: typeof requireCitizen;
  checkRateLimit?: typeof checkRateLimit;
  castVote?: typeof castComplaintVote;
  removeVote?: typeof removeComplaintVote;
}

export async function handleVotePost(
  request: NextRequest,
  params: { id: string },
  deps: VoteRouteDeps = {},
) {
  try {
    const requireCitizenFn = deps.requireCitizen || requireCitizen;
    const checkRateLimitFn = deps.checkRateLimit || checkRateLimit;
    const castVoteFn = deps.castVote || castComplaintVote;

    const auth = await requireCitizenFn();
    if (!auth.authorized) return auth.response;

    const rateLimit = await checkRateLimitFn(request, 'complaintCreate', auth.user.id);
    if (!rateLimit.success) {
      return rateLimitErrorResponse(rateLimit);
    }

    const idValidation = validateComplaintIdParam(params?.id);
    if (!idValidation.success) {
      return NextResponse.json({ statusCode: 400, message: idValidation.error }, { status: 400 });
    }

    const result = await castVoteFn(idValidation.data!, auth.user.id);
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

export async function handleVoteDelete(
  request: NextRequest,
  params: { id: string },
  deps: VoteRouteDeps = {},
) {
  try {
    const requireCitizenFn = deps.requireCitizen || requireCitizen;
    const checkRateLimitFn = deps.checkRateLimit || checkRateLimit;
    const removeVoteFn = deps.removeVote || removeComplaintVote;

    const auth = await requireCitizenFn();
    if (!auth.authorized) return auth.response;

    const rateLimit = await checkRateLimitFn(request, 'complaintCreate', auth.user.id);
    if (!rateLimit.success) {
      return rateLimitErrorResponse(rateLimit);
    }

    const idValidation = validateComplaintIdParam(params?.id);
    if (!idValidation.success) {
      return NextResponse.json({ statusCode: 400, message: idValidation.error }, { status: 400 });
    }

    const result = await removeVoteFn(idValidation.data!, auth.user.id);
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

export async function POST(
  request: NextRequest,
  context: { params: { id: string } },
) {
  return handleVotePost(request, context.params);
}

export async function DELETE(
  request: NextRequest,
  context: { params: { id: string } },
) {
  return handleVoteDelete(request, context.params);
}
