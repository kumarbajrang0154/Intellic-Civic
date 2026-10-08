import { NextRequest, NextResponse } from 'next/server';
import { parseVoiceComplaint } from '@/services/gemini-service';

export async function POST(req: NextRequest) {
  try {
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
