import { NextRequest, NextResponse } from 'next/server';
import { requireStaff } from '@/lib/admin-auth';
import { verifyAiTriage } from '@/lib/complaints-store';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const auth = await requireStaff(['SUPER_ADMIN', 'ADMIN', 'DEPARTMENT_HEAD']);
    if (!auth.authorized) {
      return auth.response;
    }

    const { id } = params;
    const body = await request.json().catch(() => ({}));
    const { departmentId, categoryId, priority, notes } = body;

    const existingComplaint = await (await import('@/lib/prisma')).default.complaint.findUnique({
      where: { id },
      include: { aiPrediction: true },
    });
    if (!existingComplaint) {
      return NextResponse.json({ statusCode: 404, message: 'Complaint ticket not found' }, { status: 404 });
    }

    let targetDeptId =
      departmentId ||
      existingComplaint.aiPrediction?.suggestedDepartmentId ||
      existingComplaint.aiRecommendedDepartmentId ||
      existingComplaint.departmentId ||
      auth.user.departmentId;

    if (!targetDeptId && (categoryId || existingComplaint.categoryId)) {
      const cat = await (await import('@/lib/prisma')).default.category.findUnique({
        where: { id: categoryId || existingComplaint.categoryId || undefined },
      });
      if (cat?.departmentId) {
        targetDeptId = cat.departmentId;
      }
    }

    if (!targetDeptId) {
      return NextResponse.json(
        { statusCode: 400, message: 'Department ID is required to verify triage.' },
        { status: 400 },
      );
    }

    const result = await verifyAiTriage({
      complaintId: id,
      departmentId: targetDeptId,
      categoryId,
      priority,
      verifiedByUserId: auth.user.id,
      notes,
    });

    if (!result.ok) {
      return NextResponse.json({ statusCode: result.status, message: result.message }, { status: result.status });
    }

    return NextResponse.json({ success: true, complaint: result.complaint });
  } catch (error: any) {
    return NextResponse.json(
      { statusCode: 500, message: 'Internal server error', error: error.message },
      { status: 500 },
    );
  }
}
