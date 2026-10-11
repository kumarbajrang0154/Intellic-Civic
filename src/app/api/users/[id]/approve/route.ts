import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { approveUser, assertCanManageStaff, getUser, logPrivilegedStaffAction } from '@/lib/staff-dept-store';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const auth = await requireAdmin();
    if (!auth.authorized) return auth.response;

    const target = await getUser(params.id);
    if (!target) {
      return NextResponse.json({ message: 'User not found' }, { status: 404 });
    }

    const manageCheck = await assertCanManageStaff(auth.admin, target, 'approve');
    if (!manageCheck.allowed) {
      return NextResponse.json({ message: manageCheck.message || 'Cannot approve this user.' }, { status: manageCheck.status });
    }

    const body = await req.json().catch(() => ({}));
    const { role, departmentId } = body;

    const targetRole = role || 'DEPARTMENT_OFFICER';
    const needsDept = targetRole === 'DEPARTMENT_OFFICER' || targetRole === 'FIELD_WORKER';
    const approved = await approveUser(params.id, targetRole, needsDept ? departmentId : null);
    if (!approved) {
      return NextResponse.json({ message: 'User not found' }, { status: 404 });
    }

    await logPrivilegedStaffAction({
      actor: auth.admin,
      target: approved,
      action: 'USER_APPROVED',
      metadata: { role: approved.role, departmentId: approved.departmentId },
    });

    return NextResponse.json(approved);
  } catch (error: any) {
    return NextResponse.json(
      { message: 'Failed to approve user', error: error.message },
      { status: 500 },
    );
  }
}
