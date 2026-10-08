import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { decodeJwtToken } from '@/lib/auth-jwt';
import { requireCitizen } from '@/lib/citizen-auth';
import { createComplaint, listComplaints } from '@/lib/complaints-store';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const cookieStore = cookies();
    const accessToken = cookieStore.get('ic_access_token')?.value;

    if (!accessToken) {
      return NextResponse.json({ statusCode: 401, message: 'Unauthorized' }, { status: 401 });
    }

    const payload = decodeJwtToken(accessToken);
    if (!payload) {
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
    const fromDate = searchParams.get('fromDate') || undefined;
    const toDate = searchParams.get('toDate') || undefined;
    const needsTriage = searchParams.get('needsTriage') === 'true';
    const pendingAiConfirmation = searchParams.get('pendingAiConfirmation') === 'true';
    const assignedToMe = searchParams.get('assignedToMe') === 'true';

    // Role-based scope enforcement
    let citizenId: string | undefined = undefined;
    let assignedFieldWorkerId: string | undefined = undefined;
    let departmentOfficerId: string | undefined = undefined;
    if (payload.role === 'CITIZEN') {
      const auth = await requireCitizen();
      if (!auth.authorized) return auth.response;
      citizenId = auth.user.id;
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
      fromDate,
      toDate,
      needsTriage,
      pendingAiConfirmation,
      page,
      limit,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { statusCode: 500, message: 'Internal server error', error: error.message },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireCitizen();
    if (!auth.authorized) return auth.response;

    const body = await request.json();
    const {
      title,
      description,
      categoryId,
      location,
      isVoiceInput,
      voiceTranscript,
      imageUrl,
      imageUrls,
      clientRequestId,
      capturedAt,
      language,
    } = body;

    // Validate clientRequestId if provided
    if (clientRequestId !== undefined && clientRequestId !== null) {
      if (typeof clientRequestId !== 'string' || !clientRequestId.trim()) {
        return NextResponse.json(
          { statusCode: 400, message: 'Invalid clientRequestId: must be a non-empty string' },
          { status: 400 },
        );
      }
    }

    // Validate capturedAt if provided
    let parsedCapturedAt: Date | undefined = undefined;
    if (capturedAt !== undefined && capturedAt !== null) {
      const d = new Date(capturedAt);
      if (isNaN(d.getTime())) {
        return NextResponse.json(
          { statusCode: 400, message: 'Invalid capturedAt timestamp' },
          { status: 400 },
        );
      }
      parsedCapturedAt = d;
    }

    const trimmedClientRequestId = typeof clientRequestId === 'string' ? clientRequestId.trim() : undefined;

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

    if (!title || typeof title !== 'string' || !title.trim()) {
      return NextResponse.json(
        { statusCode: 400, message: 'Complaint title is required' },
        { status: 400 },
      );
    }

    if (!description || typeof description !== 'string' || description.trim().length < 20) {
      return NextResponse.json(
        { statusCode: 400, message: 'Detailed description (min 20 characters) is required' },
        { status: 400 },
      );
    }

    const { evidence } = body;
    const allImages = Array.isArray(evidence) && evidence.length > 0
      ? evidence
      : (Array.isArray(imageUrls) && imageUrls.length > 0
        ? imageUrls
        : (imageUrl ? [imageUrl] : []));

    if (allImages.length === 0) {
      return NextResponse.json(
        { statusCode: 400, message: 'At least 1 photo evidence is required to submit a complaint.' },
        { status: 400 },
      );
    }

    const firstImage = allImages[0];

    const newComplaint = await createComplaint({
      title: title.trim(),
      description: description.trim(),
      categoryId: typeof categoryId === 'string' ? categoryId : undefined,
      location,
      citizenId: auth.user.id,
      citizenName: auth.user.name || 'Citizen User',
      citizenMobile: auth.user.mobileNumber ?? undefined,
      isVoiceInput: Boolean(isVoiceInput),
      voiceTranscript: typeof voiceTranscript === 'string' ? voiceTranscript : undefined,
      imageUrl: firstImage,
      clientRequestId: trimmedClientRequestId,
      capturedAt: parsedCapturedAt,
      language: typeof language === 'string' && language.trim() ? language.trim().toLowerCase().slice(0, 2) : undefined,
    });

    return NextResponse.json(newComplaint, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { statusCode: 500, message: 'Internal server error', error: error.message },
      { status: 500 },
    );
  }
}
