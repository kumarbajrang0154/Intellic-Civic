import { NextResponse } from 'next/server';
import { categoriesStore } from '@/lib/complaints-store';

export async function GET() {
  try {
    return NextResponse.json(categoriesStore);
  } catch (error: any) {
    return NextResponse.json(
      { message: 'Failed to fetch categories', error: error.message },
      { status: 500 },
    );
  }
}
