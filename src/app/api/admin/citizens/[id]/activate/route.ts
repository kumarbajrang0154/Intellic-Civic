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

    if (!citizen.isSuspended && !citizen.deletedAt) {
      return NextResponse.json(
        { success: false, message: 'Citizen account is already active' },
        { status: 400 },
      );
    }

    const updated = await prisma.user.update({
      where: { id: citizenId },
      data: {
        isSuspended: false,
        suspendedAt: null,
        deletedAt: null,
      },
    });

    // Record Audit Log
    await addAuditLog({
      actorId: auth.admin.id,
      actorName: auth.admin.name,
      action: 'CITIZEN_ACTIVATE',
      entityType: 'CITIZEN',
      targetId: citizen.id,
      targetName: citizen.name || citizen.mobileNumber || citizen.email || citizen.id,
      metadata: {
        activatedAt: new Date().toISOString(),
        previousStatus: citizen.deletedAt ? 'DELETED' : 'SUSPENDED',
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Citizen account activated successfully',
      citizen: {
        id: updated.id,
        isSuspended: updated.isSuspended,
        deletedAt: null,
      },
    });
  } catch (error: any) {
    console.error('[API ADMIN CITIZEN ACTIVATE ERROR]', error);
    return NextResponse.json(
      { success: false, message: 'Failed to activate citizen account', error: error.message },
      { status: 500 },
    );
  }
}
