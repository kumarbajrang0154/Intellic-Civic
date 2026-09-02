import { NextRequest, NextResponse } from 'next/server';
import { approveUser } from '@/lib/staff-dept-store';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const body = await req.json().catch(() => ({}));
    const { role, departmentId } = body;

    const approved = await approveUser(params.id, role || 'DEPARTMENT_OFFICER', departmentId);
    if (!approved) {
      return NextResponse.json({ message: 'User not found' }, { status: 404 });
    }

    return NextResponse.json(approved);
  } catch (error: any) {
    return NextResponse.json(
      { message: 'Failed to approve user', error: error.message },
      { status: 500 },
    );
  }
}
