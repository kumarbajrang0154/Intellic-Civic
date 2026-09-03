import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { decodeJwtToken } from '@/lib/auth-jwt';
import prisma from '@/lib/prisma';
import { ComplaintStatus } from '@prisma/client';

export async function PATCH(
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
    const { status, notes } = body;

    if (!status || !Object.values(ComplaintStatus).includes(status as ComplaintStatus)) {
      return NextResponse.json({ statusCode: 400, message: 'Invalid complaint status' }, { status: 400 });
    }

    const currentComplaint = await prisma.complaint.findUnique({ where: { id } });
    if (!currentComplaint) {
      return NextResponse.json({ statusCode: 404, message: 'Complaint not found' }, { status: 404 });
    }

    const updated = await prisma.complaint.update({
      where: { id },
      data: {
        status: status as ComplaintStatus,
        statusHistory: {
          create: {
            fromStatus: currentComplaint.status,
            toStatus: status as ComplaintStatus,
            changedByUserId: payload.sub,
            notes: notes || `Status changed to ${status}`,
          },
        },
      },
    });

    return NextResponse.json({ success: true, complaint: updated });
  } catch (error: any) {
    return NextResponse.json(
      { statusCode: 500, message: 'Internal server error', error: error.message },
      { status: 500 },
    );
  }
}
