import { NextRequest, NextResponse } from 'next/server';
import { listUsers } from '@/lib/staff-dept-store';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const { id } = params;
    const officers = await listUsers({ departmentId: id });

    return NextResponse.json({
      officers: officers.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        isAuthorized: u.isAuthorized,
        isSuspended: u.isSuspended,
      })),
    });
  } catch (error: any) {
    return NextResponse.json(
      { statusCode: 500, message: 'Internal server error', error: error.message },
      { status: 500 },
    );
  }
}
