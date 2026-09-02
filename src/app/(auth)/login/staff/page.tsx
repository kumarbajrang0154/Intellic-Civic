'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  Crown,
  Globe,
  Loader2,
  Lock,
  Mail,
  ShieldAlert,
  UserCheck,
  UserCog,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

interface DemoAccount {
  name: string;
  email: string;
  roleTitle: string;
  badgeColor: string;
}

const PRESET_ACCOUNTS: DemoAccount[] = [
  {
    name: 'Bajrang Kumar',
    email: 'kumarbajrang325@gmail.com',
    roleTitle: 'Super Admin (System Governance)',
    badgeColor: 'bg-purple-100 text-purple-800 border-purple-200',
  },
  {
    name: 'Rajesh Sharma',
    email: 'head.roads@smartcity.gov.in',
    roleTitle: 'Department Head (Roads & Infrastructure)',
    badgeColor: 'bg-blue-100 text-blue-800 border-blue-200',
  },
  {
    name: 'Amit Patel',
    email: 'officer.roads@smartcity.gov.in',
    roleTitle: 'Department Officer (Roads & Infrastructure)',
    badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  },
  {
    name: 'Priya Verma',
    email: 'head.water@smartcity.gov.in',
    roleTitle: 'Department Head (Water Supply)',
    badgeColor: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  },
  {
    name: 'Suresh Kumar',
    email: 'officer.water@smartcity.gov.in',
    roleTitle: 'Department Officer (Water Supply)',
    badgeColor: 'bg-amber-100 text-amber-800 border-amber-200',
  },
];

export default function StaffLoginPage() {
  const router = useRouter();
  const [isGoogleModalOpen, setIsGoogleModalOpen] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState('kumarbajrang325@gmail.com');
  const [customEmail, setCustomEmail] = useState('');
  const [isCustomMode, setIsCustomMode] = useState(false);
  const [authenticating, setAuthenticating] = useState(false);
  const [error, setError] = useState('');

  async function handleAuthenticateGoogle(emailToUse: string) {
    const finalEmail = emailToUse.trim();
    if (!finalEmail) {
      setError('Please enter a valid Google email address');
      return;
    }

    setAuthenticating(true);
    setError('');
    try {
      const res = await fetch('/api/auth/google-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: finalEmail }),
      });

      const data = await res.json();

      if (res.ok && data.redirectUrl) {
        setIsGoogleModalOpen(false);
        router.push(data.redirectUrl);
      } else {
        setError(data.message || 'Google authentication failed');
      }
    } catch (err: any) {
      setError('An error occurred during Google sign in');
    } finally {
      setAuthenticating(false);
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
            <CardTitle className="text-2xl font-bold">Staff & Governance Portal</CardTitle>
            <CardDescription>
              Officers, Department Heads, and Super Admin (<span className="font-semibold text-primary">kumarbajrang325@gmail.com</span>) sign in via Google OAuth only
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-5 text-center">
            {error && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-md text-left">
                {error}
              </div>
            )}

            {/* Main Google Sign In Button */}
            <Button
              size="lg"
              className="w-full flex items-center justify-center gap-3 bg-white text-slate-800 border border-slate-300 hover:bg-slate-50 shadow-sm font-semibold py-6 text-base"
              onClick={() => {
                setError('');
                setIsGoogleModalOpen(true);
              }}
            >
              <svg className="h-6 w-6" viewBox="0 0 24 24">
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

            <div className="p-3.5 bg-slate-50 rounded-lg border text-xs text-slate-600 flex items-start gap-2.5 text-left leading-relaxed">
              <ShieldAlert className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <span>
                <strong>Role-Based Access Control:</strong> When you sign in with Google, the platform matches your Google ID against the system database and automatically opens your assigned portal (<span className="text-purple-700 font-semibold">Super Admin /admin</span>, <span className="text-blue-700 font-semibold">Dept Head /dept-head</span>, or <span className="text-emerald-700 font-semibold">Officer /officer</span>).
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Google OAuth Account Selection Dialog */}
      <Dialog open={isGoogleModalOpen} onOpenChange={setIsGoogleModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader className="text-center">
            <div className="mx-auto h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center mb-2">
              <svg className="h-6 w-6" viewBox="0 0 24 24">
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
            </div>
            <DialogTitle className="text-xl font-bold">Google Account Sign-In</DialogTitle>
            <DialogDescription>
              Select your Google Account to fetch your role & permissions from database:
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            {error && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded text-left">
                {error}
              </div>
            )}

            {!isCustomMode ? (
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                {PRESET_ACCOUNTS.map((acc) => (
                  <div
                    key={acc.email}
                    className={`p-3 rounded-lg border text-left cursor-pointer transition-all flex items-center justify-between ${
                      selectedEmail === acc.email
                        ? 'border-blue-500 bg-blue-50/50 shadow-sm'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                    onClick={() => setSelectedEmail(acc.email)}
                  >
                    <div>
                      <div className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                        {acc.name}
                        {acc.email === 'kumarbajrang325@gmail.com' && (
                          <Crown className="w-4 h-4 text-amber-500 fill-amber-400/40" />
                        )}
                      </div>
                      <div className="text-xs text-slate-500 font-mono mt-0.5">{acc.email}</div>
                      <div className={`text-[10px] font-semibold mt-1 inline-block px-2 py-0.5 rounded border ${acc.badgeColor}`}>
                        {acc.roleTitle}
                      </div>
                    </div>

                    {selectedEmail === acc.email && (
                      <CheckCircle2 className="w-5 h-5 text-blue-600 shrink-0" />
                    )}
                  </div>
                ))}

                <button
                  type="button"
                  className="w-full text-center text-xs font-semibold text-blue-600 hover:text-blue-700 py-2"
                  onClick={() => setIsCustomMode(true)}
                >
                  + Use another Google Account Email
                </button>
              </div>
            ) : (
              <div className="space-y-3 p-3 bg-slate-50 border rounded-lg">
                <label className="text-xs font-semibold text-slate-700 block">
                  Enter Google Account Email:
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <Input
                    type="email"
                    className="pl-9"
                    placeholder="e.g. officer.name@gmail.com"
                    value={customEmail}
                    onChange={(e) => setCustomEmail(e.target.value)}
                  />
                </div>
                <button
                  type="button"
                  className="text-xs text-slate-500 hover:text-slate-700 underline"
                  onClick={() => setIsCustomMode(false)}
                >
                  Back to registered accounts list
                </button>
              </div>
            )}
          </div>

          <DialogFooter className="mt-2">
            <Button variant="outline" onClick={() => setIsGoogleModalOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold min-w-[140px]"
              onClick={() =>
                handleAuthenticateGoogle(isCustomMode ? customEmail : selectedEmail)
              }
              disabled={authenticating}
            >
              {authenticating ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                'Sign In & Open Portal'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
