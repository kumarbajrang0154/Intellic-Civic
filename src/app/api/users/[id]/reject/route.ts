import { NextRequest, NextResponse } from 'next/server';
import { rejectUser } from '@/lib/staff-dept-store';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const success = rejectUser(params.id);
    if (!success) {
      return NextResponse.json({ message: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'User rejected and removed' });
  } catch (error: any) {
    return NextResponse.json(
      { message: 'Failed to reject user', error: error.message },
      { status: 500 },
    );
  }
}
