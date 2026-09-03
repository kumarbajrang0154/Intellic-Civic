import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { decodeJwtToken } from '@/lib/auth-jwt';
import { assignFieldWorkerToComplaint } from '@/lib/complaints-store';
import prisma from '@/lib/prisma';

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
    const { fieldWorkerId, assignedToId } = body;

    const targetId = fieldWorkerId || assignedToId;
    if (!targetId) {
      return NextResponse.json({ statusCode: 400, message: 'Field worker ID is required' }, { status: 400 });
    }

    const targetWorker = await prisma.user.findUnique({ where: { id: targetId } });
    const targetName = targetWorker?.name || 'Field Worker';

    const result = await assignFieldWorkerToComplaint(id, targetId, targetName, payload.sub);
    if (!result.ok) {
      return NextResponse.json({ statusCode: result.status, message: result.message }, { status: result.status });
    }

    return NextResponse.json({ success: true, complaint: result.complaint });
  } catch (error: any) {
    return NextResponse.json(
      { statusCode: 500, message: 'Internal server error', error: error.message },
      { status: 500 },
    );
  }
}
