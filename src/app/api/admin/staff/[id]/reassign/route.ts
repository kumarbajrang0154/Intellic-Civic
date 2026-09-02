import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { reassignStaff, type StaffRole } from '@/services/staffService';

// PATCH /api/admin/staff/[id]/reassign
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireAdmin();
  if (!auth.authorized) return auth.response;

  let body: { newRole?: string; newDepartmentId?: string | null };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: 'Invalid request body.' }, { status: 400 });
  }

  if (!body.newRole && body.newDepartmentId === undefined) {
    return NextResponse.json({ message: 'At least one of newRole or newDepartmentId is required.' }, { status: 400 });
  }

  const result = reassignStaff(
    params.id,
    { newRole: body.newRole as StaffRole | undefined, newDepartmentId: body.newDepartmentId },
    auth.admin,
  );

  if (!result.ok) {
    return NextResponse.json({ message: result.message }, { status: result.status });
  }

  return NextResponse.json({ staff: result.data });
}
