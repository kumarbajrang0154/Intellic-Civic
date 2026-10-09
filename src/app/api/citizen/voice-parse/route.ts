import { NextRequest, NextResponse } from 'next/server';
import { requireCitizen } from '@/lib/citizen-auth';
import { parseVoiceComplaint } from '@/services/gemini-service';

// In-memory per-user rate limiter: max 20 requests per minute per citizen
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 20;
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = rateLimitStore.get(userId);

  if (rateLimitStore.size > 1000) {
    for (const [key, val] of rateLimitStore.entries()) {
      if (val.resetAt < now) {
        rateLimitStore.delete(key);
      }
    }
  }

  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(userId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (entry.count >= MAX_REQUESTS_PER_WINDOW) {
    return false;
  }

  entry.count++;
  return true;
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireCitizen();
    if (!auth.authorized) {
      return auth.response;
    }

    if (!checkRateLimit(auth.user.id)) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please wait a moment before trying again.' },
        { status: 429, headers: { 'Retry-After': '60' } },
      );
    }

    const body = await req.json();
    const { transcript, language } = body;

    if (!transcript || typeof transcript !== 'string' || transcript.trim().length === 0) {
      return NextResponse.json({ error: 'Transcript is required' }, { status: 400 });
    }

    const result = await parseVoiceComplaint(transcript.trim(), language || 'en-IN');
    return NextResponse.json(result, { status: 200 });
  } catch (error: any) {
    const status = error?.status === 403 || error?.message?.includes('403') ? 403 : 500;
    return NextResponse.json(
      { error: error?.message || 'Failed to parse voice complaint' },
      { status },
    );
  }
}
