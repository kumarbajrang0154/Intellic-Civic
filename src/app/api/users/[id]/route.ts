import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { deleteUser, getUser, updateUser } from '@/lib/staff-dept-store';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const auth = await requireAdmin();
    if (!auth.authorized) return auth.response;

    const user = await getUser(params.id);
    if (!user) {
      return NextResponse.json({ message: 'User not found' }, { status: 404 });
    }
    return NextResponse.json(user);
  } catch (error: any) {
    return NextResponse.json(
      { message: 'Failed to fetch user', error: error.message },
      { status: 500 },
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const auth = await requireAdmin();
    if (!auth.authorized) return auth.response;

    const targetUser = await getUser(params.id);
    if (!targetUser) {
      return NextResponse.json({ message: 'User not found' }, { status: 404 });
    }

    const body = await req.json();

    if (
      (targetUser.role === 'ADMIN' || targetUser.role === 'SUPER_ADMIN') &&
      (body.isSuspended === true || body.isAuthorized === false || (body.role && body.role !== 'ADMIN' && body.role !== 'SUPER_ADMIN'))
    ) {
      return NextResponse.json(
        { message: 'Super Admin accounts cannot be suspended, deactivated, or deleted.' },
        { status: 403 },
      );
    }

    const updated = await updateUser(params.id, body);
    return NextResponse.json(updated);
  } catch (error: any) {
    if (error?.code === 'P2002' || error?.message?.includes('P2002') || error?.message?.includes('Unique constraint failed')) {
      return NextResponse.json(
        { message: 'This email or mobile number is already associated with another account.', error: error.message },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { message: 'Failed to update user', error: error.message },
      { status: 500 },
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const auth = await requireAdmin();
    if (!auth.authorized) return auth.response;

    const targetUser = await getUser(params.id);
    if (!targetUser) {
      return NextResponse.json({ message: 'User not found' }, { status: 404 });
    }

    if (targetUser.role === 'ADMIN' || targetUser.role === 'SUPER_ADMIN') {
      return NextResponse.json(
        { message: 'Super Admin accounts cannot be suspended, deactivated, or deleted.' },
        { status: 403 },
      );
    }

    const deleted = await deleteUser(params.id);
    if (!deleted) {
      return NextResponse.json(
        { message: 'Super Admin accounts cannot be suspended, deactivated, or deleted.' },
        { status: 403 },
      );
    }

    return NextResponse.json({ success: true, message: 'User deleted successfully' });
  } catch (error: any) {
    return NextResponse.json(
      { message: 'Failed to delete user', error: error.message },
      { status: 500 },
    );
  }
}
