import { NextRequest, NextResponse } from 'next/server';
import { requireStaff } from '@/lib/admin-auth';
import { captureException } from '@/lib/error-monitoring';
import { checkRateLimit, rateLimitErrorResponse } from '@/lib/rate-limit';
import { validateComplaintIdParam } from '@/lib/validation';
import {
  assignmentSuggestionsQuerySchema,
  getAssignmentCandidates,
  SMART_ASSIGNMENT_ALLOWED_ROLES,
} from '@/services/smart-assignment-service';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const auth = await requireStaff([...SMART_ASSIGNMENT_ALLOWED_ROLES]);
    if (!auth.authorized) {
      return auth.response;
    }

    const rateLimit = await checkRateLimit(request, 'general', auth.user.id);
    if (!rateLimit.success) {
      return rateLimitErrorResponse(rateLimit);
    }

    const idValidation = validateComplaintIdParam(params?.id);
    if (!idValidation.success) {
      return NextResponse.json(
        { error: idValidation.error || 'Invalid complaint ID' },
        { status: 400 },
      );
    }

    const { searchParams } = new URL(request.url);
    const rawParams = Object.fromEntries(searchParams.entries());
    const parsedQuery = assignmentSuggestionsQuerySchema.safeParse(rawParams);

    if (!parsedQuery.success) {
      return NextResponse.json(
        {
          error: 'Invalid query parameters',
          details: parsedQuery.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const result = await getAssignmentCandidates(
      idValidation.data!,
      {
        role: auth.user.role,
        departmentId: auth.user.departmentId,
      },
      {
        limit: parsedQuery.data.limit,
        role: parsedQuery.data.role,
      },
    );

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error },
        { status: result.statusCode },
      );
    }

    return NextResponse.json(
      {
        success: true,
        complaintId: result.complaintId,
        ticketId: result.ticketId,
        departmentId: result.departmentId,
        suggestions: result.suggestions,
      },
      {
        status: 200,
        headers: { 'Cache-Control': 'no-store' },
      },
    );
  } catch (error) {
    captureException(error, {
      route: 'GET /api/admin/complaints/[id]/assignment-suggestions',
    });
    return NextResponse.json(
      { error: 'Failed to generate assignment suggestions' },
      { status: 500 },
    );
  }
}
