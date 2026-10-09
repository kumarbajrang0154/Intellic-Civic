import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { reassignUserComplaints } from '@/services/staffService';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAdmin();
  if (!auth.authorized) return auth.response;

  let body: { targetStaffId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: 'Invalid JSON request body.' }, { status: 400 });
  }

  const { targetStaffId } = body;
  if (!targetStaffId) {
    return NextResponse.json({ message: 'targetStaffId is required.' }, { status: 400 });
  }

  const result = await reassignUserComplaints(params.id, targetStaffId, auth.admin);
  if (!result.ok) {
    return NextResponse.json({ message: result.message }, { status: result.status });
  }

  return NextResponse.json(result.data);
}
