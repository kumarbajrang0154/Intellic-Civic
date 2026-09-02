import { NextResponse } from 'next/server';
import { listCategories } from '@/lib/complaints-store';

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
