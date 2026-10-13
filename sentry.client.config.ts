import * as Sentry from '@sentry/nextjs';
import { scrubSentryEvent } from '@/lib/sentry-scrubber';

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN;

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    sendDefaultPii: false,
    tracesSampleRate: 0.1,
    environment: process.env.NODE_ENV,
    beforeSend(event: any) {
      return scrubSentryEvent(event);
    },
  } as any);
}
