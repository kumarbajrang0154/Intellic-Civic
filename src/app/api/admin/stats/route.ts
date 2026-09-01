import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { decodeJwtToken } from '@/lib/auth-jwt';
import { complaintsStore } from '@/lib/complaints-store';

export async function GET(req: NextRequest) {
  try {
    const cookieStore = cookies();
    const accessToken = cookieStore.get('ic_access_token')?.value;

    if (!accessToken) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const payload = decodeJwtToken(accessToken);
    if (!payload) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

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

    complaintsStore.forEach((c) => {
      if (statusBreakdown[c.status] !== undefined) {
        statusBreakdown[c.status]++;
      }
    });

    const needsTriageCount =
      statusBreakdown.SUBMITTED + statusBreakdown.PENDING_DEPT_REVIEW;

    return NextResponse.json({
      totalComplaints: complaintsStore.length,
      statusBreakdown,
      needsTriageCount,
      pendingUserApprovalsCount: 0,
      departmentCount: 6,
      totalStaffCount: 12,
    });
  } catch (error: any) {
    return NextResponse.json(
      { message: 'Failed to fetch admin stats', error: error.message },
      { status: 500 },
    );
  }
}
