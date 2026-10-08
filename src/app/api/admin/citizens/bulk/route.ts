import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import prisma from '@/lib/prisma';
import { isSuperAdminTarget } from '@/lib/staff-dept-store';
import { activateCitizen, deleteCitizen, suspendCitizen } from '@/services/citizenAdminService';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (!auth.authorized) return auth.response;

    const body = await req.json().catch(() => ({}));
    const { action, ids, reason } = body;

    if (!action || !['SUSPEND', 'ACTIVATE', 'DELETE'].includes(action)) {
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
        results.push({ id, ok: false, error: 'Citizen not found.' });
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
        if (action === 'SUSPEND') {
          const res = await suspendCitizen(id, reason || 'Administrative bulk action', auth.admin);
          if (res.ok) {
            results.push({ id, ok: true, message: 'Suspended successfully' });
          } else {
            results.push({ id, ok: false, error: res.message });
          }
        } else if (action === 'ACTIVATE') {
          const res = await activateCitizen(id, auth.admin);
          if (res.ok) {
            results.push({ id, ok: true, message: 'Activated successfully' });
          } else {
            results.push({ id, ok: false, error: res.message });
          }
        } else if (action === 'DELETE') {
          const res = await deleteCitizen(id, auth.admin);
          if (res.ok) {
            results.push({ id, ok: true, message: 'Deleted successfully' });
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
      { message: 'Bulk citizen operation failed', error: error.message },
      { status: 500 },
    );
  }
}
