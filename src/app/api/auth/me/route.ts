import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { decodeJwtToken } from '@/lib/auth-jwt';

export async function GET() {
  try {
    const cookieStore = cookies();
    const accessToken = cookieStore.get('ic_access_token')?.value;

    if (!accessToken) {
      return NextResponse.json({ user: null }, { status: 401 });
    }

    const payload = decodeJwtToken(accessToken);
    if (!payload || (payload.exp && payload.exp * 1000 < Date.now())) {
      return NextResponse.json({ user: null }, { status: 401 });
    }

    return NextResponse.json({
      user: {
        id: payload.sub,
        mobileNumber: payload.mobileNumber || null,
        email: payload.email || null,
        name: payload.name || 'Citizen User',
        role: payload.role || 'CITIZEN',
      },
    });
  } catch (error: any) {
    return NextResponse.json({ user: null }, { status: 500 });
  }
}
