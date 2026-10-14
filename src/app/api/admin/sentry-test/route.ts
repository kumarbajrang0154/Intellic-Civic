import { NextRequest, NextResponse } from 'next/server';
import { captureMessage, captureException, isSentryConfigured } from '@/lib/error-monitoring';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const isProduction =
    process.env.NODE_ENV === 'production' ||
    process.env.VERCEL_ENV === 'production' ||
    req.headers.get('x-simulated-env') === 'production';

  if (isProduction) {
    return NextResponse.json({ message: 'Not Found' }, { status: 404 });
  }

  const configured = isSentryConfigured();

  // Trigger test informational/warning message with operational tags
  captureMessage('Sentry diagnostic test event triggered manually', 'warning', {
    diagnostic: 'manual_verification',
    environment: process.env.NODE_ENV || 'development',
  });

  // Also trigger a safe diagnostic exception
  try {
    throw new Error('Sentry test error: Verification of error pipeline and scrubbing');
  } catch (err) {
    captureException(err, { test_probe: 'active' });
  }

  return NextResponse.json({
    success: true,
    sentryConfigured: configured,
    message: configured
      ? 'Sentry test events successfully dispatched.'
      : 'Sentry DSN not configured; event was processed by no-op handler without error.',
  });
}

export async function GET(req: NextRequest) {
  return POST(req);
}
