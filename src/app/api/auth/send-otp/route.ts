import { handleSendOtpRequest } from '@/lib/send-otp-handler';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  return handleSendOtpRequest(request);
}
