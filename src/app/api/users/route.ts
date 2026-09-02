import { NextRequest, NextResponse } from 'next/server';
import { addUser, getDepartment, listUsers } from '@/lib/staff-dept-store';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const role = searchParams.get('role') || undefined;
    const departmentId = searchParams.get('departmentId') || undefined;
    const pendingOnly = searchParams.get('pendingOnly') === 'true';
    const search = searchParams.get('search') || undefined;

    const users = await listUsers({ role, departmentId, pendingOnly, search });

    const data = await Promise.all(
      users.map(async (u) => {
        const dept = u.departmentId ? await getDepartment(u.departmentId) : undefined;
        return {
          ...u,
          department: dept ? { id: dept.id, name: dept.name } : undefined,
        };
      }),
    );

    return NextResponse.json({ data });
  } catch (error: any) {
    return NextResponse.json(
      { message: 'Failed to fetch users', error: error.message },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, email, role, departmentId } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ message: 'Name is required' }, { status: 400 });
    }

    if (!email || !email.trim()) {
      return NextResponse.json({ message: 'Email is required' }, { status: 400 });
    }

    const newUser = await addUser({
      name: name.trim(),
      email: email.trim(),
      role: role || 'DEPARTMENT_OFFICER',
      departmentId: role === 'ADMIN' ? null : departmentId,
      isAuthorized: true,
    });

    return NextResponse.json(newUser, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { message: 'Failed to create user', error: error.message },
      { status: 500 },
    );
  }
}
