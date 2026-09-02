import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getStaffActivity } from '@/services/staffService';

// GET /api/admin/staff/[id]/activity
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = requireAdmin();
  if (!auth.authorized) return auth.response;

  const { searchParams } = new URL(req.url);
  const limit = parseInt(searchParams.get('limit') ?? '50', 10);

  const result = getStaffActivity(params.id, limit);
  if (!result.ok) {
    return NextResponse.json({ message: result.message }, { status: result.status });
  }

  return NextResponse.json({ activity: result.data });
}
