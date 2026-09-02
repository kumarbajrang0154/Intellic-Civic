import { NextRequest, NextResponse } from 'next/server';
import { listComplaints } from '@/lib/complaints-store';
import { listDepartments, listUsers } from '@/lib/staff-dept-store';

export async function GET(req: NextRequest) {
  try {
    const statusBreakdown: Record<string, number> = {
      SUBMITTED: 0,
      PENDING_DEPT_REVIEW: 0,
      ASSIGNED: 0,
      IN_PROGRESS: 0,
      RESOLVED: 0,
      CLOSED: 0,
      REJECTED: 0,
      DUPLICATE: 0,
    };

    const { data: allComplaints } = await listComplaints({ limit: 1000 });

    allComplaints.forEach((c) => {
      if (statusBreakdown[c.status] !== undefined) {
        statusBreakdown[c.status]++;
      }
    });

    const needsTriageCount =
      statusBreakdown.SUBMITTED + statusBreakdown.PENDING_DEPT_REVIEW;

    const departments = await listDepartments();
    const activeDepts = departments.filter((d) => !d.isSuspended).length;
    const allUsers = await listUsers();
    const authorizedStaff = allUsers.filter((u) => u.isAuthorized && !u.isSuspended);
    const pendingUsers = await listUsers({ pendingOnly: true });

    return NextResponse.json({
      totalComplaints: allComplaints.length,
      statusBreakdown,
      needsTriageCount,
      pendingUserApprovalsCount: pendingUsers.length,
      departmentCount: activeDepts,
      totalStaffCount: authorizedStaff.length,
    });
  } catch (error: any) {
    return NextResponse.json(
      { message: 'Failed to fetch admin stats', error: error.message },
      { status: 500 },
    );
  }
}
