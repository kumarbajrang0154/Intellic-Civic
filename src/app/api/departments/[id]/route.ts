import { NextRequest, NextResponse } from 'next/server';
import {
  deleteDepartment,
  getDepartment,
  updateDepartment,
} from '@/lib/staff-dept-store';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const dept = getDepartment(params.id);
    if (!dept) {
      return NextResponse.json({ message: 'Department not found' }, { status: 404 });
    }
    return NextResponse.json(dept);
  } catch (error: any) {
    return NextResponse.json(
      { message: 'Failed to fetch department', error: error.message },
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
    const updated = updateDepartment(params.id, body);

    if (!updated) {
      return NextResponse.json({ message: 'Department not found' }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (error: any) {
    return NextResponse.json(
      { message: 'Failed to update department', error: error.message },
      { status: 500 },
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const deleted = deleteDepartment(params.id);
    if (!deleted) {
      return NextResponse.json({ message: 'Department not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'Department deleted successfully' });
  } catch (error: any) {
    return NextResponse.json(
      { message: 'Failed to delete department', error: error.message },
      { status: 500 },
    );
  }
}
