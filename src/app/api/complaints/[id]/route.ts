import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { decodeJwtToken } from '@/lib/auth-jwt';
import { getComplaintById } from '@/lib/complaints-store';
import prisma from '@/lib/prisma';

export const maxDuration = 60;

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
    if (!payload || !payload.sub) {
      return NextResponse.json({ statusCode: 401, message: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, isSuspended: true, role: true },
    });

    if (!user || user.isSuspended) {
      return NextResponse.json({ statusCode: 403, message: 'Account is suspended or invalid.' }, { status: 403 });
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

export async function DELETE(
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
    if (!payload || !payload.sub) {
      return NextResponse.json({ statusCode: 401, message: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, isSuspended: true, role: true },
    });

    if (!user || user.isSuspended) {
      return NextResponse.json({ statusCode: 403, message: 'Account is suspended or invalid.' }, { status: 403 });
    }

    const { id } = params;
    const complaint = await prisma.complaint.findUnique({
      where: { id },
      select: { id: true, citizenId: true, status: true },
    });

    if (!complaint) {
      return NextResponse.json(
        { statusCode: 404, message: 'Complaint ticket not found' },
        { status: 404 },
      );
    }

    if (complaint.citizenId !== user.id) {
      return NextResponse.json(
        { statusCode: 403, message: 'Forbidden: You can only delete your own complaints.' },
        { status: 403 },
      );
    }

    const ALLOWED_DELETE_STATUSES = ['SUBMITTED', 'AI_PROCESSING', 'PENDING_DEPT_REVIEW'];
    if (!ALLOWED_DELETE_STATUSES.includes(complaint.status)) {
      return NextResponse.json(
        {
          statusCode: 400,
          message: 'This complaint is already being processed and can no longer be deleted.',
        },
        { status: 400 },
      );
    }

    await prisma.complaint.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: 'Complaint deleted successfully.',
    });
  } catch (error: any) {
    return NextResponse.json(
      { statusCode: 500, message: 'Internal server error', error: error.message },
      { status: 500 },
    );
  }
}
