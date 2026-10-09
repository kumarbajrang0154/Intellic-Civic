import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { approveUser } from '@/lib/staff-dept-store';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const auth = await requireAdmin();
    if (!auth.authorized) return auth.response;
    const body = await req.json().catch(() => ({}));
    const { role, departmentId } = body;

    const targetRole = role || 'DEPARTMENT_OFFICER';
    const needsDept = targetRole === 'DEPARTMENT_OFFICER' || targetRole === 'FIELD_WORKER';
    const approved = await approveUser(params.id, targetRole, needsDept ? departmentId : null);
    if (!approved) {
      return NextResponse.json({ message: 'User not found' }, { status: 404 });
    }

    const { addAuditLog } = await import('@/lib/audit-store');
    await addAuditLog({
      actorId: auth.admin.id,
      actorName: auth.admin.name,
      action: 'USER_APPROVED',
      entityType: 'User',
      targetId: approved.id,
      targetName: approved.name,
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
