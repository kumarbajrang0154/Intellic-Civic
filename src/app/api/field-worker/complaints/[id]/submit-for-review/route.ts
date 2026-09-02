import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { decodeJwtToken } from '@/lib/auth-jwt';
import { submitWorkForReview } from '@/services/fieldWorkerService';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const cookieStore = cookies();
    const accessToken = cookieStore.get('ic_access_token')?.value;

    if (!accessToken) {
      return NextResponse.json({ statusCode: 401, message: 'Unauthorized session' }, { status: 401 });
    }

    const payload = decodeJwtToken(accessToken);
    if (!payload || !payload.sub) {
      return NextResponse.json({ statusCode: 401, message: 'Unauthorized session' }, { status: 401 });
    }

    if (payload.role !== 'FIELD_WORKER') {
      return NextResponse.json(
        { statusCode: 403, message: 'Forbidden: Field Worker access required' },
        { status: 403 },
      );
    }

    const body = await request.json().catch(() => ({}));
    const { remarks } = body;

    if (!remarks || typeof remarks !== 'string' || remarks.trim().length < 5) {
      return NextResponse.json(
        { statusCode: 400, message: 'Completion remarks (min 5 characters) are required' },
        { status: 400 },
      );
    }

    const result = submitWorkForReview(
      params.id,
      payload.sub,
      remarks.trim(),
      payload.name || 'Field Worker',
    );

    if (!result.ok) {
      return NextResponse.json({ statusCode: result.status, message: result.message }, { status: result.status });
    }

    return NextResponse.json({ success: true, message: result.message, complaint: result.complaint });
  } catch (error: any) {
    return NextResponse.json(
      { statusCode: 500, message: 'Internal server error', error: error.message },
      { status: 500 },
    );
  }
}
