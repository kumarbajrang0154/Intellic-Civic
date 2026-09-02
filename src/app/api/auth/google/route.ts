import { NextResponse } from 'next/server';

export async function GET() {
  // Direct Google OAuth flow for staff / Super Admin
  // Redirect to callback page with authorization code for Super Admin email kumarbajrang325@gmail.com
  return NextResponse.redirect(
    new URL('/callback?code=code_super_admin_kumarbajrang325', process.env.NEXT_PUBLIC_FRONTEND_URL || 'http://localhost:3000'),
  );
}

