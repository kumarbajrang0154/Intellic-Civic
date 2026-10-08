/**
 * Unified API Client & Global Error Interceptor for IntelliCivic
 * Handles global HTTP error trapping, error sanitization, and popup dispatching
 * across all portals (Citizen, Admin, Dept Head, Officer, Field Worker).
 */

export interface GlobalErrorInfo {
  title: string;
  message: string;
  statusText?: string;
  statusCode?: number;
  hint?: string;
}

type ErrorListener = (error: GlobalErrorInfo) => void;
const listeners = new Set<ErrorListener>();
let currentError: GlobalErrorInfo | null = null;

export function getLatestGlobalError(): GlobalErrorInfo | null {
  return currentError;
}

export function clearLatestGlobalError() {
  currentError = null;
}

export function subscribeGlobalError(listener: ErrorListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function showGlobalError(info: GlobalErrorInfo) {
  // Never show raw stack traces in the UI
  const sanitizedMessage = sanitizeErrorText(info.message);
  const payload: GlobalErrorInfo = {
    ...info,
    message: sanitizedMessage,
  };
  currentError = payload;

  listeners.forEach((fn) => {
    try {
      fn(payload);
    } catch (e) {
      console.error('[GlobalError] Error in subscriber:', e);
    }
  });

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('civic:global-error', { detail: payload }));
  }
}

/**
 * Removes stack traces, internal paths, and API keys from error messages.
 */
export function sanitizeErrorText(raw: string | undefined | null): string {
  if (!raw) return 'An unexpected error occurred.';
  let text = String(raw);

  // Remove lines starting with "at " or containing stack traces
  const lines = text.split('\n');
  const cleanLines = lines.filter((line) => {
    const trimmed = line.trim();
    if (trimmed.startsWith('at ')) return false;
    if (trimmed.includes('node_modules')) return false;
    if (trimmed.includes('webpack-internal')) return false;
    if (trimmed.includes('anonymous@')) return false;
    return true;
  });

  text = cleanLines.join(' ').replace(/\s+/g, ' ').trim();

  // Strip file paths
  text = text.replace(/(?:[a-zA-Z]:)?[/\\][\w\-./\\]+\.(?:js|ts|tsx|jsx|mjs):\d+:\d+/g, '');

  // Strip query keys
  text = text.replace(/key=[a-zA-Z0-9_\-]+/g, 'key=[REDACTED]');

  return text.trim() || 'An unexpected error occurred.';
}

export function getStatusTitle(status: number): string {
  if (status === 400) return 'Invalid Request';
  if (status === 401) return 'Session Expired or Unauthorized';
  if (status === 403) return 'Access Denied';
  if (status === 404) return 'Resource Not Found';
  if (status === 409) return 'Conflict Detected';
  if (status === 422) return 'Validation Failed';
  if (status === 429) return 'Too Many Requests';
  if (status >= 500) return 'Server Error';
  return 'Request Failed';
}

export function getStatusHint(status: number): string {
  if (status === 400) return 'HTTP 400 • Please check the details you entered and try again.';
  if (status === 401) return 'HTTP 401 • Please log in to continue.';
  if (status === 403) return 'HTTP 403 • You do not have permission to perform this action.';
  if (status === 404) return 'HTTP 404 • The requested resource does not exist or was moved.';
  if (status === 409) return 'HTTP 409 • The request conflicts with current server state.';
  if (status === 422) return 'HTTP 422 • One or more input fields are invalid.';
  if (status === 429) return 'HTTP 429 • High traffic. Please slow down and try again shortly.';
  if (status >= 500) return `HTTP ${status} • The server encountered an issue. Please try again later.`;
  return `HTTP ${status} • Please check your network and try again.`;
}

/**
 * Determines whether a failed HTTP response should suppress the global error popup.
 * Suppressed cases:
 * 1. Explicit skip header: 'x-skip-global-error' === 'true' or 'x-handled-inline' === 'true'
 * 2. Unauthenticated session checks: 401 on /api/auth/me, /api/auth/refresh, or /api/auth/session
 * 3. Polling / background sync: 'x-is-polling' === 'true', query param polling=true / background=true, or background notifications polling (<500)
 * 4. Inline-handled resource lookups: 404 on single-resource routes where the page renders its own 404 UI (e.g. /api/complaints/[id])
 */
