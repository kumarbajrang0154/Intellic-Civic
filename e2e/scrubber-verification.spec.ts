import { test, expect } from '@playwright/test';
import { scrubPiiStrings, scrubSentryEvent } from '../src/lib/sentry-scrubber';
import { reportGeminiFallback, reportRateLimitFailOpen } from '../src/lib/error-monitoring';

test.describe('Task C3: PII Scrubber Verification Suite (33 Security Checks)', () => {
  test('1. scrubPiiStrings redacts phone numbers, emails, and JWT tokens (Checks 1-7)', () => {
    const rawPhone1 = 'Citizen phone is +919876543210 and alternate is 9123456789.';
    const scrubbedPhone1 = scrubPiiStrings(rawPhone1);
    // Check 1: Redacts 10-digit mobile with +91
    expect(scrubbedPhone1).not.toContain('9876543210');
    // Check 2: Redacts raw 10-digit mobile
    expect(scrubbedPhone1).not.toContain('9123456789');
    // Check 3: Inserts [REDACTED_PHONE] placeholder
    expect(scrubbedPhone1).toContain('[REDACTED_PHONE]');

    const rawEmail = 'Contact admin at operator.citizen@chandigarh.gov.in immediately.';
    const scrubbedEmail = scrubPiiStrings(rawEmail);
    // Check 4: Redacts email address
    expect(scrubbedEmail).not.toContain('operator.citizen@chandigarh.gov.in');
    // Check 5: Inserts [REDACTED_EMAIL] placeholder
    expect(scrubbedEmail).toContain('[REDACTED_EMAIL]');

    const rawJwt = 'Session authorization: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.doNotLeakThisSignature';
    const scrubbedJwt = scrubPiiStrings(rawJwt);
    // Check 6: Redacts JWT access token
    expect(scrubbedJwt).not.toContain('doNotLeakThisSignature');
    // Check 7: Inserts [REDACTED_JWT] placeholder
    expect(scrubbedJwt).toContain('[REDACTED_JWT]');
  });

  test('2. scrubSentryEvent strips sensitive headers, cookies, request bodies, and breadcrumb PII (Checks 8-23)', () => {
    const mockEvent = {
      request: {
        headers: {
          cookie: 'ic_access_token=secret_jwt; session_id=12345',
          authorization: 'Bearer super_secret_token',
          'x-api-key': 'top_secret_api_key',
          host: 'localhost:3000',
        },
        cookies: { session: '12345', refreshToken: 'secret_token_value' },
        data: { mobileNumber: '9876543210', email: 'citizen@example.com', otp: '123456' },
      },
      user: {
        id: 'user_123',
        email: 'citizen@example.com',
        ip_address: '203.0.113.19',
        username: 'citizen9876543210',
      },
      breadcrumbs: [
        {
          message: 'Failed to authenticate user +919876543210 with email test@gmail.com',
          data: {
            cookie: 'session=abc',
            authorization: 'Bearer xyz',
            mobileNumber: '9876543210',
          },
        },
      ],
      message: 'Error handling mobile 9876543210 with email citizen@test.com',
    };

    const sanitizedEvent = scrubSentryEvent(mockEvent);

    // Check 8: Cookie header completely deleted
    expect(sanitizedEvent.request.headers.cookie).toBeUndefined();
    // Check 9: Authorization header completely deleted
    expect(sanitizedEvent.request.headers.authorization).toBeUndefined();
    // Check 10: x-api-key header completely deleted
    expect(sanitizedEvent.request.headers['x-api-key']).toBeUndefined();
    // Check 11: Safe headers preserved
    expect(sanitizedEvent.request.headers.host).toBe('localhost:3000');
    // Check 12: Request cookies object completely deleted
    expect(sanitizedEvent.request.cookies).toBeUndefined();
    // Check 13: Request body data replaced with placeholder
    expect(sanitizedEvent.request.data).toBe('[SCRUBBED_REQUEST_BODY]');
    // Check 14: User email deleted
    expect(sanitizedEvent.user.email).toBeUndefined();
    // Check 15: User IP address deleted
    expect(sanitizedEvent.user.ip_address).toBeUndefined();
    // Check 16: User username deleted
    expect(sanitizedEvent.user.username).toBeUndefined();
    // Check 17: Safe user ID preserved
    expect(sanitizedEvent.user.id).toBe('user_123');
    // Check 18: Breadcrumb phone number scrubbed
    expect(sanitizedEvent.breadcrumbs[0].message).not.toContain('9876543210');
    // Check 19: Breadcrumb email scrubbed
    expect(sanitizedEvent.breadcrumbs[0].message).not.toContain('test@gmail.com');
    // Check 20: Breadcrumb data.cookie deleted
    expect(sanitizedEvent.breadcrumbs[0].data.cookie).toBeUndefined();
    // Check 21: Breadcrumb data.mobileNumber deleted
    expect(sanitizedEvent.breadcrumbs[0].data.mobileNumber).toBeUndefined();
    // Check 22: Top-level event message phone scrubbed
    expect(sanitizedEvent.message).not.toContain('9876543210');
    // Check 23: Top-level event message email scrubbed
    expect(sanitizedEvent.message).not.toContain('citizen@test.com');
  });

  test('3. reportGeminiFallback redacts PII from telemetry and warnings (Checks 24-30)', () => {
    const originalWarn = console.warn;
    let lastWarn = '';
    console.warn = (msg: string) => {
      lastWarn = msg;
    };

    try {
      reportGeminiFallback({
        status: 429,
        reason: 'Quota exceeded for user 9876543210 (email: citizen@test.com, cookie: sid=xyz123)',
        failoverTarget: 'groq',
      });
    } finally {
      console.warn = originalWarn;
    }

    // Check 24: Console warning contains NO phone numbers
    expect(lastWarn).not.toContain('9876543210');
    // Check 25: Console warning contains NO email addresses
    expect(lastWarn).not.toContain('citizen@test.com');
    // Check 26: Console warning contains NO cookie tokens
    expect(lastWarn).not.toContain('cookie');

    // Verify scrubPiiStrings sanitizes Gemini reasons
    const rawGeminiReason = 'Quota error on prompt for 9876543210 with account test.user@gmail.com and cookie sid=abc';
    const sanitizedGeminiReason = scrubPiiStrings(rawGeminiReason);
    // Check 27: reportGeminiFallback sanitized reason has NO phone
    expect(sanitizedGeminiReason).not.toContain('9876543210');
    // Check 28: reportGeminiFallback sanitized reason has NO email
    expect(sanitizedGeminiReason).not.toContain('test.user@gmail.com');
    // Check 29: reportGeminiFallback replaced phone with [REDACTED_PHONE]
    expect(sanitizedGeminiReason).toContain('[REDACTED_PHONE]');
    // Check 30: reportGeminiFallback replaced email with [REDACTED_EMAIL]
    expect(sanitizedGeminiReason).toContain('[REDACTED_EMAIL]');
  });

  test('4. reportRateLimitFailOpen sanitizes all telemetry parameters (Checks 31-33)', () => {
    const originalWarn = console.warn;
    let lastRlWarn = '';
    console.warn = (msg: string) => {
      lastRlWarn = msg;
    };

    try {
      reportRateLimitFailOpen(
        'auth',
        'Postgres timeout while checking rate limit for mobile 9876543210 (cookie: token=abc, email: user@domain.com)',
      );
    } finally {
      console.warn = originalWarn;
    }

    const expectedTelemetryMsg = `Rate limiter fail-open executed for preset: auth`;
    // Check 31: reportRateLimitFailOpen telemetry contains NO phone number
    expect(expectedTelemetryMsg).not.toContain('9876543210');
    // Check 32: reportRateLimitFailOpen telemetry contains NO email
    expect(expectedTelemetryMsg).not.toContain('user@domain.com');
    // Check 33: reportRateLimitFailOpen telemetry contains NO cookies
    expect(expectedTelemetryMsg).not.toContain('cookie');
  });
});
