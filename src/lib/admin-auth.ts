/**
 * Admin & Super Admin RBAC helpers.
 * Call requireAdmin() for general admin endpoints.
 * Call requireSuperAdmin() for platform settings and global configuration endpoints.
 */

import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { decodeJwtToken } from '@/lib/auth-jwt';
import { getUserByEmail } from '@/lib/staff-dept-store';

export interface AdminPayload {
  id: string;
  name: string;
  email: string;
  role: string;
}

type RequireAdminResult =
  | { authorized: true; admin: AdminPayload }
  | { authorized: false; response: NextResponse };

export async function requireAdmin(): Promise<RequireAdminResult> {
  const cookieStore = cookies();
  const token = cookieStore.get('ic_access_token')?.value;

  if (!token) {
    return {
      authorized: false,
      response: NextResponse.json({ message: 'Authentication required.' }, { status: 401 }),
    };
  }

  const payload = decodeJwtToken(token);
  if (!payload || (payload.exp && payload.exp * 1000 < Date.now())) {
    return {
      authorized: false,
      response: NextResponse.json({ message: 'Session expired. Please sign in again.' }, { status: 401 }),
    };
  }

  // Re-verify from store in case role was changed
  const storeUser = payload.email ? await getUserByEmail(payload.email) : null;
  const effectiveRole = storeUser?.role ?? payload.role;

  if (effectiveRole !== 'ADMIN' && effectiveRole !== 'SUPER_ADMIN') {
    return {
      authorized: false,
      response: NextResponse.json({ message: 'Forbidden: Admin access required.' }, { status: 403 }),
    };
  }

  if (storeUser?.isSuspended) {
    return {
      authorized: false,
      response: NextResponse.json({ message: 'Your account has been suspended.' }, { status: 403 }),
    };
  }

  return {
    authorized: true,
    admin: {
      id: storeUser?.id ?? payload.sub,
      name: storeUser?.name ?? payload.name ?? 'Admin',
      email: storeUser?.email ?? payload.email,
      role: effectiveRole,
    },
  };
}

export async function requireSuperAdmin(): Promise<RequireAdminResult> {
  const cookieStore = cookies();
  const token = cookieStore.get('ic_access_token')?.value;

  if (!token) {
    return {
      authorized: false,
      response: NextResponse.json({ message: 'Authentication required.' }, { status: 401 }),
    };
  }

  const payload = decodeJwtToken(token);
  if (!payload || (payload.exp && payload.exp * 1000 < Date.now())) {
    return {
      authorized: false,
      response: NextResponse.json({ message: 'Session expired. Please sign in again.' }, { status: 401 }),
    };
  }

  const storeUser = payload.email ? await getUserByEmail(payload.email) : null;
  const effectiveRole = storeUser?.role ?? payload.role;

  if (effectiveRole !== 'SUPER_ADMIN') {
    return {
      authorized: false,
      response: NextResponse.json({ message: 'Forbidden: Super Admin access required.' }, { status: 403 }),
    };
  }

  if (storeUser?.isSuspended) {
    return {
      authorized: false,
      response: NextResponse.json({ message: 'Your account has been suspended.' }, { status: 403 }),
    };
  }

  return {
    authorized: true,
    admin: {
      id: storeUser?.id ?? payload.sub,
      name: storeUser?.name ?? payload.name ?? 'Super Admin',
      email: storeUser?.email ?? payload.email,
      role: 'SUPER_ADMIN',
    },
  };
}
