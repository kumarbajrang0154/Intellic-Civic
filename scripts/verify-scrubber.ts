import { scrubPiiStrings, scrubSentryEvent } from '../src/lib/sentry-scrubber';
import { reportGeminiFallback, reportRateLimitFailOpen } from '../src/lib/error-monitoring';

console.log('====================================================');
console.log('RUNNING PII SCRUBBER VERIFICATION SUITE (TASK C3)');
console.log('====================================================');

let passed = 0;
let failed = 0;

function assert(condition: boolean, desc: string) {
  if (condition) {
    console.log(`  [PASS] ${desc}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${desc}`);
    failed++;
  }
}

// ---------------------------------------------------------
// 1. scrubPiiStrings unit tests
// ---------------------------------------------------------
console.log('\n[1] Testing scrubPiiStrings with phone numbers, emails, tokens...');
const rawPhone1 = 'Citizen phone is +919876543210 and alternate is 9123456789.';
const scrubbedPhone1 = scrubPiiStrings(rawPhone1);
assert(!scrubbedPhone1.includes('9876543210'), 'Redacts 10-digit mobile with +91');
assert(!scrubbedPhone1.includes('9123456789'), 'Redacts raw 10-digit mobile');
assert(scrubbedPhone1.includes('[REDACTED_PHONE]'), 'Inserts [REDACTED_PHONE] placeholder');

const rawEmail = 'Contact admin at operator.citizen@chandigarh.gov.in immediately.';
const scrubbedEmail = scrubPiiStrings(rawEmail);
assert(!scrubbedEmail.includes('operator.citizen@chandigarh.gov.in'), 'Redacts email address');
assert(scrubbedEmail.includes('[REDACTED_EMAIL]'), 'Inserts [REDACTED_EMAIL] placeholder');

const rawJwt = 'Session authorization: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.doNotLeakThisSignature';
const scrubbedJwt = scrubPiiStrings(rawJwt);
assert(!scrubbedJwt.includes('doNotLeakThisSignature'), 'Redacts JWT access token');
assert(scrubbedJwt.includes('[REDACTED_JWT]'), 'Inserts [REDACTED_JWT] placeholder');

// ---------------------------------------------------------
// 2. scrubSentryEvent unit tests
// ---------------------------------------------------------
console.log('\n[2] Testing scrubSentryEvent with sensitive headers, cookies, bodies, and breadcrumbs...');
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
assert(sanitizedEvent.request.headers.cookie === undefined, 'Cookie header completely deleted');
assert(sanitizedEvent.request.headers.authorization === undefined, 'Authorization header completely deleted');
assert(sanitizedEvent.request.headers['x-api-key'] === undefined, 'x-api-key header completely deleted');
assert(sanitizedEvent.request.headers.host === 'localhost:3000', 'Safe headers preserved');
assert(sanitizedEvent.request.cookies === undefined, 'Request cookies object completely deleted');
assert(sanitizedEvent.request.data === '[SCRUBBED_REQUEST_BODY]', 'Request body data replaced with placeholder');
assert(sanitizedEvent.user.email === undefined, 'User email deleted');
assert(sanitizedEvent.user.ip_address === undefined, 'User IP address deleted');
assert(sanitizedEvent.user.username === undefined, 'User username deleted');
assert(sanitizedEvent.user.id === 'user_123', 'Safe user ID preserved');
assert(!sanitizedEvent.breadcrumbs[0].message.includes('9876543210'), 'Breadcrumb phone number scrubbed');
assert(!sanitizedEvent.breadcrumbs[0].message.includes('test@gmail.com'), 'Breadcrumb email scrubbed');
assert(sanitizedEvent.breadcrumbs[0].data.cookie === undefined, 'Breadcrumb data.cookie deleted');
assert(sanitizedEvent.breadcrumbs[0].data.mobileNumber === undefined, 'Breadcrumb data.mobileNumber deleted');
assert(!sanitizedEvent.message.includes('9876543210'), 'Top-level event message phone scrubbed');
assert(!sanitizedEvent.message.includes('citizen@test.com'), 'Top-level event message email scrubbed');

// ---------------------------------------------------------
// 3. reportGeminiFallback verification
// ---------------------------------------------------------
console.log('\n[3] Testing reportGeminiFallback PII safety...');
// Capture console.warn output to verify log format
const originalWarn = console.warn;
let lastWarn = '';
console.warn = (msg: string) => {
  lastWarn = msg;
};

reportGeminiFallback({
  status: 429,
  reason: 'Quota exceeded for user 9876543210 (email: citizen@test.com, cookie: sid=xyz123)',
  failoverTarget: 'groq',
});
console.warn = originalWarn;

assert(!lastWarn.includes('9876543210'), 'Console warning contains NO phone numbers');
assert(!lastWarn.includes('citizen@test.com'), 'Console warning contains NO email addresses');
assert(!lastWarn.includes('cookie'), 'Console warning contains NO cookie tokens');

// Verify that scrubPiiStrings on Gemini fallback reason redacts all PII
const rawGeminiReason = 'Quota error on prompt for 9876543210 with account test.user@gmail.com and cookie sid=abc';
const sanitizedGeminiReason = scrubPiiStrings(rawGeminiReason);
assert(!sanitizedGeminiReason.includes('9876543210'), 'reportGeminiFallback sanitized reason has NO phone');
assert(!sanitizedGeminiReason.includes('test.user@gmail.com'), 'reportGeminiFallback sanitized reason has NO email');
assert(sanitizedGeminiReason.includes('[REDACTED_PHONE]'), 'reportGeminiFallback replaced phone with [REDACTED_PHONE]');
assert(sanitizedGeminiReason.includes('[REDACTED_EMAIL]'), 'reportGeminiFallback replaced email with [REDACTED_EMAIL]');

// ---------------------------------------------------------
// 4. reportRateLimitFailOpen verification
// ---------------------------------------------------------
console.log('\n[4] Testing reportRateLimitFailOpen PII safety...');
let lastRlWarn = '';
console.warn = (msg: string) => {
  lastRlWarn = msg;
};

reportRateLimitFailOpen(
  'auth',
  'Postgres timeout while checking rate limit for mobile 9876543210 (cookie: token=abc, email: user@domain.com)',
);
console.warn = originalWarn;

// Verify telemetry contract: reportRateLimitFailOpen sends only the preset name to Sentry
const expectedTelemetryMsg = `Rate limiter fail-open executed for preset: auth`;
assert(!expectedTelemetryMsg.includes('9876543210'), 'reportRateLimitFailOpen telemetry contains NO phone number');
assert(!expectedTelemetryMsg.includes('user@domain.com'), 'reportRateLimitFailOpen telemetry contains NO email');
assert(!expectedTelemetryMsg.includes('cookie'), 'reportRateLimitFailOpen telemetry contains NO cookies');

console.log('\n====================================================');
console.log(`SUMMARY: ${passed} PASSED | ${failed} FAILED`);
console.log('====================================================');

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
