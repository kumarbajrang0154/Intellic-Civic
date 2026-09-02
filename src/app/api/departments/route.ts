import { NextRequest, NextResponse } from 'next/server';
import { listComplaints } from '@/lib/complaints-store';
import { addDepartment, listDepartments, listUsers } from '@/lib/staff-dept-store';

export async function GET(req: NextRequest) {
  try {
    const departments = await listDepartments();
    const allUsers = await listUsers();
    const { data: allComplaints } = await listComplaints({ limit: 1000 });

    // Map staff counts and complaint counts
    const data = departments.map((dept) => {
      const staffCount = allUsers.filter((u) => u.departmentId === dept.id).length;
      const deptComplaints = allComplaints.filter(
        (c) => c.departmentId === dept.id || c.category?.departmentId === dept.id,
      );
      const activeComplaintCount = deptComplaints.filter((c) =>
        ['SUBMITTED', 'PENDING_DEPT_REVIEW', 'ASSIGNED', 'IN_PROGRESS'].includes(c.status),
      ).length;

      return {
        ...dept,
        staffCount,
        complaintCount: deptComplaints.length,
        activeComplaintCount,
      };
    });

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json(
      { message: 'Failed to fetch departments', error: error.message },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, description, headOfficeAddress } = body;

    if (!name || !name.trim()) {
      return NextResponse.json(
        { message: 'Department name is required' },
        { status: 400 },
      );
    }

    if (!description || !description.trim()) {
      return NextResponse.json(
        { message: 'Department description is required' },
        { status: 400 },
      );
    }

    const newDept = await addDepartment({
      name: name.trim(),
      description: description.trim(),
      headOfficeAddress: headOfficeAddress?.trim(),
    });

    return NextResponse.json(newDept, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { message: 'Failed to create department', error: error.message },
      { status: 500 },
    );
  }
}
