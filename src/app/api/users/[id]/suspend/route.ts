import { NextRequest, NextResponse } from 'next/server';
import { suspendUser } from '@/lib/staff-dept-store';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const body = await req.json().catch(() => ({}));
    const isSuspended = body.isSuspended !== undefined ? Boolean(body.isSuspended) : true;

    const updated = await suspendUser(params.id, isSuspended);
    if (!updated) {
      return NextResponse.json({ message: 'User not found or protected' }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (error: any) {
    return NextResponse.json(
      { message: 'Failed to suspend/unsuspend user', error: error.message },
      { status: 500 },
    );
  }
}
