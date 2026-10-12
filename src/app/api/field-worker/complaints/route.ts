import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { decodeJwtToken, verifyJwtToken } from '@/lib/auth-jwt';
import { getAssignedComplaints } from '@/services/fieldWorkerService';

export async function GET(request: NextRequest) {
  try {
    const cookieStore = cookies();
    const accessToken = cookieStore.get('ic_access_token')?.value;

    if (!accessToken) {
      return NextResponse.json({ statusCode: 401, message: 'Unauthorized session' }, { status: 401 });
    }

    const payload = await verifyJwtToken(accessToken);
    if (!payload || !payload.sub || (payload.exp && payload.exp * 1000 < Date.now())) {
      return NextResponse.json({ statusCode: 401, message: 'Unauthorized session' }, { status: 401 });
    }

    if (payload.role !== 'FIELD_WORKER') {
      return NextResponse.json(
        { statusCode: 403, message: 'Forbidden: Field Worker access required' },
        { status: 403 },
      );
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const status = searchParams.get('status') || 'ACTIVE';

    const result = await getAssignedComplaints({
      fieldWorkerId: payload.sub,
      status,
      page,
      limit,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[Field Worker Complaints GET Error]', error);
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

