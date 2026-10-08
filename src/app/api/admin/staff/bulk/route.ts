import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import prisma from '@/lib/prisma';
import { isSuperAdminTarget } from '@/lib/staff-dept-store';
import { deactivateStaff, reactivateStaff, reassignStaff, removeStaff } from '@/services/staffService';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (!auth.authorized) return auth.response;

    const body = await req.json().catch(() => ({}));
    const { action, ids, departmentId } = body;

    if (!action || !['DEACTIVATE', 'SUSPEND', 'REACTIVATE', 'DELETE', 'REASSIGN_DEPT'].includes(action)) {
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

    const actorUser = await prisma.user.findUnique({
      where: { id: auth.admin.id },
      select: { id: true, role: true, municipalityId: true },
    });

    const results: Array<{ id: string; ok: boolean; error?: string; message?: string }> = [];

    for (const id of ids) {
      // 1. Check self
      if (id === auth.admin.id) {
        results.push({ id, ok: false, error: 'Cannot perform action on your own account.' });
        continue;
      }

      // 2. Check exists
      const target = await prisma.user.findUnique({
        where: { id },
        select: { id: true, role: true, email: true, municipalityId: true },
      });
      if (!target) {
        results.push({ id, ok: false, error: 'Staff member not found.' });
        continue;
      }

      // 3. Check not SUPER_ADMIN
      if ((target.role as string) === 'SUPER_ADMIN' || isSuperAdminTarget(target)) {
        results.push({ id, ok: false, error: 'Super Admin accounts are protected.' });
        continue;
      }

      // 4. Same municipality check
      if (actorUser?.municipalityId && target.municipalityId !== actorUser.municipalityId) {
        results.push({ id, ok: false, error: 'User belongs to a different municipality.' });
        continue;
      }

      // 5. Actor role hierarchy check
      if (auth.admin.role === 'ADMIN' && ((target.role as string) === 'ADMIN' || (target.role as string) === 'SUPER_ADMIN')) {
        results.push({ id, ok: false, error: 'Admin cannot modify Admin or Super Admin accounts.' });
        continue;
      }

      // 6. Action-specific processing
      try {
        if (action === 'DEACTIVATE' || action === 'SUSPEND') {
          const res = await deactivateStaff(id, auth.admin);
          if (res.ok) {
            results.push({ id, ok: true, message: 'Deactivated successfully' });
          } else {
            results.push({ id, ok: false, error: res.message });
          }
        } else if (action === 'REACTIVATE') {
          const res = await reactivateStaff(id, auth.admin);
          if (res.ok) {
            results.push({ id, ok: true, message: 'Reactivated successfully' });
          } else {
            results.push({ id, ok: false, error: res.message });
          }
        } else if (action === 'DELETE') {
          const res = await removeStaff(id, auth.admin);
          if (res.ok) {
            results.push({ id, ok: true, message: 'Deleted successfully' });
          } else {
            results.push({ id, ok: false, error: res.message });
          }
        } else if (action === 'REASSIGN_DEPT') {
          if (target.role === 'FIELD_WORKER') {
            results.push({ id, ok: false, error: 'needs officer in target department' });
            continue;
          }
          if (!departmentId) {
            results.push({ id, ok: false, error: 'Target department ID is required.' });
            continue;
          }
          const res = await reassignStaff(id, { newDepartmentId: departmentId }, auth.admin);
          if (res.ok) {
            results.push({ id, ok: true, message: 'Reassigned successfully' });
          } else {
            results.push({ id, ok: false, error: res.message });
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
      { message: 'Bulk staff operation failed', error: error.message },
      { status: 500 },
    );
  }
}
