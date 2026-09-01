import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { decodeJwtToken } from '@/lib/auth-jwt';
import { addEvidenceToComplaint } from '@/lib/complaints-store';

export async function POST(
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
    const body = await request.json();
    const { imageUrl, stage } = body;

    if (!imageUrl) {
      return NextResponse.json(
        { statusCode: 400, message: 'imageUrl is required' },
        { status: 400 },
      );
    }

    const evidence = addEvidenceToComplaint(id, { imageUrl, stage });
    if (!evidence) {
      return NextResponse.json(
        { statusCode: 404, message: 'Complaint not found' },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, evidence });
  } catch (error: any) {
    return NextResponse.json(
      { statusCode: 500, message: 'Internal server error', error: error.message },
      { status: 500 },
    );
  }
}