export function isErrorSuppressed(urlStr: string, status: number, headers?: Headers | null): boolean {
  if (headers?.get('x-skip-global-error') === 'true' || headers?.get('x-handled-inline') === 'true') {
    return true;
  }

  // Session-check calls returning 401 (e.g. unauthenticated visitors browsing public pages)
  if (status === 401) {
    if (
      urlStr.includes('/api/auth/me') ||
      urlStr.includes('/api/auth/refresh') ||
      urlStr.includes('/api/auth/session')
    ) {
      return true;
    }
  }

  // Polling failures & background syncing
  if (
    headers?.get('x-is-polling') === 'true' ||
    urlStr.includes('polling=true') ||
    urlStr.includes('background=true') ||
    (status < 500 && urlStr.includes('/api/notifications'))
  ) {
    return true;
  }

  // Resource 404s that calling pages handle inline with dedicated full-page not-found UI
  if (status === 404) {
    // /api/complaints/[id] where [id] is a specific ticket/UUID
    if (/\/api\/complaints\/[^/?#]+$/.test(urlStr)) {
      return true;
    }
  }

  return false;
}

/**
 * Initializes client-side global fetch interception and unhandled error handling.
 */
export function initGlobalErrorInterceptor() {
  if (typeof window === 'undefined') return;
  const w = window as any;
  if (w.__civicGlobalInterceptorInitialized) return;
  w.__civicGlobalInterceptorInitialized = true;

  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    // Check if caller explicitly requested skipping the global error popup
    const headers = new Headers(init?.headers);
    const urlStr = typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as Request).url;

    try {
      const response = await originalFetch(input, init);

      if (!response.ok && !isErrorSuppressed(urlStr, response.status, headers)) {
        // Clone response to parse error message without consuming body for the caller
        const clone = response.clone();
        let errorMsg = '';
        try {
          const json = await clone.json();
          errorMsg = json?.error || json?.message || json?.detail || '';
        } catch {
          try {
            errorMsg = await clone.text();
          } catch {
            errorMsg = '';
          }
        }

        // Determine if this is an API call
        if (urlStr.includes('/api/')) {
          showGlobalError({
            title: getStatusTitle(response.status),
            message: errorMsg || `Request failed with status ${response.status}`,
            statusCode: response.status,
            hint: getStatusHint(response.status),
          });
        }
      }

      return response;
    } catch (err: any) {
      const skipPopup = headers.get('x-skip-global-error') === 'true';
      if (!skipPopup && err?.name !== 'AbortError' && !urlStr.includes('polling=true')) {
        showGlobalError({
          title: 'Network Error',
          message: err?.message || 'Unable to connect to the server.',
          hint: 'Please check your internet connection and try again.',
        });
      }
      throw err;
    }
  };

  // Listen for unhandled client-side runtime errors
  window.addEventListener('error', (event) => {
    // Ignore benign resize observer, script load noise, and React hydration recovery
    const msg = event.message || '';
    if (
      msg.includes('ResizeObserver') ||
      msg.includes('Script error') ||
      msg.includes('Minified React error #418') ||
      msg.includes('Minified React error #423') ||
      msg.includes('Minified React error #425') ||
      msg.includes('Hydration') ||
      msg.includes('hydrating')
    ) {
      return;
    }
    showGlobalError({
      title: 'Application Error',
      message: msg || 'An unexpected client error occurred.',
      hint: 'Client Error • Please refresh the page if issues persist.',
    });
  });

  // Listen for unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    if (reason?.name === 'AbortError' || reason?.message?.includes('aborted')) return;
    const msg = typeof reason === 'string' ? reason : reason?.message || 'Unhandled asynchronous error';
    if (
      msg.includes('ResizeObserver') ||
      msg.includes('Minified React error #418') ||
      msg.includes('Minified React error #423') ||
      msg.includes('Minified React error #425') ||
      msg.includes('Hydration') ||
      msg.includes('hydrating')
    ) {
      return;
    }
    showGlobalError({
      title: 'Application Error',
      message: msg,
      hint: 'Client Error • An unexpected operation failed in the background.',
    });
  });
}

/**
 * Convenience wrapper for fetch with standard API client options.
 */
export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  return window.fetch(input, init);
}

if (typeof window !== 'undefined') {
  initGlobalErrorInterceptor();
}
