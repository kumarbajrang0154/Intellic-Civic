import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import prisma from '@/lib/prisma';
import {
  approveUser,
  rejectUser,
  assertCanManageStaff,
  logPrivilegedStaffAction,
} from '@/lib/staff-dept-store';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (!auth.authorized) return auth.response;

    const body = await req.json().catch(() => ({}));
    const { action, ids, role, departmentId } = body;

    if (!action || !['APPROVE', 'REJECT'].includes(action)) {
      return NextResponse.json({ message: 'Invalid or missing action' }, { status: 400 });
    }

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ message: 'No IDs provided' }, { status: 400 });
    }

    if (ids.length > 25) {
      return NextResponse.json(
        { message: 'Batch limit exceeded: maximum 25 IDs allowed per call.' },
        { status: 400 },
      );
    }

    const results: Array<{ id: string; ok: boolean; error?: string; message?: string }> = [];

    for (const id of ids) {
      // 1. Check exists
      const target = await prisma.user.findUnique({
        where: { id },
        select: { id: true, name: true, email: true, role: true, municipalityId: true },
      });
      if (!target) {
        results.push({ id, ok: false, error: 'User not found.' });
        continue;
      }

      // 2. Permission check
      const manageAction = action === 'APPROVE' ? 'approve' : 'reject';
      const manageCheck = await assertCanManageStaff(auth.admin, target, manageAction as any);
      if (!manageCheck.allowed) {
        results.push({ id, ok: false, error: manageCheck.message || 'Operation not permitted.' });
        continue;
      }

      // 3. Action-specific processing
      try {
        if (action === 'APPROVE') {
          const approvedRole = role || 'DEPARTMENT_OFFICER';
          const needsDept = approvedRole === 'DEPARTMENT_OFFICER' || approvedRole === 'FIELD_WORKER';
          const deptToAssign = needsDept ? departmentId : null;
          const approved = await approveUser(id, approvedRole, deptToAssign);
          if (approved) {
            await logPrivilegedStaffAction({
              actor: auth.admin,
              target,
              action: 'STAFF_APPROVED',
              metadata: { role: approvedRole, departmentId: deptToAssign },
            });
            results.push({ id, ok: true, message: 'Approved successfully' });
          } else {
            results.push({ id, ok: false, error: 'Failed to approve user' });
          }
        } else if (action === 'REJECT') {
          const success = await rejectUser(id);
          if (success) {
            await logPrivilegedStaffAction({
              actor: auth.admin,
              target,
              action: 'STAFF_REJECTED',
              metadata: { email: target.email },
            });
            results.push({ id, ok: true, message: 'Rejected successfully' });
          } else {
            results.push({ id, ok: false, error: 'Failed to reject user' });
          }
        }
      } catch (err: any) {
        results.push({ id, ok: false, error: err.message || 'Internal error' });
      }
    }

    const succeeded = results.filter((r) => r.ok).length;
    const failed = results.filter((r) => !r.ok).length;

    return NextResponse.json({
      ok: true,
      processed: results.length,
      succeeded,
      failed,
      results,
    });
  } catch (error: any) {
    return NextResponse.json(
      { message: 'Bulk pending user operation failed', error: error.message },
      { status: 500 },
    );
  }
}
