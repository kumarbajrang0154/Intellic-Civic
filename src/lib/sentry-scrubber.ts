/**
 * Sentry Data Sanitization & PII Scrubber
 * 
 * Enforces zero-PII leak policy:
 * - Strips sensitive cookies, Authorization headers, API keys
 * - Strips request bodies
 * - Redacts phone numbers (+91 / 10 digits) and email addresses from strings and breadcrumbs
 */

export function scrubPiiStrings(text: string): string {
  if (!text || typeof text !== 'string') return text;
  // Redact email addresses
  let sanitized = text.replace(/[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+/g, '[REDACTED_EMAIL]');
  // Redact 10-digit phone numbers (with or without +91 / country code)
  sanitized = sanitized.replace(/(?:\+?91[\s-]?)?[6-9]\d{9}/g, '[REDACTED_PHONE]');
  // Redact API keys / JWT tokens that look like bearer tokens or base64/hex strings
  sanitized = sanitized.replace(/ey[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{20,}/g, '[REDACTED_JWT]');
  sanitized = sanitized.replace(/AIzaSy[a-zA-Z0-9_-]{33}/g, '[REDACTED_API_KEY]');
  return sanitized;
}

export function scrubSentryEvent(event: any): any {
  if (!event) return event;

  // 1. Scrub HTTP Request headers and cookies
  if (event.request) {
    if (event.request.headers) {
      const headers = { ...event.request.headers };
      delete headers['cookie'];
      delete headers['authorization'];
      delete headers['x-api-key'];
      delete headers['set-cookie'];
      delete headers['proxy-authorization'];
      event.request.headers = headers;
    }

    if (event.request.cookies) {
      delete event.request.cookies;
    }

    // Scrub request body completely to prevent payload PII leakage
    if (event.request.data) {
      event.request.data = '[SCRUBBED_REQUEST_BODY]';
    }
  }

  // 2. Scrub User context (no emails, no IP addresses)
  if (event.user) {
    delete event.user.email;
    delete event.user.ip_address;
    delete event.user.username;
  }

  // 3. Scrub Breadcrumbs
  if (Array.isArray(event.breadcrumbs)) {
    event.breadcrumbs = event.breadcrumbs.map((crumb: any) => {
      if (!crumb) return crumb;
      const sanitized = { ...crumb };
      if (typeof sanitized.message === 'string') {
        sanitized.message = scrubPiiStrings(sanitized.message);
      }
      if (sanitized.data) {
        if (typeof sanitized.data === 'string') {
          sanitized.data = scrubPiiStrings(sanitized.data);
        } else if (typeof sanitized.data === 'object') {
          const cleanData = { ...sanitized.data };
          delete cleanData.cookie;
          delete cleanData.authorization;
          delete cleanData.password;
          delete cleanData.token;
          delete cleanData.mobileNumber;
          delete cleanData.email;
          sanitized.data = cleanData;
        }
      }
      return sanitized;
    });
  }

  // 4. Scrub top-level message
  if (typeof event.message === 'string') {
    event.message = scrubPiiStrings(event.message);
  }

  // 5. Scrub exception values
  if (event.exception?.values && Array.isArray(event.exception.values)) {
    for (const val of event.exception.values) {
      if (typeof val.value === 'string') {
        val.value = scrubPiiStrings(val.value);
      }
    }
  }

  return event;
}
