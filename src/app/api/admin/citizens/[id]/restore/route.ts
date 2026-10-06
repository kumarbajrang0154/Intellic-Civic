import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { addAuditLog } from '@/lib/audit-store';
import prisma from '@/lib/prisma';
import { UserRole } from '@prisma/client';

export const dynamic = 'force-dynamic';

async function handleRestore(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const auth = await requireAdmin();
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

    // Idempotent: if already active, return 200 without error
    if (!citizen.isSuspended && !citizen.deletedAt) {
      return NextResponse.json({
        success: true,
        message: 'Citizen account is already active',
        citizen: {
          id: citizen.id,
          isSuspended: false,
          deletedAt: null,
        },
      });
    }

    const previousStatus = citizen.deletedAt
      ? 'DELETED'
      : citizen.isSuspended
      ? 'SUSPENDED'
      : 'ACTIVE';

    const updated = await prisma.user.update({
      where: { id: citizenId },
      data: {
        isSuspended: false,
        suspendedAt: null,
        deletedAt: null,
      },
    });

    const now = new Date();
    await addAuditLog({
      actorId: auth.admin.id,
      actorName: auth.admin.name,
      action: 'CITIZEN_RESTORE',
      entityType: 'CITIZEN',
      targetId: citizen.id,
      targetName: citizen.name || citizen.mobileNumber || citizen.email || citizen.id,
      metadata: {
        restoredAt: now.toISOString(),
        previousStatus,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Citizen account restored successfully',
      citizen: {
        id: updated.id,
        isSuspended: false,
        deletedAt: null,
      },
    });
  } catch (error: any) {
    console.error('[API ADMIN CITIZEN RESTORE ERROR]', error);
    return NextResponse.json(
      { success: false, message: 'Failed to restore citizen account', error: error.message },
      { status: 500 },
    );
  }
}

export async function POST(
  req: NextRequest,
  context: { params: { id: string } },
) {
  return handleRestore(req, context);
}

export async function PATCH(
  req: NextRequest,
  context: { params: { id: string } },
) {
  return handleRestore(req, context);
}
