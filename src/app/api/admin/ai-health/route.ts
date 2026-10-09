import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { checkAiHealth, getGeminiModel } from '@/services/gemini-service';

export const maxDuration = 30;

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (!auth.authorized) {
      return auth.response;
    }

    const health = await checkAiHealth();
    return NextResponse.json(health, { status: 200 });
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        model: getGeminiModel(),
        status: 500,
        latencyMs: 0,
        error: error.message || 'Internal server error checking AI health',
      },
      { status: 500 },
    );
  }
}
