import { NextRequest, NextResponse } from 'next/server';
import { requireStaff } from '@/lib/admin-auth';
import { assignFieldWorkerToComplaint, assignOfficerToComplaint, reassignComplaintDepartment } from '@/lib/complaints-store';
import prisma from '@/lib/prisma';

export async function POST(
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
    const { fieldWorkerId, assignedToId, officerId, assignedOfficerId, notes } = body;

    const targetOfficerId = officerId || assignedOfficerId;
    const targetWorkerId = fieldWorkerId || assignedToId;

    if (targetOfficerId) {
      const result = await assignOfficerToComplaint(id, targetOfficerId, auth.user.id, notes);
      if (!result.ok) {
        return NextResponse.json({ statusCode: result.status, message: result.message }, { status: result.status });
      }
      return NextResponse.json({ success: true, complaint: result.complaint });
    }

    if (!targetWorkerId) {
      return NextResponse.json({ statusCode: 400, message: 'Officer ID or Field Worker ID is required' }, { status: 400 });
    }

    const targetWorker = await prisma.user.findUnique({ where: { id: targetWorkerId } });
    if (targetWorker?.role === 'DEPARTMENT_OFFICER') {
      const result = await assignOfficerToComplaint(id, targetWorkerId, auth.user.id, notes);
      if (!result.ok) {
        return NextResponse.json({ statusCode: result.status, message: result.message }, { status: result.status });
      }
      return NextResponse.json({ success: true, complaint: result.complaint });
    }

    const targetName = targetWorker?.name || 'Field Worker';
    const result = await assignFieldWorkerToComplaint(id, targetWorkerId, targetName, auth.user.id, auth.user.role);
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
    const body = await request.json();
    const { departmentId, notes } = body;

    if (!departmentId) {
      return NextResponse.json({ statusCode: 400, message: 'Department ID is required' }, { status: 400 });
    }

    const result = await reassignComplaintDepartment({
      complaintId: id,
      departmentId,
      reassignedByUserId: auth.user.id,
      notes,
    });

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
