import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { convertUserToStaff, type StaffRole } from '@/services/staffService';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAdmin();
  if (!auth.authorized) return auth.response;

  let body: { role?: string; departmentId?: string | null; assignedOfficerId?: string | null };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: 'Invalid JSON request body.' }, { status: 400 });
  }

  const { role, departmentId, assignedOfficerId } = body;
  if (!role) {
    return NextResponse.json({ message: 'role is required.' }, { status: 400 });
  }

  const result = await convertUserToStaff(
    params.id,
    { role: role as StaffRole, departmentId, assignedOfficerId },
    auth.admin,
  );

  if (!result.ok) {
    return NextResponse.json({ message: result.message }, { status: result.status });
  }

  return NextResponse.json(result.data);
}
