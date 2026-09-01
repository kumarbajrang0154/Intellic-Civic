'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';

function CallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  React.useEffect(() => {
    const code = searchParams.get('code');

    if (!code) {
      router.push('/login/staff');
      return;
    }

    async function exchangeCodeAndRedirect() {
      try {
        const res = await fetch('/api/auth/exchange-code', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code }),
        });

        const data = await res.json();

        if (!res.ok || !data.user) {
          throw new Error(data.message || 'Failed to exchange authorization code');
        }

        const role = data.user.role;

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

    exchangeCodeAndRedirect();
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
