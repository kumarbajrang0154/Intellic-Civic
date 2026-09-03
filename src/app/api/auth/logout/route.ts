import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function POST() {
  try {
    const cookieStore = cookies();
    cookieStore.delete('ic_access_token');
    cookieStore.delete('ic_refresh_token');

    return NextResponse.json({ success: true, message: 'Logged out successfully' });
  } catch (error: any) {
    const cookieStore = cookies();
    cookieStore.delete('ic_access_token');
    cookieStore.delete('ic_refresh_token');

    return NextResponse.json({ success: true, message: 'Logged out successfully' });
  }
}
