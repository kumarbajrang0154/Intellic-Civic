import { NextRequest, NextResponse } from 'next/server';
import { requireStaff } from '@/lib/admin-auth';
import { requireCitizen } from '@/lib/citizen-auth';
import { captureException } from '@/lib/error-monitoring';
import { checkRateLimit, rateLimitErrorResponse } from '@/lib/rate-limit';
import {
  ComplaintTranslationError,
  translateComplaintSchema,
  translateComplaintToTargetLanguage,
} from '@/services/translation-service';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    let actor: { id: string; role: string; municipalityId?: string | null };

    const staffAuth = await requireStaff([
      'ADMIN',
      'SUPER_ADMIN',
      'DEPARTMENT_HEAD',
      'OFFICER',
      'FIELD_WORKER',
    ]);
    if (staffAuth.authorized) {
      actor = {
        id: staffAuth.user.id,
        role: staffAuth.user.role,
        municipalityId: staffAuth.user.municipalityId ?? null,
      };
    } else {
      const citizenAuth = await requireCitizen();
      if (!citizenAuth.authorized) {
        return citizenAuth.response;
      }
      actor = { id: citizenAuth.user.id, role: 'CITIZEN' };
    }

    const rateLimit = await checkRateLimit(request, 'ai', actor.id);
    if (!rateLimit.success) {
      return rateLimitErrorResponse(rateLimit);
    }

    const body = await request.json().catch(() => ({}));
    const parsed = translateComplaintSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          statusCode: 400,
          message: 'targetLanguage must be one of: en, hi, ta',
        },
        { status: 400, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    const result = await translateComplaintToTargetLanguage(
      params.id,
      parsed.data.targetLanguage,
      actor,
    );

    return NextResponse.json(
      { success: true, ...result },
      { status: 200, headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error: unknown) {
    if (error instanceof ComplaintTranslationError) {
      return NextResponse.json(
        { statusCode: error.statusCode, message: error.message },
        { status: error.statusCode, headers: { 'Cache-Control': 'no-store' } },
      );
    }
    captureException(error, { route: 'POST /api/complaints/[id]/translate' });
    return NextResponse.json(
      { statusCode: 500, message: 'Failed to translate complaint.' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}

