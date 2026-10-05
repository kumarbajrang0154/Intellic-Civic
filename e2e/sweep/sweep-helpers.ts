import { Page, BrowserContext, expect } from '@playwright/test';
import { SignJWT } from 'jose';
import prisma from '../../src/lib/prisma';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'intellicivic-dev-jwt-secret-key-32bytes!');

export const VIEWPORTS = [
  { name: 'mobile-375px', width: 375, height: 667 },
  { name: 'desktop-1280px', width: 1280, height: 800 },
];

export async function getSeededUser(query: {
  role?: string;
  email?: string;
  id?: string;
}) {
  const where: any = { isSuspended: false };
  if (query.role) where.role = query.role;
  if (query.email) where.email = query.email;
  if (query.id) where.id = query.id;

  const user = await prisma.user.findFirst({ where });
  if (!user) {
    throw new Error(`Seeded user not found in DB for query: ${JSON.stringify(query)}`);
  }
  return user;
}

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

export interface AllowedOutcomeResponse {
  urlPattern: string | RegExp;
  status: number;
  reason: string;
}

export interface OutcomeListenerOptions {
  allowlist?: AllowedOutcomeResponse[];
}

export function attachOutcomeListeners(
  page: Page,
  options: OutcomeListenerOptions = {},
) {
  const consoleErrors: string[] = [];
  const failedRequests: string[] = [];
  const unexpectedResponses: { method: string; url: string; status: number }[] = [];

  const allowlist: AllowedOutcomeResponse[] = [...(options.allowlist || [])];

  function isSameOrigin(targetUrl: string, currentUrl: string): boolean {
    try {
      const target = new URL(targetUrl);
      if (!currentUrl || currentUrl === 'about:blank' || currentUrl.startsWith('data:')) {
        return target.hostname === 'localhost' || target.hostname === '127.0.0.1';
      }
      const current = new URL(currentUrl);
      return target.origin === current.origin;
    } catch {
      return false;
    }
  }

  // Console errors: record all. The only global ignore allowed is the exact browser favicon 404 if present, with a comment.
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      const url = msg.location()?.url || '';
      // Browser favicon 404: harmless when static favicon is missing or browser auto-requests /favicon.ico
      if ((url.includes('favicon.ico') || text.includes('favicon.ico')) && text.includes('404')) {
        return;
      }
      consoleErrors.push(text);
    }
  });

  // ERR_ABORTED is ignored only for requests triggered by a navigation (document/navigation request), nothing else.
  page.on('requestfailed', (req) => {
    const failureText = req.failure()?.errorText || '';
    if (failureText === 'net::ERR_ABORTED') {
      const isDoc = req.isNavigationRequest() || req.resourceType() === 'document';
      const isRsc = req.url().includes('_rsc=');
      let isPageRoute = false;
      try {
        const u = new URL(req.url());
        isPageRoute = !u.pathname.includes('.') && !u.pathname.startsWith('/api/');
      } catch {}

      if (isDoc || isRsc || isPageRoute) {
        return;
      }
    }
    failedRequests.push(`${req.method()} ${req.url()} - ${failureText || 'failed'}`);
  });

  // page.on('response'): record every same-origin response with status >= 400 as {method, url, status}
  page.on('response', (res) => {
    const status = res.status();
    const url = res.url();
    if (status >= 400 && isSameOrigin(url, page.url())) {
      const isAllowed = allowlist.some((entry) => {
        const matchesStatus = entry.status === status;
        const matchesPattern =
          typeof entry.urlPattern === 'string'
            ? url.includes(entry.urlPattern)
            : entry.urlPattern.test(url);
        return matchesStatus && matchesPattern;
      });

      if (!isAllowed) {
        unexpectedResponses.push({
          method: res.request().method(),
          url,
          status,
        });
      }
    }
  });

  return {
    allow(entry: AllowedOutcomeResponse) {
      allowlist.push(entry);
    },
    assertClean() {
      expect(
        consoleErrors,
        `Expected zero console.errors, found:\n${consoleErrors.join('\n')}`,
      ).toEqual([]);
      expect(
        failedRequests,
        `Expected zero failed requests, found:\n${failedRequests.join('\n')}`,
      ).toEqual([]);
      expect(
        unexpectedResponses,
        `Expected zero unexpected >=400 responses, found:\n${unexpectedResponses
          .map((r) => `${r.method} ${r.url} -> ${r.status}`)
          .join('\n')}`,
      ).toEqual([]);
    },
    getErrors() {
      return { consoleErrors, failedRequests, unexpectedResponses };
    },
  };
}
