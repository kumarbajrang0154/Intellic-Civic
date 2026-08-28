import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.NESTJS_BACKEND_URL || 'http://localhost:3001';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const token = cookies().get('token')?.value;
    if (!token) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));

    const backendRes = await fetch(`${BACKEND_URL}/api/v1/users/${params.id}/approve`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await backendRes.json();
    return NextResponse.json(data, { status: backendRes.status });
  } catch (error) {
    return NextResponse.json(
      { message: 'Failed to approve user' },
      { status: 500 },
    );
  }
}
