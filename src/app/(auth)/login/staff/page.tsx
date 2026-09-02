'use client';

import React from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, Building2, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const ERROR_MESSAGES: Record<string, string> = {
  google_cancelled: 'Google sign-in was cancelled. Please try again.',
  token_exchange_failed: 'Google authentication failed. Please try again.',
  no_access_token: 'Could not retrieve Google account token. Please try again.',
  userinfo_failed: 'Could not fetch your Google profile. Please try again.',
  no_email: 'Your Google account has no verified email. Please use a different account.',
  server_error: 'A server error occurred during sign-in. Please try again.',
};

function StaffLoginContent() {
  const searchParams = useSearchParams();
  const errorKey = searchParams.get('error');
  const errorMessage = errorKey ? (ERROR_MESSAGES[errorKey] || 'An error occurred during Google sign-in.') : null;

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-4">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-2 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Home
        </Link>

        <Card className="shadow-lg border-primary/20">
          <CardHeader className="text-center space-y-1">
            <div className="mx-auto h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-2">
              <Building2 className="h-7 w-7" />
            </div>
            <CardTitle className="text-2xl font-bold">Staff & Admin Access</CardTitle>
            <CardDescription className="text-sm leading-relaxed">
              Department Officers, Department Heads, Field Workers, and Super Admin sign in
              using their authorized Google account
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-5">
            {/* Error Banner */}
            {errorMessage && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-md text-left">
                {errorMessage}
              </div>
            )}

            {/* Google Sign In */}
            <a href="/api/auth/google" className="block w-full">
              <Button
                size="lg"
                className="w-full flex items-center justify-center gap-3 bg-white text-slate-800 border border-slate-300 hover:bg-slate-50 shadow-sm font-semibold py-6 text-base transition-all"
              >
                <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                Continue with Google
              </Button>
            </a>

            {/* Info Box */}
            <div className="p-3.5 bg-muted/60 rounded-md border text-xs text-muted-foreground flex items-start gap-2.5 text-left leading-relaxed">
              <ShieldAlert className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
              <span>
                When you sign in with Google, we verify your account email against the system database and automatically route you to your assigned portal. Unregistered accounts are placed in a pending approval queue.
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function StaffLoginPage() {
  return (
    <React.Suspense
      fallback={
        <div className="min-h-screen bg-background flex flex-col items-center justify-center space-y-4">
          <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-medium text-muted-foreground">Loading...</p>
        </div>
      }
    >
      <StaffLoginContent />
    </React.Suspense>
  );
}
