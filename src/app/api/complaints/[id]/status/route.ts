import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { requireStaff } from '@/lib/admin-auth';
import prisma from '@/lib/prisma';
import { ComplaintStatus } from '@prisma/client';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const auth = await requireStaff(['SUPER_ADMIN', 'ADMIN', 'DEPARTMENT_HEAD', 'DEPARTMENT_OFFICER']);
    if (!auth.authorized) {
      return auth.response;
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

    // Cross-department isolation check for Department Head & Officer
    if (['DEPARTMENT_HEAD', 'DEPARTMENT_OFFICER'].includes(auth.user.role)) {
      if (auth.user.departmentId && currentComplaint.departmentId && auth.user.departmentId !== currentComplaint.departmentId) {
        return NextResponse.json(
          { statusCode: 403, message: 'Forbidden: Cannot alter status of complaints outside your assigned department.' },
          { status: 403 },
        );
      }
    }

    const updated = await prisma.complaint.update({
      where: { id },
      data: {
        status: status as ComplaintStatus,
        statusHistory: {
          create: {
            fromStatus: currentComplaint.status,
            toStatus: status as ComplaintStatus,
            changedByUserId: auth.user.id,
            notes: notes || `Status changed to ${status} by ${auth.user.name} (${auth.user.role})`,
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
