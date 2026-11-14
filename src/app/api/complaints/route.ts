import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { decodeJwtToken, verifyJwtToken } from '@/lib/auth-jwt';
import { requireCitizen } from '@/lib/citizen-auth';
import { createComplaint, listComplaints } from '@/lib/complaints-store';
import prisma from '@/lib/prisma';
import { checkRateLimit, rateLimitErrorResponse } from '@/lib/rate-limit';

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  try {
    const cookieStore = cookies();
    const accessToken = cookieStore.get('ic_access_token')?.value;

    if (!accessToken) {
      return NextResponse.json({ statusCode: 401, message: 'Unauthorized' }, { status: 401 });
    }

    const payload = await verifyJwtToken(accessToken);
    if (!payload || (payload.exp && payload.exp * 1000 < Date.now())) {
      return NextResponse.json({ statusCode: 401, message: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const status = searchParams.get('status') || undefined;
    const priority = searchParams.get('priority') || undefined;
    const categoryId = searchParams.get('category') || searchParams.get('categoryId') || undefined;
    let departmentId = searchParams.get('departmentId') || searchParams.get('department') || undefined;
    const search = searchParams.get('search') || undefined;
    const clientRequestId = searchParams.get('clientRequestId') || undefined;
    const fromDate = searchParams.get('fromDate') || undefined;
    const toDate = searchParams.get('toDate') || undefined;
    const needsTriage = searchParams.get('needsTriage') === 'true';
    const pendingAiConfirmation = searchParams.get('pendingAiConfirmation') === 'true';
    const assignedToMe = searchParams.get('assignedToMe') === 'true';
    const scope = searchParams.get('scope') || undefined;

    // Role-based scope enforcement
    let citizenId: string | undefined = undefined;
    let assignedFieldWorkerId: string | undefined = undefined;
    let departmentOfficerId: string | undefined = undefined;
    let authenticatedCitizenId: string | undefined = undefined;
    if (payload.role === 'CITIZEN') {
      const auth = await requireCitizen();
      if (!auth.authorized) return auth.response;
      authenticatedCitizenId = auth.user.id;
      if (scope !== 'community') {
        citizenId = auth.user.id;
      }
    }
    let municipalityId = searchParams.get('municipalityId') || undefined;

    if (payload.role === 'DEPARTMENT_HEAD') {
      // DEPARTMENT_HEAD sees ALL complaints municipality-wide, NOT scoped by departmentId
      if (payload.municipalityId) {
        municipalityId = payload.municipalityId;
      }
    } else if (payload.role === 'DEPARTMENT_OFFICER') {
      if (payload.departmentId) {
        departmentId = payload.departmentId;
      }
    }

    const allowedRoles = ['CITIZEN', 'DEPARTMENT_HEAD', 'DEPARTMENT_OFFICER', 'FIELD_WORKER', 'ADMIN', 'SUPER_ADMIN'];
    if (!allowedRoles.includes(payload.role)) {
      return NextResponse.json({ statusCode: 403, message: 'Forbidden: Invalid role' }, { status: 403 });
    }

    if (payload.role === 'FIELD_WORKER') {
      // Field workers can only access complaints assigned to them
      assignedFieldWorkerId = payload.sub;
    } else if (assignedToMe && payload.role === 'DEPARTMENT_OFFICER') {
      departmentOfficerId = payload.sub;
    }

    const result = await listComplaints({
      citizenId,
      departmentId,
      municipalityId,
      assignedFieldWorkerId,
      departmentOfficerId,
      status,
      priority,
      categoryId,
      search,
      clientRequestId,
      fromDate,
      toDate,
      needsTriage,
      pendingAiConfirmation,
      viewerId: payload.sub,
      page,
      limit,
    });

    if (payload.role === 'CITIZEN') {
      const sanitizedData = result.data.map((item) => {
        const isOwnComplaint = item.citizenId === authenticatedCitizenId;
        if (isOwnComplaint) {
          return { ...item, isOwnComplaint: true };
        }
        return {
          ...item,
          isOwnComplaint: false,
          citizenId: undefined,
          citizenName: 'Verified Citizen',
          citizenMobile: undefined,
        };
      });
      return NextResponse.json({
        data: sanitizedData,
        meta: result.meta,
      });
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[Complaints GET Error]', error);
    return NextResponse.json(
      {
        statusCode: 500,
        message: 'Internal server error',
        ...(process.env.NODE_ENV !== 'production' ? { error: error?.message } : {}),
      },
      { status: 500 },
    );
  }
}

const createComplaintSchema = z
  .object({
    title: z
      .string('Complaint title is required')
      .trim()
      .min(1, 'Complaint title is required'),
    description: z
      .string('Detailed description (min 20 characters) is required')
      .trim()
      .min(20, 'Detailed description (min 20 characters) is required'),
    categoryId: z.string().trim().optional(),
    location: z
      .object({
        latitude: z.number(),
        longitude: z.number(),
        address: z.string().optional(),
      })
      .optional(),
    isVoiceInput: z.boolean().optional(),
    voiceTranscript: z.string().optional(),
    imageUrl: z.string().optional(),
    imageUrls: z.array(z.string()).optional(),
    evidence: z.array(z.string()).optional(),
    clientRequestId: z
      .string('Invalid clientRequestId: must be a non-empty string')
      .trim()
      .min(1, 'Invalid clientRequestId: must be a non-empty string')
      .optional()
      .nullable(),
    capturedAt: z.union([z.string(), z.date()]).optional().nullable(),
    language: z.string().optional(),
    mockAiProvider: z.string().optional(),
  })
  .refine(
    (data) => {
      const allImages =
        Array.isArray(data.evidence) && data.evidence.length > 0
          ? data.evidence
          : Array.isArray(data.imageUrls) && data.imageUrls.length > 0
          ? data.imageUrls
          : data.imageUrl
          ? [data.imageUrl]
          : [];
      return allImages.length > 0;
    },
    {
      message: 'At least 1 photo evidence is required to submit a complaint.',
      path: ['evidence'],
    },
  )
  .refine(
    (data) => {
      if (!data.capturedAt) return true;
      const d = new Date(data.capturedAt);
      return !isNaN(d.getTime());
    },
    {
      message: 'Invalid capturedAt timestamp',
      path: ['capturedAt'],
    },
  );

export async function POST(request: NextRequest) {
  try {
    const auth = await requireCitizen();
    if (!auth.authorized) return auth.response;

    const rateLimitResult = await checkRateLimit(request, 'complaintCreate', auth.user.id);
    if (!rateLimitResult.success) {
      return rateLimitErrorResponse(rateLimitResult);
    }

    const body = await request.json().catch(() => ({}));
    const parseResult = createComplaintSchema.safeParse(body);

    if (!parseResult.success) {
      const firstIssue = parseResult.error.issues[0];
      return NextResponse.json(
        { statusCode: 400, message: firstIssue?.message || 'Invalid complaint data' },
        { status: 400 },
      );
    }

    const validData = parseResult.data;
    const trimmedClientRequestId = validData.clientRequestId ? validData.clientRequestId.trim() : undefined;

    // Validate and parse capturedAt if provided
    let parsedCapturedAt: Date | undefined = undefined;
    if (validData.capturedAt) {
      parsedCapturedAt = new Date(validData.capturedAt);
    }

    // Idempotency: if clientRequestId already exists, return existing complaint with status 200
    if (trimmedClientRequestId) {
      const existing = await prisma.complaint.findUnique({
        where: { clientRequestId: trimmedClientRequestId },
        include: {
          category: true,
          department: true,
          location: true,
          images: true,
        },
      });

      if (existing) {
        if (existing.citizenId === auth.user.id) {
          return NextResponse.json(existing, { status: 200 });
        } else {
          return NextResponse.json(
            { statusCode: 403, message: 'Forbidden: clientRequestId belongs to another user' },
            { status: 403 },
          );
        }
      }
    }

    const allImages =
      Array.isArray(validData.evidence) && validData.evidence.length > 0
        ? validData.evidence
        : Array.isArray(validData.imageUrls) && validData.imageUrls.length > 0
        ? validData.imageUrls
        : validData.imageUrl
        ? [validData.imageUrl]
        : [];

    const firstImage = allImages[0];
    const mockAiProvider = request.headers.get('x-mock-ai-provider') || validData.mockAiProvider || undefined;

    try {
      const newComplaint = await createComplaint({
        title: validData.title.trim(),
        description: validData.description.trim(),
        categoryId: validData.categoryId,
        location: validData.location,
        citizenId: auth.user.id,
        citizenName: auth.user.name || 'Citizen User',
        citizenMobile: auth.user.mobileNumber ?? undefined,
        isVoiceInput: Boolean(validData.isVoiceInput),
        voiceTranscript: validData.voiceTranscript,
        imageUrl: firstImage,
        clientRequestId: trimmedClientRequestId,
        capturedAt: parsedCapturedAt,
        language:
          typeof validData.language === 'string' && validData.language.trim()
            ? validData.language.trim().toLowerCase().slice(0, 2)
            : undefined,
        mockAiProvider,
      });

      return NextResponse.json(newComplaint, { status: 201 });
    } catch (createErr: any) {
      // Catch race-condition duplicate submissions on unique constraint (Prisma P2002)
      if (createErr?.code === 'P2002' && trimmedClientRequestId) {
        const existing = await prisma.complaint.findUnique({
          where: { clientRequestId: trimmedClientRequestId },
          include: {
            category: true,
            department: true,
            location: true,
            images: true,
          },
        });
        if (existing) {
          if (existing.citizenId === auth.user.id) {
            return NextResponse.json(existing, { status: 200 });
          }
          return NextResponse.json(
            { statusCode: 403, message: 'Forbidden: clientRequestId belongs to another user' },
            { status: 403 },
          );
        }
      }
      throw createErr;
    }
  } catch (error: any) {
    console.error('[Complaints POST Error]', error);
    return NextResponse.json(
      {
        statusCode: 500,
        message: 'Internal server error',
        ...(process.env.NODE_ENV !== 'production' ? { error: error?.message } : {}),
      },
      { status: 500 },
    );
  }
}
