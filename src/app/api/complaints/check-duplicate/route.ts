import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { requireCitizen } from '@/lib/citizen-auth';
import { checkDuplicateComplaints } from '@/lib/complaints-store';
import { validateDuplicateCheckInput } from '@/lib/validation';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireCitizen();
    if (!auth.authorized) return auth.response;

    const body = await request.json().catch(() => ({}));
    const validation = validateDuplicateCheckInput(body);

    if (!validation.success) {
      return NextResponse.json({ statusCode: 400, message: validation.error }, { status: 400 });
    }

    const result = await checkDuplicateComplaints(validation.data!);
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { statusCode: 500, message: 'Internal server error', error: error.message },
      { status: 500 },
    );
  }
}
