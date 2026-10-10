import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  return NextResponse.json(
    { message: 'The credentials generation endpoint has been removed. Please use the password endpoint.' },
    { status: 410 },
  );
}
