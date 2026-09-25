import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { rejectUser } from '@/lib/staff-dept-store';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const auth = await requireAdmin();
    if (!auth.authorized) return auth.response;
    const success = await rejectUser(params.id);
    if (!success) {
      return NextResponse.json(
        { message: 'Super Admin accounts cannot be suspended, deactivated, or deleted.' },
        { status: 403 },
      );
    }

    return NextResponse.json({ success: true, message: 'User rejected and removed' });
  } catch (error: any) {
    return NextResponse.json(
      { message: 'Failed to reject user', error: error.message },
      { status: 500 },
    );
  }
}
