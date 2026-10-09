import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getDeletePreflight } from '@/services/staffService';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAdmin();
  if (!auth.authorized) return auth.response;

  const preflight = await getDeletePreflight(params.id, auth.admin.id);
  if (!preflight) {
    return NextResponse.json({ message: 'User not found.' }, { status: 404 });
  }

  return NextResponse.json(preflight);
}
