import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { decodeJwtToken } from '@/lib/auth-jwt';
import { uploadWorkEvidence } from '@/services/fieldWorkerService';

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
    const { stage, imageUrl, notes } = body;

    if (!['BEFORE', 'DURING', 'AFTER'].includes(stage)) {
      return NextResponse.json(
        { statusCode: 400, message: 'Invalid evidence stage. Allowed: BEFORE, DURING, AFTER' },
        { status: 400 },
      );
    }

    if (!imageUrl || typeof imageUrl !== 'string' || !imageUrl.trim()) {
      return NextResponse.json(
        { statusCode: 400, message: 'Valid imageUrl is required' },
        { status: 400 },
      );
    }

    const result = await uploadWorkEvidence(
      params.id,
      payload.sub,
      stage,
      imageUrl,
      notes,
      payload.name || 'Field Worker',
    );

    if (!result.ok) {
      return NextResponse.json({ statusCode: result.status, message: result.message }, { status: result.status });
    }

    return NextResponse.json({ success: true, message: result.message, evidence: result.evidence }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { statusCode: 500, message: 'Internal server error', error: error.message },
      { status: 500 },
    );
  }
}
