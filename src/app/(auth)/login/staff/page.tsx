'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Building2, ShieldAlert, KeyRound, Eye, EyeOff, Lock, User, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { showGlobalError } from '@/lib/api-client';

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
  const googleErrorMessage = errorKey ? (ERROR_MESSAGES[errorKey] || 'An error occurred during Google sign-in.') : null;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const handleCredentialsLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !password) {
      const errorMsg = 'Invalid email or password.';
      setLoginError(errorMsg);
      showGlobalError({
        title: 'Authentication Failed',
        message: errorMsg,
        statusCode: 401,
        hint: 'Please check your email and password or contact your municipal administrator.',
      });
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/staff-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, password }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const errorMsg = data?.message || 'Invalid email or password.';
        setLoginError(errorMsg);
        showGlobalError({
          title: 'Authentication Failed',
          message: errorMsg,
          statusCode: res.status,
          hint: 'Please check your email and password or contact your municipal administrator.',
        });
        return;
      }

      // Successful staff login: navigate to assigned portal route
      window.location.href = data.redirectUrl || '/admin';
    } catch (err: any) {
      const msg = err?.message || 'A network error occurred. Please try again.';
      setLoginError(msg);
      showGlobalError({
        title: 'Authentication Error',
        message: msg,
        statusCode: 500,
      });
    } finally {
      setSubmitting(false);
    }
  };

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
                  Sign in using your email & password, or your authorized Google account.
                </p>
              </div>

              {/* Error Banners */}
              {googleErrorMessage && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-950 text-xs font-semibold rounded-2xl text-left">
                  {googleErrorMessage}
                </div>
              )}

              {loginError && (
                <div
                  id="staff-login-error"
                  className="p-3 bg-rose-50 border border-rose-200 text-rose-950 text-xs font-semibold rounded-2xl text-left"
                >
                  {loginError}
                </div>
              )}

              {/* Form: Email & Password */}
              <form onSubmit={handleCredentialsLogin} className="space-y-4" id="staff-credentials-form">
                <div className="space-y-1.5 text-left">
                  <label htmlFor="staff-email" className="text-xs font-bold text-[#131E20] block">
                    Email <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <Input
                      id="staff-email"
                      name="email"
                      type="email"
                      placeholder="e.g. officer@smartcity.gov.in"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={submitting}
                      className="pl-10 h-11 text-sm rounded-xl border-[#E5E2D9] focus:border-[#3468A1] focus:ring-[#3468A1]"
                      autoComplete="email"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1.5 text-left">
                  <label htmlFor="staff-password" className="text-xs font-bold text-[#131E20] block">
                    Password <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <Input
                      id="staff-password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={submitting}
                      className="pl-10 pr-10 h-11 text-sm rounded-xl border-[#E5E2D9] focus:border-[#3468A1] focus:ring-[#3468A1]"
                      autoComplete="current-password"
                      required
                    />
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none p-1"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <Button
                  id="staff-login-submit"
                  type="submit"
                  size="lg"
                  disabled={submitting}
                  className="w-full h-11 flex items-center justify-center gap-2 bg-[#131E20] text-white hover:bg-[#131E20]/90 shadow-xs font-semibold text-sm rounded-full transition-colors min-h-[44px]"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Signing in...</span>
                    </>
                  ) : (
                    <>
                      <KeyRound className="w-4 h-4" />
                      <span>Sign In with Password</span>
                    </>
                  )}
                </Button>
              </form>

              {/* Divider */}
              <div className="relative flex items-center justify-center">
                <div className="border-t border-[#E5E2D9] w-full" />
                <span className="bg-white px-3 text-[11px] font-bold text-[#6E6B64] uppercase tracking-wider absolute">
                  OR
                </span>
              </div>

              {/* Google Sign In Button */}
              <a href="/api/auth/google" className="block w-full" id="google-login-button">
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  className="w-full h-11 flex items-center justify-center gap-3 bg-white text-[#131E20] border border-[#E5E2D9] hover:bg-[#F2EFE6] shadow-xs font-semibold text-sm rounded-full transition-colors min-h-[44px]"
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
                  Staff credentials and Google sign-ins are verified against authorized municipal records. Account lockout activates after 5 consecutive failed attempts.
                </p>
              </div>

              {/* Helper Links at bottom */}
              <div className="pt-2 border-t border-[#E5E2D9] flex items-center justify-center text-xs">
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
