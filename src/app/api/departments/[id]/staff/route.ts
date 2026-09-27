import { NextRequest, NextResponse } from 'next/server';
import { listUsers } from '@/lib/staff-dept-store';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const { searchParams } = new URL(request.url);
    const assignedOfficerId = searchParams.get('assignedOfficerId') || undefined;
    const role = searchParams.get('role') || undefined;

    const { id } = params;
    const departmentId = id.toLowerCase() === 'all' ? undefined : id;
    const users = await listUsers({ departmentId, assignedOfficerId, role });

    const department = departmentId
      ? await (await import('@/lib/prisma')).default.department.findUnique({ where: { id: departmentId } })
      : { id: 'all', name: 'All Municipal Departments' };

    return NextResponse.json({
      department,
      officers: users
        .filter((u) => u.role === 'DEPARTMENT_OFFICER')
        .map((u) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          role: u.role,
          isAuthorized: u.isAuthorized,
          isSuspended: u.isSuspended,
          assignedOfficerId: u.assignedOfficerId,
          createdAt: u.createdAt,
        })),
      fieldWorkers: users
        .filter((u) => u.role === 'FIELD_WORKER')
        .map((u) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          role: u.role,
          assignedOfficerId: u.assignedOfficerId,
          createdAt: u.createdAt,
        })),
    });
  } catch (error: any) {
    return NextResponse.json(
      { statusCode: 500, message: 'Internal server error', error: error.message },
      { status: 500 },
    );
  }
}
