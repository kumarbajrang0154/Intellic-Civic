import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { suspendUser } from '@/lib/staff-dept-store';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const auth = await requireAdmin();
    if (!auth.authorized) return auth.response;
    const body = await req.json().catch(() => ({}));
    const isSuspended = body.isSuspended !== undefined ? Boolean(body.isSuspended) : true;

    const updated = await suspendUser(params.id, isSuspended);
    if (!updated) {
      return NextResponse.json(
        { message: 'Super Admin accounts cannot be suspended, deactivated, or deleted.' },
        { status: 403 },
      );
    }

    return NextResponse.json(updated);
  } catch (error: any) {
    return NextResponse.json(
      { message: 'Failed to suspend/unsuspend user', error: error.message },
      { status: 500 },
    );
  }
}
