import { NextResponse } from 'next/server';
import { getPlatformSettings } from '@/lib/settings-store';

export async function GET() {
  try {
    const settings = await getPlatformSettings();
    return NextResponse.json({
      success: true,
      settings,
    });
  } catch (error: any) {
    console.error('[SETTINGS GET API ERROR]:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to fetch platform settings', error: error.message },
      { status: 500 },
    );
  }
}
