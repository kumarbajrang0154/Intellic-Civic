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
    <div className="min-h-screen bg-[#F2EFE6] flex items-center justify-center p-4 sm:p-6 lg:p-12 font-sans">
      <div className="w-full max-w-5xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          {/* Left Column: Pill badge, Headline, Description, Bullets */}
          <div className="order-2 lg:order-1 lg:col-span-6 space-y-6 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#C9DFDC] text-[#131E20] text-xs font-bold uppercase tracking-wider shadow-2xs">
              <Building2 className="w-4 h-4 text-[#3468A1]" />
              <span>Staff & Administration</span>
            </div>

            <h1 className="text-2xl sm:text-3xl lg:text-5xl font-extrabold text-[#131E20] tracking-tight leading-[1.15]">
              Unified Municipal Operations & AI Triage Center.
            </h1>

            <p className="text-sm sm:text-base text-[#6E6B64] leading-relaxed max-w-lg hidden sm:block">
              Centralized command center for department officers, field technicians, and administrative decision-makers.
            </p>

            {/* Check-icon bullet lines */}
            <div className="space-y-3 pt-1 hidden sm:block">
              <div className="flex items-center gap-3 text-left">
                <div className="w-6 h-6 rounded-full bg-[#3B8F68]/15 text-[#3B8F68] flex items-center justify-center shrink-0">
                  <span className="text-[#3B8F68] font-bold text-xs">✓</span>
                </div>
                <span className="text-xs sm:text-sm font-semibold text-[#131E20]">
                  Automated complaint classification & workload balancing
                </span>
              </div>
              <div className="flex items-center gap-3 text-left">
                <div className="w-6 h-6 rounded-full bg-[#3B8F68]/15 text-[#3B8F68] flex items-center justify-center shrink-0">
                  <span className="text-[#3B8F68] font-bold text-xs">✓</span>
                </div>
                <span className="text-xs sm:text-sm font-semibold text-[#131E20]">
                  Direct field worker assignment & SLA lifecycle management
                </span>
              </div>
            </div>
          </div>

          {/* Right Column: White rounded-3xl Card */}
          <div className="order-1 lg:order-2 lg:col-span-6 w-full max-w-md mx-auto">
            <div className="bg-white rounded-3xl p-6 sm:p-8 md:p-10 border border-[#E5E2D9] shadow-[0_8px_30px_rgba(19,30,32,0.06)] space-y-6">
              {/* Card Header */}
              <div className="space-y-2">
                <span className="text-[11px] font-bold tracking-widest uppercase text-[#6E6B64]">
                  PORTAL LOGIN
                </span>

                <h2 className="text-2xl sm:text-3xl font-extrabold text-[#131E20] tracking-tight">
                  Staff & Admin Access
                </h2>
                <p className="text-xs sm:text-sm text-[#6E6B64] leading-relaxed">
                  Department Officers, Department Heads, Field Workers, and Super Admin sign in
                  using their authorized Google account
                </p>
              </div>

              {/* Error Banner */}
              {errorMessage && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-950 text-xs font-semibold rounded-2xl text-left">
                  {errorMessage}
                </div>
              )}

              {/* Google Sign In Button */}
              <a href="/api/auth/google" className="block w-full">
                <Button
                  variant="outline"
                  size="lg"
                  className="w-full h-11 flex items-center justify-center gap-3 bg-white text-[#131E20] border border-[#E5E2D9] hover:bg-[#F2EFE6] shadow-xs font-semibold text-sm rounded-full transition-colors"
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

              {/* Security Info Box */}
              <div className="p-4 bg-[#F2EFE6]/60 rounded-2xl border border-[#E5E2D9] text-left space-y-1.5">
                <div className="flex items-center gap-2 font-bold text-xs text-[#131E20]">
                  <ShieldAlert className="h-4 w-4 text-[#3468A1] shrink-0" />
                  <span>Secure Staff Access</span>
                </div>
                <p className="text-xs text-[#6E6B64] leading-relaxed">
                  When you sign in with Google, we verify your account email against authorized staff records before access is granted. Unregistered accounts are placed in a pending approval queue.
                </p>
              </div>

              {/* Helper Links at bottom */}
              <div className="pt-2 border-t border-[#E5E2D9] flex flex-col sm:flex-row items-center justify-between gap-2 text-xs">
                <Link
                  href="/"
                  className="inline-flex items-center gap-1.5 text-[#6E6B64] hover:text-[#131E20] font-medium transition-colors h-11 min-h-[44px]"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Back to Home
                </Link>

                <Link
                  href="/login/citizen"
                  className="text-[#3468A1] hover:underline font-semibold h-11 min-h-[44px] inline-flex items-center"
                >
                  Citizen Portal &rarr;
                </Link>
              </div>
            </div>
          </div>
        </div>
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
