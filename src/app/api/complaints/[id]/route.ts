import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { decodeJwtToken } from '@/lib/auth-jwt';
import { getComplaintById } from '@/lib/complaints-store';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
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

    const { id } = params;
    const complaint = await getComplaintById(id);

    if (!complaint) {
      return NextResponse.json(
        { statusCode: 404, message: 'Complaint ticket not found' },
        { status: 404 },
      );
    }

    return NextResponse.json(complaint);
  } catch (error: any) {
    return NextResponse.json(
      { statusCode: 500, message: 'Internal server error', error: error.message },
      { status: 500 },
    );
  }
}
