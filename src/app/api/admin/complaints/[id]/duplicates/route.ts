import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireStaff } from '@/lib/admin-auth';
import { captureException } from '@/lib/error-monitoring';
import { checkRateLimit, rateLimitErrorResponse } from '@/lib/rate-limit';
import { validateComplaintIdParam } from '@/lib/validation';
import {
  DUPLICATE_ALLOWED_ROLES,
  findDuplicateCandidatesForComplaint,
} from '@/services/duplicate-service';

export const dynamic = 'force-dynamic';

const duplicatesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(5).optional(),
  threshold: z.coerce.number().min(0).max(1).optional(),
});

function nonEmptyParam(value: string | null): string | undefined {
  if (value === null) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const auth = await requireStaff([...DUPLICATE_ALLOWED_ROLES]);
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
    const queryParsed = duplicatesQuerySchema.safeParse({
      limit: nonEmptyParam(searchParams.get('limit')),
      threshold: nonEmptyParam(searchParams.get('threshold')),
    });

    if (!queryParsed.success) {
      return NextResponse.json(
        {
          error: 'Invalid query parameters',
          details: queryParsed.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const result = await findDuplicateCandidatesForComplaint(
      idValidation.data!,
      {
        role: auth.user.role,
        departmentId: auth.user.departmentId,
      },
      {
        limit: queryParsed.data.limit,
        threshold: queryParsed.data.threshold,
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
        complaint: result.target,
        duplicates: result.duplicates,
      },
      { status: 200 },
    );
  } catch (error) {
    captureException(error, { route: 'GET /api/admin/complaints/[id]/duplicates' });
    return NextResponse.json(
      { error: 'Failed to evaluate possible duplicate complaints' },
      { status: 500 },
    );
  }
}

