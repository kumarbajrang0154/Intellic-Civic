import { Page, BrowserContext, expect } from '@playwright/test';
import { SignJWT } from 'jose';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'intellicivic-dev-jwt-secret-key-32bytes!');

export const VIEWPORTS = [
  { name: 'mobile-375px', width: 375, height: 667 },
  { name: 'desktop-1280px', width: 1280, height: 800 },
];

export async function createAuthJwt(payload: {
  sub: string;
  role: string;
  email?: string;
  name?: string;
  mobileNumber?: string;
  departmentId?: string;
  assignedOfficerId?: string;
  isAuthorized?: boolean;
}) {
  return new SignJWT({
    name: payload.name || 'Test User',
    email: payload.email || `${payload.role.toLowerCase()}@test.gov`,
    isAuthorized: payload.isAuthorized ?? true,
    ...payload,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('2h')
    .sign(JWT_SECRET);
}

export async function setAuthCookie(context: BrowserContext, token: string) {
  await context.addCookies([
    {
      name: 'ic_access_token',
      value: token,
      domain: 'localhost',
      path: '/',
    },
  ]);
}

export function attachOutcomeListeners(
  page: Page,
  options: {
    allowedFailedUrlPatterns?: (string | RegExp)[];
  } = {},
) {
  const consoleErrors: string[] = [];
  const failedRequests: string[] = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      // Ignore benign or expected third-party logs (e.g. Gemini 403/429, favicon)
      if (
        text.includes('403 Forbidden') ||
        text.includes('429') ||
        text.includes('gemini') ||
        text.includes('favicon')
      ) {
        return;
      }
      consoleErrors.push(text);
    }
  });

  page.on('requestfailed', (req) => {
    const url = req.url();
    // Ignore aborted requests during navigation or expected ignores
    if (
      url.includes('favicon.ico') ||
      url.includes('generativelanguage.googleapis.com') ||
      url.includes('googleusercontent.com') ||
      req.failure()?.errorText === 'net::ERR_ABORTED'
    ) {
      return;
    }
    const isAllowed = options.allowedFailedUrlPatterns?.some((p) =>
      typeof p === 'string' ? url.includes(p) : p.test(url),
    );
    if (!isAllowed) {
      failedRequests.push(`${req.method()} ${url} - ${req.failure()?.errorText || 'failed'}`);
    }
  });

  return {
    assertClean() {
      expect(consoleErrors, `Expected zero console.errors, found:\n${consoleErrors.join('\n')}`).toEqual([]);
      expect(failedRequests, `Expected zero failed requests, found:\n${failedRequests.join('\n')}`).toEqual([]);
    },
    getErrors() {
      return { consoleErrors, failedRequests };
    },
  };
}
