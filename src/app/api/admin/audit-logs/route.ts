import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import prisma from '@/lib/prisma';
import { UserRole } from '@prisma/client';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (!auth.authorized) return auth.response;

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
    const actorRole = searchParams.get('actorRole') || searchParams.get('role') || undefined;

    const skip = (page - 1) * limit;

    const whereCondition: any = {};

    if (actorRole && Object.values(UserRole).includes(actorRole as UserRole)) {
      whereCondition.user = {
        role: actorRole as UserRole,
      };
    }

    const [total, logs] = await Promise.all([
      prisma.auditLog.count({ where: whereCondition }),
      prisma.auditLog.findMany({
        where: whereCondition,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    const items = logs.map((log) => ({
      id: log.id,
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId || null,
      metadata: log.metadata || null,
      createdAt: log.createdAt.toISOString(),
      user: log.user
        ? {
            id: log.user.id,
            name: log.user.name,
            email: log.user.email || null,
            role: log.user.role || 'USER',
          }
        : null,
    }));

    return NextResponse.json({
      success: true,
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    });
  } catch (error: any) {
    console.error('[API ADMIN AUDIT LOGS ERROR]', error);
    return NextResponse.json(
      { success: false, message: 'Failed to fetch audit logs', error: error.message },
      { status: 500 },
    );
  }
}
