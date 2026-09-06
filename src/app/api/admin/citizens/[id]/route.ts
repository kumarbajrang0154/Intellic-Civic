import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/admin-auth';
import { addAuditLog } from '@/lib/audit-store';
import prisma from '@/lib/prisma';
import { UserRole } from '@prisma/client';

export const dynamic = 'force-dynamic';

export async function GET(
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
      include: {
        complaints: {
          include: {
            category: { select: { name: true } },
            department: { select: { name: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!citizen) {
      return NextResponse.json(
        { success: false, message: 'Citizen profile not found' },
        { status: 404 },
      );
    }

    // Calculate status breakdown
    const breakdown: Record<string, number> = {
      SUBMITTED: 0,
      PENDING_DEPT_REVIEW: 0,
      IN_PROGRESS: 0,
      RESOLVED: 0,
      CLOSED: 0,
      REJECTED: 0,
      DUPLICATE: 0,
    };

    citizen.complaints.forEach((c) => {
      if (breakdown[c.status] !== undefined) {
        breakdown[c.status]++;
      } else {
        breakdown[c.status] = 1;
      }
    });

    return NextResponse.json({
      success: true,
      citizen: {
        id: citizen.id,
        name: citizen.name || 'Citizen',
        email: citizen.email || null,
        mobileNumber: citizen.mobileNumber || null,
        avatarUrl: citizen.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(citizen.name || citizen.id)}`,
        isAuthorized: citizen.isAuthorized,
        isSuspended: citizen.isSuspended,
        suspendedAt: citizen.suspendedAt ? citizen.suspendedAt.toISOString() : null,
        deletedAt: citizen.deletedAt ? citizen.deletedAt.toISOString() : null,
        lastLoginAt: citizen.lastLoginAt ? citizen.lastLoginAt.toISOString() : null,
        createdAt: citizen.createdAt.toISOString(),
        updatedAt: citizen.updatedAt.toISOString(),
      },
      stats: {
        totalComplaints: citizen.complaints.length,
        breakdown,
      },
      complaints: citizen.complaints.map((c) => ({
        id: c.id,
        ticketId: c.ticketId,
        title: c.title,
        status: c.status,
        priority: c.priority,
        categoryName: c.category?.name || 'General',
        departmentName: c.department?.name || 'Unassigned',
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
      })),
    });
  } catch (error: any) {
    console.error('[API ADMIN CITIZEN DETAIL ERROR]', error);
    return NextResponse.json(
      { success: false, message: 'Failed to fetch citizen profile', error: error.message },
      { status: 500 },
    );
  }
}

export async function DELETE(
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

    const now = new Date();

    const updated = await prisma.user.update({
      where: { id: citizenId },
      data: {
        deletedAt: now,
        isSuspended: true,
        suspendedAt: now,
      },
    });

    // Record Audit Log
    await addAuditLog({
      actorId: auth.admin.id,
      actorName: auth.admin.name,
      action: 'CITIZEN_DELETE',
      entityType: 'CITIZEN',
      targetId: citizen.id,
      targetName: citizen.name || citizen.mobileNumber || citizen.email || citizen.id,
      metadata: {
        deletedAt: now.toISOString(),
        previousStatus: citizen.isSuspended ? 'SUSPENDED' : 'ACTIVE',
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Citizen account soft-deleted successfully',
      citizen: {
        id: updated.id,
        deletedAt: updated.deletedAt?.toISOString(),
      },
    });
  } catch (error: any) {
    console.error('[API ADMIN CITIZEN DELETE ERROR]', error);
    return NextResponse.json(
      { success: false, message: 'Failed to delete citizen account', error: error.message },
      { status: 500 },
    );
  }
}
