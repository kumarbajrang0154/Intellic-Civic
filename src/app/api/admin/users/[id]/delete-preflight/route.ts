import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getDeletePreflight, assertCanManageStaff } from '@/services/staffService';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAdmin();
  if (!auth.authorized) return auth.response;

  const target = await prisma.user.findUnique({
    where: { id: params.id },
  });
  if (!target) {
    return NextResponse.json({ message: 'User not found.' }, { status: 404 });
  }

  // Permission check: block unauthorized preflight inspection
  const manageCheck = await assertCanManageStaff(auth.admin, target, 'delete');
  if (!manageCheck.allowed && manageCheck.status === 403) {
    return NextResponse.json({ message: manageCheck.message }, { status: 403 });
  }

  const preflight = await getDeletePreflight(params.id, auth.admin);
  if (!preflight) {
    return NextResponse.json({ message: 'User not found.' }, { status: 404 });
  }

  return NextResponse.json(preflight);
}

