'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Building2, Crown, Loader2, ShieldAlert, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function StaffLoginPage() {
  const router = useRouter();
  const [loadingSuperAdmin, setLoadingSuperAdmin] = useState(false);
  const [error, setError] = useState('');

  async function handleSuperAdminDevLogin() {
    setLoadingSuperAdmin(true);
    setError('');
    try {
      const res = await fetch('/api/auth/dev-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'kumarbajrang325@gmail.com' }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        router.push(data.redirectUrl || '/admin');
      } else {
        setError(data.message || 'Failed to authenticate Super Admin session');
      }
    } catch (err: any) {
      setError('An error occurred during authentication');
    } finally {
      setLoadingSuperAdmin(false);
    }
  }

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
            <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-2">
              <Building2 className="h-6 w-6" />
            </div>
            <CardTitle className="text-2xl font-bold">Staff & Super Admin Portal</CardTitle>
            <CardDescription>
              Authorized municipal officers, department heads, and Super Admin (<span className="font-semibold text-primary">kumarbajrang325@gmail.com</span>)
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-5 text-center">
            {error && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-md text-left">
                {error}
              </div>
            )}

            {/* Standard Google Sign in */}
            <a href="/api/auth/google" className="block w-full">
              <Button size="lg" className="w-full flex items-center justify-center gap-3 bg-white text-slate-800 border border-slate-300 hover:bg-slate-50 shadow-sm font-medium">
                <svg className="h-5 w-5" viewBox="0 0 24 24">
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
                Sign in with Google
              </Button>
            </a>

            <div className="relative my-3">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground font-semibold">
                  Super Admin Credentials
                </span>
              </div>
            </div>

            {/* Direct Super Admin Login Button */}
            <Button
              size="lg"
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-blue-700 via-indigo-700 to-purple-800 hover:from-blue-800 hover:to-purple-900 text-white shadow-md font-semibold"
              onClick={handleSuperAdminDevLogin}
              disabled={loadingSuperAdmin}
            >
              {loadingSuperAdmin ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  <Crown className="h-5 w-5 text-amber-300 fill-amber-300/30" />
                  Instant Super Admin Login (kumarbajrang325@gmail.com)
                </>
              )}
            </Button>

            <div className="p-3 bg-muted/60 rounded-md border text-xs text-muted-foreground flex items-center gap-2 text-left">
              <ShieldAlert className="h-5 w-5 text-primary flex-shrink-0" />
              <span>
                Super admin account <strong className="text-foreground font-semibold">kumarbajrang325@gmail.com</strong> has full authority to manage departments, head offices, and officers.
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
