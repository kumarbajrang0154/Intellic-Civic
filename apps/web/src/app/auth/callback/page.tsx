'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';

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

function CallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  React.useEffect(() => {
    const token = searchParams.get('token');
    const refreshToken = searchParams.get('refreshToken');

    if (!token || !refreshToken) {
      router.push('/login/staff');
      return;
    }

    async function setSessionAndRedirect() {
      try {
        const res = await fetch('/api/auth/set-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accessToken: token, refreshToken }),
        });

        if (!res.ok) {
          throw new Error('Failed to set session');
        }

        const payload: any = decodeJwtPayload(token!);
        const role = payload?.role;

        switch (role) {
          case 'CITIZEN':
            router.push('/citizen');
            break;
          case 'DEPARTMENT_HEAD':
          case 'DEPARTMENT_OFFICER':
            router.push('/staff');
            break;
          case 'FIELD_WORKER':
            router.push('/field-worker');
            break;
          case 'ADMIN':
            router.push('/admin');
            break;
          default:
            router.push('/');
            break;
        }
      } catch (err) {
        router.push('/login/staff');
      }
    }

    setSessionAndRedirect();
  }, [searchParams, router]);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center space-y-4">
      <Loader2 className="h-8 w-8 text-primary animate-spin" />
      <p className="text-sm font-medium text-muted-foreground">Authenticating and establishing secure session...</p>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <React.Suspense
      fallback={
        <div className="min-h-screen bg-background flex flex-col items-center justify-center space-y-4">
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
          <p className="text-sm font-medium text-muted-foreground">Loading...</p>
        </div>
      }
    >
      <CallbackContent />
    </React.Suspense>
  );
}
