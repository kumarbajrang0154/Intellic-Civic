import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/admin-auth';
import prisma from '@/lib/prisma';
import { UserRole } from '@prisma/client';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const auth = await requireSuperAdmin();
    if (!auth.authorized) return auth.response;

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
    const search = (searchParams.get('search') || '').trim();
    const status = (searchParams.get('status') || 'ALL').toUpperCase();

    const skip = (page - 1) * limit;

    // Build Prisma query condition for citizens
    const whereCondition: any = {
      role: UserRole.CITIZEN,
    };

    // Filter by status
    if (status === 'ACTIVE') {
      whereCondition.isSuspended = false;
      whereCondition.deletedAt = null;
    } else if (status === 'SUSPENDED') {
      whereCondition.isSuspended = true;
      whereCondition.deletedAt = null;
    } else if (status === 'DELETED') {
      whereCondition.deletedAt = { not: null };
    } else {
      // ALL by default excludes soft-deleted unless explicitly filtered
      whereCondition.deletedAt = null;
    }

    // Search condition
    if (search) {
      whereCondition.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { mobileNumber: { contains: search, mode: 'insensitive' } },
        { id: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [total, citizens] = await Promise.all([
      prisma.user.count({ where: whereCondition }),
      prisma.user.findMany({
        where: whereCondition,
        select: {
          id: true,
          name: true,
          email: true,
          mobileNumber: true,
          avatarUrl: true,
          isAuthorized: true,
          isSuspended: true,
          suspendedAt: true,
          deletedAt: true,
          lastLoginAt: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: { complaints: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    return NextResponse.json({
      success: true,
      data: citizens.map((c) => ({
        id: c.id,
        name: c.name || 'Citizen',
        email: c.email || null,
        mobileNumber: c.mobileNumber || null,
        avatarUrl: c.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(c.name || c.id)}`,
        isAuthorized: c.isAuthorized,
        isSuspended: c.isSuspended,
        suspendedAt: c.suspendedAt ? c.suspendedAt.toISOString() : null,
        deletedAt: c.deletedAt ? c.deletedAt.toISOString() : null,
        lastLoginAt: c.lastLoginAt ? c.lastLoginAt.toISOString() : null,
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
        totalComplaints: c._count.complaints,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    });
  } catch (error: any) {
    console.error('[API ADMIN CITIZENS LIST ERROR]', error);
    return NextResponse.json(
      { success: false, message: 'Failed to fetch citizens', error: error.message },
      { status: 500 },
    );
  }
}
