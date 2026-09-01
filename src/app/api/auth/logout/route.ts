import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export async function POST() {
  try {
    const cookieStore = cookies();
    const refreshToken = cookieStore.get('ic_refresh_token')?.value;

    if (refreshToken) {
      await fetch(`${API_URL}/api/v1/auth/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      }).catch(() => null);
    }

    cookieStore.delete('ic_access_token');
    cookieStore.delete('ic_refresh_token');

    return NextResponse.json({ success: true });
  } catch (error: any) {
    const cookieStore = cookies();
    cookieStore.delete('ic_access_token');
    cookieStore.delete('ic_refresh_token');

    return NextResponse.json({ success: true });
  }
}
