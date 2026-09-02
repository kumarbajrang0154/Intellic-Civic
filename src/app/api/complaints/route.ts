import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { decodeJwtToken } from '@/lib/auth-jwt';
import { createComplaint, listComplaints } from '@/lib/complaints-store';

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
    const categoryId = searchParams.get('category') || undefined;
    const search = searchParams.get('search') || undefined;
    const fromDate = searchParams.get('fromDate') || undefined;
    const toDate = searchParams.get('toDate') || undefined;

    // Filter by citizenId if role is CITIZEN
    const citizenId = payload.role === 'CITIZEN' ? payload.sub : undefined;

    const result = await listComplaints({
      citizenId,
      status,
      categoryId,
      search,
      fromDate,
      toDate,
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
    const cookieStore = cookies();
    const accessToken = cookieStore.get('ic_access_token')?.value;

    if (!accessToken) {
      return NextResponse.json({ statusCode: 401, message: 'Unauthorized' }, { status: 401 });
    }

    const payload = decodeJwtToken(accessToken);
    if (!payload) {
      return NextResponse.json({ statusCode: 401, message: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { title, description, categoryId, location, isVoiceInput, voiceTranscript } = body;

    if (!title || !title.trim()) {
      return NextResponse.json(
        { statusCode: 400, message: 'Complaint title is required' },
        { status: 400 },
      );
    }

    if (!description || description.trim().length < 20) {
      return NextResponse.json(
        { statusCode: 400, message: 'Detailed description (min 20 characters) is required' },
        { status: 400 },
      );
    }

    const newComplaint = await createComplaint({
      title: title.trim(),
      description: description.trim(),
      categoryId,
      location,
      citizenId: payload.sub,
      citizenName: payload.name || 'Citizen User',
      citizenMobile: payload.mobileNumber,
      isVoiceInput: Boolean(isVoiceInput),
      voiceTranscript: voiceTranscript || undefined,
    });

    return NextResponse.json(newComplaint, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { statusCode: 500, message: 'Internal server error', error: error.message },
      { status: 500 },
    );
  }
}
