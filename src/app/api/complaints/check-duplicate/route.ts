import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { decodeJwtToken } from '@/lib/auth-jwt';
import { checkDuplicateComplaints } from '@/lib/complaints-store';
import { validateDuplicateCheckInput } from '@/lib/validation';

export async function POST(request: NextRequest) {
  try {
    const cookieStore = cookies();
    const accessToken = cookieStore.get('ic_access_token')?.value;

    if (!accessToken) {
      return NextResponse.json({ statusCode: 401, message: 'Unauthorized session' }, { status: 401 });
    }

    const payload = decodeJwtToken(accessToken);
    if (!payload) {
      return NextResponse.json({ statusCode: 401, message: 'Unauthorized session' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const validation = validateDuplicateCheckInput(body);

    if (!validation.success) {
      return NextResponse.json({ statusCode: 400, message: validation.error }, { status: 400 });
    }

    const result = checkDuplicateComplaints(validation.data!);
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { statusCode: 500, message: 'Internal server error', error: error.message },
      { status: 500 },
    );
  }
}
