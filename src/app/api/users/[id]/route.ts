import { NextRequest, NextResponse } from 'next/server';
import { deleteUser, getUser, updateUser } from '@/lib/staff-dept-store';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
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
    const body = await req.json();
    const updated = await updateUser(params.id, body);

    if (!updated) {
      return NextResponse.json({ message: 'User not found' }, { status: 404 });
    }

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
    const deleted = await deleteUser(params.id);
    if (!deleted) {
      return NextResponse.json(
        { message: 'Failed to delete user or Super Admin protected' },
        { status: 400 },
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
