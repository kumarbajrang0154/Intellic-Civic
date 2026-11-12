import { NextRequest, NextResponse } from 'next/server';
import { requireCitizen } from '@/lib/citizen-auth';
import { captureException } from '@/lib/error-monitoring';
import { checkRateLimit, rateLimitErrorResponse } from '@/lib/rate-limit';
import {
  answerCitizenQuestion,
  citizenChatRequestSchema,
  CitizenChatbotValidationError,
} from '@/services/citizen-chatbot-service';

export interface CitizenChatbotRouteDeps {
  requireCitizenFn?: typeof requireCitizen;
  checkRateLimitFn?: typeof checkRateLimit;
  answerQuestionFn?: typeof answerCitizenQuestion;
}

/**
 * Shared handler for POST /api/citizen/chatbot supporting dependency injection in unit tests.
 */
export async function handleCitizenChatbotPost(
  request: NextRequest,
  deps?: CitizenChatbotRouteDeps,
): Promise<NextResponse> {
  try {
    const authFn = deps?.requireCitizenFn ?? requireCitizen;
    const auth = await authFn();
    if (!auth.authorized) {
      return auth.response;
    }

    const rateFn = deps?.checkRateLimitFn ?? checkRateLimit;
    const rateLimit = await rateFn(request, 'ai', auth.user.id);
    if (!rateLimit.success) {
      return rateLimitErrorResponse(rateLimit);
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON request body' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    const parsed = citizenChatRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: parsed.error.issues[0]?.message || 'Invalid chat request',
        },
        { status: 400, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    const answerFn = deps?.answerQuestionFn ?? answerCitizenQuestion;
    const result = await answerFn(auth.user.id, parsed.data.message);

    return NextResponse.json(
      {
        success: true,
        answer: result.answer,
        source: result.source,
      },
      {
        status: 200,
        headers: { 'Cache-Control': 'no-store' },
      },
    );
  } catch (error) {
    if (error instanceof CitizenChatbotValidationError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    captureException(error, { route: 'POST /api/citizen/chatbot' });
    return NextResponse.json(
      { error: 'Failed to process assistant request' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}

