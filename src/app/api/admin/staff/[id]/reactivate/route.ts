import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { reactivateStaff } from '@/services/staffService';

// PATCH /api/admin/staff/[id]/reactivate
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireAdmin();
  if (!auth.authorized) return auth.response;

  const result = reactivateStaff(params.id, auth.admin);
  if (!result.ok) {
    return NextResponse.json({ message: result.message }, { status: result.status });
  }

  return NextResponse.json({ staff: result.data });
}
