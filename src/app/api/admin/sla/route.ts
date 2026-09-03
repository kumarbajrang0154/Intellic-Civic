import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';

const DEFAULT_SLA = [
  { priority: 'CRITICAL' as const, resolutionHours: 24, label: '24 hours' },
  { priority: 'HIGH' as const, resolutionHours: 72, label: '3 days' },
  { priority: 'MEDIUM' as const, resolutionHours: 168, label: '7 days' },
  { priority: 'LOW' as const, resolutionHours: 336, label: '14 days' },
];

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.authorized) return auth.response;

  try {
    const rules = await prisma.slaRule.findMany({
      orderBy: { priority: 'asc' },
    });

    // If no rules in DB, seed them
    if (rules.length === 0) {
      const seeded = await Promise.all(
        DEFAULT_SLA.map((r) =>
          prisma.slaRule.create({ data: r }),
        ),
      );
      return NextResponse.json({ rules: seeded });
    }

    return NextResponse.json({ rules });
  } catch (error: any) {
    return NextResponse.json(
      { message: 'Failed to fetch SLA rules', error: error.message },
      { status: 500 },
    );
  }
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.authorized) return auth.response;

  try {
    const body = await req.json();
    const { rules } = body as {
      rules: Record<string, number>; // priority -> hours
    };

    if (!rules || typeof rules !== 'object') {
      return NextResponse.json({ message: 'Invalid rules payload' }, { status: 400 });
    }

    const updated = await Promise.all(
      Object.entries(rules).map(([priority, hours]) => {
        const h = Math.max(1, Math.round(Number(hours)));
        const label =
          h >= 24 ? `${Math.round(h / 24)} day${Math.round(h / 24) !== 1 ? 's' : ''}` : `${h}h`;
        return prisma.slaRule.upsert({
          where: { priority: priority as any },
          update: { resolutionHours: h, label },
          create: { priority: priority as any, resolutionHours: h, label },
        });
      }),
    );

    return NextResponse.json({ rules: updated });
  } catch (error: any) {
    return NextResponse.json(
      { message: 'Failed to update SLA rules', error: error.message },
      { status: 500 },
    );
  }
}
