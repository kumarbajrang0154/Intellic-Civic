import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { createStaff, listStaff, type StaffRole } from '@/services/staffService';

// GET /api/admin/staff — list staff with filters + pagination
export async function GET(req: NextRequest) {
  const auth = requireAdmin();
  if (!auth.authorized) return auth.response;

  const { searchParams } = new URL(req.url);
  const result = listStaff({
    search: searchParams.get('search') ?? undefined,
    role: searchParams.get('role') ?? undefined,
    departmentId: searchParams.get('departmentId') ?? undefined,
    status: (searchParams.get('status') as 'active' | 'inactive' | 'all') ?? 'all',
    page: parseInt(searchParams.get('page') ?? '1', 10),
    limit: parseInt(searchParams.get('limit') ?? '20', 10),
  });

  if (!result.ok) {
    return NextResponse.json({ message: result.message }, { status: result.status });
  }

  return NextResponse.json(result.data);
}

// POST /api/admin/staff — create a new staff account
export async function POST(req: NextRequest) {
  const auth = requireAdmin();
  if (!auth.authorized) return auth.response;

  let body: { name?: string; email?: string; role?: string; departmentId?: string | null };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: 'Invalid request body.' }, { status: 400 });
  }

  const { name, email, role, departmentId } = body;

  if (!name || !email || !role) {
    return NextResponse.json({ message: 'name, email, and role are required.' }, { status: 400 });
  }

  const result = createStaff(
    { name, email, role: role as StaffRole, departmentId },
    auth.admin,
  );

  if (!result.ok) {
    return NextResponse.json({ message: result.message }, { status: result.status });
  }

  return NextResponse.json({ staff: result.data }, { status: 201 });
}
