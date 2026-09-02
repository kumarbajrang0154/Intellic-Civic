import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { deactivateStaff } from '@/services/staffService';

// PATCH /api/admin/staff/[id]/deactivate
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdmin();
  if (!auth.authorized) return auth.response;

  const result = await deactivateStaff(params.id, auth.admin);
  if (!result.ok) {
    return NextResponse.json({ message: result.message }, { status: result.status });
  }

  return NextResponse.json({ staff: result.data });
}
