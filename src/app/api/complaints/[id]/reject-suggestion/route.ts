import { NextRequest, NextResponse } from 'next/server';
import { requireStaff } from '@/lib/admin-auth';
import prisma from '@/lib/prisma';
import { ComplaintStatus } from '@prisma/client';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const auth = await requireStaff(['SUPER_ADMIN', 'ADMIN', 'DEPARTMENT_HEAD']);
    if (!auth.authorized) {
      return auth.response;
    }

    const { id } = params;
    const complaint = await prisma.complaint.findUnique({ where: { id } });
    if (!complaint) {
      return NextResponse.json({ statusCode: 404, message: 'Complaint not found.' }, { status: 404 });
    }

    const updated = await prisma.complaint.update({
      where: { id },
      data: {
        departmentId: null,
        status: ComplaintStatus.SUBMITTED,
        statusHistory: {
          create: {
            fromStatus: complaint.status,
            toStatus: ComplaintStatus.SUBMITTED,
            changedByUserId: auth.user.id,
            notes: 'AI suggestion rejected by Department Head ("Not My Department"). Returned to Admin Triage Queue.',
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: 'AI suggestion rejected. Complaint returned to Admin Triage Queue.',
      complaint: updated,
    });
  } catch (error: any) {
    return NextResponse.json(
      { statusCode: 500, message: 'Internal server error', error: error.message },
      { status: 500 },
    );
  }
}
