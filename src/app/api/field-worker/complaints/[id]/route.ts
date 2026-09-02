import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { decodeJwtToken } from '@/lib/auth-jwt';
import { getAssignedComplaintById } from '@/services/fieldWorkerService';

export async function GET(
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

    const result = await getAssignedComplaintById(params.id, payload.sub);
    if (!result.ok) {
      return NextResponse.json({ statusCode: result.status, message: result.message }, { status: result.status });
    }

    return NextResponse.json(result.complaint);
  } catch (error: any) {
    return NextResponse.json(
      { statusCode: 500, message: 'Internal server error', error: error.message },
      { status: 500 },
    );
  }
}
