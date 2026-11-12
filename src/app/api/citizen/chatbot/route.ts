import { NextRequest } from 'next/server';
import { handleCitizenChatbotPost } from '@/lib/citizen-chatbot-http';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  return handleCitizenChatbotPost(request);
}
