import * as Sentry from '@sentry/nextjs';
import { scrubPiiStrings } from './sentry-scrubber';

/**
 * IntelliCivic Error & Incident Monitoring Service
 * 
 * Powered by Sentry with strict PII-scrubbing controls.
 * If SENTRY_DSN / NEXT_PUBLIC_SENTRY_DSN is absent, all functions cleanly no-op.
 */

export function isSentryConfigured(): boolean {
  return Boolean(process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN);
}

/**
 * Captures an unexpected exception with optional context (no PII).
 */
export function captureException(error: unknown, tags?: Record<string, string>): void {
  if (!isSentryConfigured()) return;

  try {
    Sentry.withScope((scope) => {
      if (tags) {
        Object.entries(tags).forEach(([k, v]) => scope.setTag(k, v));
      }
      Sentry.captureException(error);
    });
  } catch (err) {
    console.error('[ErrorMonitoring] Failed to capture exception to Sentry:', err);
  }
}

/**
 * Captures an informational or warning event message to Sentry.
 */
export function captureMessage(
  message: string,
  level: Sentry.SeverityLevel = 'info',
  tags?: Record<string, string>,
): void {
  if (!isSentryConfigured()) return;

  try {
    const cleanMessage = scrubPiiStrings(message);
    Sentry.withScope((scope) => {
      scope.setLevel(level);
      if (tags) {
        Object.entries(tags).forEach(([k, v]) => scope.setTag(k, v));
      }
      Sentry.captureMessage(cleanMessage);
    });
  } catch (err) {
    console.error('[ErrorMonitoring] Failed to capture message to Sentry:', err);
  }
}

/**
 * Report Gemini fallback events as Sentry warnings with operational tags (no PII).
 */
export function reportGeminiFallback(details: {
  status: number;
  reason: string;
  failoverTarget: 'groq' | 'heuristic' | 'fallback';
}): void {
  const { status, reason, failoverTarget } = details;
  console.warn(`[AI Fallback Event] Gemini failed (HTTP ${status}) -> Failover to ${failoverTarget}`);

  if (!isSentryConfigured()) return;

  captureMessage(
    `Gemini AI fallback triggered (HTTP ${status}): ${scrubPiiStrings(reason).slice(0, 150)}`,
    'warning',
    {
      service: 'ai-provider',
      primaryProvider: 'gemini',
      failoverTarget,
      httpStatus: String(status),
    },
  );
}

/**
 * Report rate-limit fail-open events in production as Sentry warnings.
 */
export function reportRateLimitFailOpen(preset: string, reason: string): void {
  console.warn(`[Rate Limit Fail-Open Event] Preset: ${preset} | Reason: ${reason}`);

  if (!isSentryConfigured()) return;

  captureMessage(
    `Rate limiter fail-open executed for preset: ${preset}`,
    'warning',
    {
      service: 'rate-limiter',
      event: 'rate_limit_fail_open',
      preset,
      environment: process.env.NODE_ENV || 'development',
    },
  );
}
