import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

function decodeJwtPayload(token: string): any {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join(''),
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

function addCacheControlHeaders(response: NextResponse): NextResponse {
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  response.headers.set('Pragma', 'no-cache');
  response.headers.set('Expires', '0');
  return response;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow static assets and Next.js internal routes
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  const accessToken = request.cookies.get('ic_access_token')?.value;

  let payload: any = null;
  if (accessToken) {
    payload = decodeJwtPayload(accessToken);
    if (payload && payload.exp && payload.exp * 1000 < Date.now()) {
      payload = null;
    }
  }

  const isAuthenticated = !!payload;
  const role = payload?.role;

  // 1. Unauthenticated users trying to access protected paths
  const isProtectedPath =
    pathname.startsWith('/citizen') ||
    pathname.startsWith('/department-head') ||
    pathname.startsWith('/dept-head') ||
    pathname.startsWith('/officer') ||
    pathname.startsWith('/staff') ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/field-worker');

  if (!isAuthenticated && isProtectedPath) {
    const loginTarget =
      pathname.startsWith('/department-head') ||
      pathname.startsWith('/dept-head') ||
      pathname.startsWith('/officer') ||
      pathname.startsWith('/staff') ||
      pathname.startsWith('/admin')
        ? '/login/staff'
        : '/login/citizen';
    return addCacheControlHeaders(NextResponse.redirect(new URL(loginTarget, request.url)));
  }

  // 2. Check authorization for staff/admin roles trying to access protected paths
  const isStaffPath =
    pathname.startsWith('/department-head') ||
    pathname.startsWith('/dept-head') ||
    pathname.startsWith('/officer') ||
    pathname.startsWith('/staff') ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/field-worker');

  if (isAuthenticated && isStaffPath && payload?.isAuthorized === false) {
    return addCacheControlHeaders(NextResponse.redirect(new URL('/pending-approval', request.url)));
  }

  // 3. Authenticated users attempting login pages -> redirect to their role home
  if (isAuthenticated && (pathname === '/login/citizen' || pathname === '/login/staff')) {
    const targetDashboard = getDashboardForRole(role);
    return addCacheControlHeaders(NextResponse.redirect(new URL(targetDashboard, request.url)));
  }

  // 4. Role boundary enforcement (prevent role mismatch access)
  if (isAuthenticated && isProtectedPath) {
    if (role === 'CITIZEN' && !pathname.startsWith('/citizen')) {
      return addCacheControlHeaders(NextResponse.redirect(new URL('/citizen', request.url)));
    }
    if (
      role === 'DEPARTMENT_HEAD' &&
      !pathname.startsWith('/dept-head') &&
      !pathname.startsWith('/department-head')
    ) {
      return addCacheControlHeaders(NextResponse.redirect(new URL('/dept-head', request.url)));
    }
    if (role === 'DEPARTMENT_OFFICER' && !pathname.startsWith('/officer')) {
      return addCacheControlHeaders(NextResponse.redirect(new URL('/officer', request.url)));
    }
    if (role === 'FIELD_WORKER' && !pathname.startsWith('/field-worker')) {
      return addCacheControlHeaders(NextResponse.redirect(new URL('/field-worker', request.url)));
    }
    if ((role === 'ADMIN' || role === 'SUPER_ADMIN') && !pathname.startsWith('/admin')) {
      return addCacheControlHeaders(NextResponse.redirect(new URL('/admin', request.url)));
    }
  }

  return addCacheControlHeaders(NextResponse.next());
}

function getDashboardForRole(role?: string): string {
  switch (role) {
    case 'CITIZEN':
      return '/citizen';
    case 'DEPARTMENT_HEAD':
      return '/dept-head';
    case 'DEPARTMENT_OFFICER':
      return '/officer';
    case 'FIELD_WORKER':
      return '/field-worker';
    case 'ADMIN':
    case 'SUPER_ADMIN':
      return '/admin';
    default:
      return '/login/citizen';
  }
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
