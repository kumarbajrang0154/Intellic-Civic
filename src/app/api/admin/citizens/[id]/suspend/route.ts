import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/admin-auth';
import { addAuditLog } from '@/lib/audit-store';
import prisma from '@/lib/prisma';
import { UserRole } from '@prisma/client';

export const dynamic = 'force-dynamic';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const auth = await requireSuperAdmin();
    if (!auth.authorized) return auth.response;

    const citizenId = params.id;
    let reason = 'Administrative action';
    try {
      const body = await req.json();
      if (body.reason) reason = body.reason;
    } catch {
      // Body optional
    }

    const citizen = await prisma.user.findFirst({
      where: {
        id: citizenId,
        role: UserRole.CITIZEN,
      },
    });

    if (!citizen) {
      return NextResponse.json(
        { success: false, message: 'Citizen profile not found' },
        { status: 404 },
      );
    }

    if (citizen.isSuspended) {
      return NextResponse.json(
        { success: false, message: 'Citizen account is already suspended' },
        { status: 400 },
      );
    }

    const now = new Date();

    const updated = await prisma.user.update({
      where: { id: citizenId },
      data: {
        isSuspended: true,
        suspendedAt: now,
      },
    });

    // Record Audit Log
    await addAuditLog({
      actorId: auth.admin.id,
      actorName: auth.admin.name,
      action: 'CITIZEN_SUSPEND',
      entityType: 'CITIZEN',
      targetId: citizen.id,
      targetName: citizen.name || citizen.mobileNumber || citizen.email || citizen.id,
      metadata: {
        suspendedAt: now.toISOString(),
        reason,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Citizen account suspended successfully',
      citizen: {
        id: updated.id,
        isSuspended: updated.isSuspended,
        suspendedAt: updated.suspendedAt?.toISOString(),
      },
    });
  } catch (error: any) {
    console.error('[API ADMIN CITIZEN SUSPEND ERROR]', error);
    return NextResponse.json(
      { success: false, message: 'Failed to suspend citizen account', error: error.message },
      { status: 500 },
    );
  }
}
