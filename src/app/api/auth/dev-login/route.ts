import { NextRequest } from 'next/server';
import { handleDevLoginRequest } from '@/lib/dev-login';

export async function POST(req: NextRequest) {
  return handleDevLoginRequest(req);
}
