import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { getWorkloadSummary } from '@/services/staffService';

// GET /api/admin/staff/workload-summary
export async function GET(req: NextRequest) {
  const auth = requireAdmin();
  if (!auth.authorized) return auth.response;

  const result = getWorkloadSummary();
  if (!result.ok) {
    return NextResponse.json({ message: result.message }, { status: result.status });
  }

  return NextResponse.json({ workload: result.data });
}
