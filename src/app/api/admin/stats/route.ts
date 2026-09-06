import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import prisma from '@/lib/prisma';
import { ComplaintStatus, UserRole } from '@prisma/client';

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (!auth.authorized) return auth.response;

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

    const [totalComplaints, groupResults, activeDepts, authorizedStaffCount, pendingUserApprovalsCount] = await Promise.all([
      prisma.complaint.count(),
      prisma.complaint.groupBy({
        by: ['status'],
        _count: { status: true },
      }),
      prisma.department.count({ where: { isSuspended: false } }),
      prisma.user.count({
        where: {
          isAuthorized: true,
          isSuspended: false,
          role: { in: [UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.DEPARTMENT_HEAD, UserRole.DEPARTMENT_OFFICER, UserRole.FIELD_WORKER] },
        },
      }),
      prisma.user.count({
        where: {
          isAuthorized: false,
          role: { not: UserRole.ADMIN },
        },
      }),
    ]);

    groupResults.forEach((g) => {
      if (statusBreakdown[g.status] !== undefined) {
        statusBreakdown[g.status] = g._count.status;
      }
    });

    const needsTriageCount =
      statusBreakdown.SUBMITTED + statusBreakdown.PENDING_DEPT_REVIEW;

    return NextResponse.json({
      totalComplaints,
      statusBreakdown,
      needsTriageCount,
      pendingUserApprovalsCount,
      departmentCount: activeDepts,
      totalStaffCount: authorizedStaffCount,
    });
  } catch (error: any) {
    return NextResponse.json(
      { message: 'Failed to fetch admin stats', error: error.message },
      { status: 500 },
    );
  }
}
