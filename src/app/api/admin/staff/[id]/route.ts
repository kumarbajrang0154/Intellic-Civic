import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { removeStaff } from '@/services/staffService';

// DELETE /api/admin/staff/[id]
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdmin();
  if (!auth.authorized) return auth.response;

  const result = await removeStaff(params.id, auth.admin);
  if (!result.ok) {
    return NextResponse.json({ message: result.message }, { status: result.status });
  }

  return NextResponse.json({ deleted: true });
}
