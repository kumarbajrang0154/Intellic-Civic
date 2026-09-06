import { NextRequest, NextResponse } from 'next/server';
import { listCategories } from '@/lib/complaints-store';
import { requireAdmin } from '@/lib/admin-auth';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    const categories = await listCategories();
    return NextResponse.json(categories);
  } catch (error: any) {
    return NextResponse.json(
      { message: 'Failed to fetch categories', error: error.message },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (!auth.authorized) return auth.response;

    const body = await req.json();
    const { name, description, departmentId } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ message: 'Category name is required' }, { status: 400 });
    }

    if (!description || !description.trim()) {
      return NextResponse.json({ message: 'Category description is required' }, { status: 400 });
    }

    if (!departmentId) {
      return NextResponse.json({ message: 'Department mapping is required' }, { status: 400 });
    }

    const created = await prisma.category.create({
      data: {
        name: name.trim(),
        description: description.trim(),
        departmentId,
      },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error: any) {
    if (error?.code === 'P2002' || error?.message?.includes('P2002')) {
      return NextResponse.json({ message: 'A category with this name already exists.' }, { status: 409 });
    }
    return NextResponse.json(
      { message: 'Failed to create category', error: error.message },
      { status: 500 },
    );
  }
}
