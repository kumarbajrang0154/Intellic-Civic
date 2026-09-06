import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import prisma from '@/lib/prisma';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const auth = await requireAdmin();
    if (!auth.authorized) return auth.response;

    const body = await req.json();
    const { name, description, departmentId } = body;

    const updated = await prisma.category.update({
      where: { id: params.id },
      data: {
        ...(name && { name: name.trim() }),
        ...(description && { description: description.trim() }),
        ...(departmentId && { departmentId }),
      },
    });

    return NextResponse.json({ success: true, category: updated });
  } catch (error: any) {
    return NextResponse.json(
      { message: 'Failed to update category', error: error.message },
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

    const complaintCount = await prisma.complaint.count({
      where: { categoryId: params.id },
    });

    if (complaintCount > 0) {
      return NextResponse.json(
        { message: `Cannot delete category: ${complaintCount} active complaints reference this category.` },
        { status: 400 },
      );
    }

    await prisma.category.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ success: true, message: 'Category deleted successfully' });
  } catch (error: any) {
    return NextResponse.json(
      { message: 'Failed to delete category', error: error.message },
      { status: 500 },
    );
  }
}
