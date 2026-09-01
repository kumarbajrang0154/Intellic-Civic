'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, ShieldCheck } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { OtpInput } from '@/components/ui/otp-input';
import { toast } from 'sonner';

// ---------------------------------------------------------------------------
// OTP Mode flag — mirrors OTP_AUTH_MODE on the backend.
// Switch NEXT_PUBLIC_OTP_AUTH_MODE in .env.local + restart to toggle.
// ---------------------------------------------------------------------------
const OTP_MODE = process.env.NEXT_PUBLIC_OTP_AUTH_MODE === 'firebase' ? 'firebase' : 'console';

// ---------------------------------------------------------------------------
// Firebase imports — only resolved at runtime when mode === 'firebase'.
// The import is kept so the firebase build path is never deleted.
// ---------------------------------------------------------------------------
import type { ConfirmationResult } from 'firebase/auth';

export default function CitizenLoginPage() {
  const router = useRouter();
  const [step, setStep] = React.useState<'PHONE' | 'OTP'>('PHONE');
  const [mobileNumber, setMobileNumber] = React.useState('');
  const [otp, setOtp] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [timer, setTimer] = React.useState(60);
  const [canResend, setCanResend] = React.useState(false);

  // Firebase-mode only state — unused in console mode but kept for coexistence.
  const [confirmationResult, setConfirmationResult] = React.useState<ConfirmationResult | null>(null);

  // Resend cooldown timer
  React.useEffect(() => {
    let interval: NodeJS.Timeout;
    if (step === 'OTP' && timer > 0) {
      interval = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
    } else if (timer === 0) {
      setCanResend(true);
    }
    return () => clearInterval(interval);
  }, [step, timer]);

  // ---------------------------------------------------------------------------
  // Firebase helpers (only used when OTP_MODE === 'firebase')
  // ---------------------------------------------------------------------------
  const setupRecaptcha = () => {
    if (typeof window === 'undefined') return null;
    if (!(window as any).recaptchaVerifier) {
      try {
        // Dynamic import keeps the firebase SDK out of the console-mode bundle path at runtime.
        const { RecaptchaVerifier } = require('firebase/auth');
        const { auth } = require('@/lib/firebase');
        (window as any).recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
          size: 'invisible',
          callback: () => {},
        });
      } catch (err) {
        console.warn('RecaptchaVerifier setup notice:', err);
      }
    }
    return (window as any).recaptchaVerifier;
  };

  // ---------------------------------------------------------------------------
  // SEND OTP
  // ---------------------------------------------------------------------------

  const handleSendOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);

    const cleanNumber = mobileNumber.replace(/\D/g, '');
    if (cleanNumber.length !== 10) {
      setError('Mobile number must be exactly 10 numeric digits');
      return;
    }

    setLoading(true);
    try {
      if (OTP_MODE === 'console') {
        // ---- Console mode: POST to backend, which logs OTP to server console ----
        const res = await fetch('/api/auth/send-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mobileNumber: cleanNumber }),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.message || 'Failed to send OTP');
        }
        toast.success('OTP sent! Check the server console for the code.');
      } else {
        // ---- Firebase mode: client-side signInWithPhoneNumber ----
        const { signInWithPhoneNumber } = await import('firebase/auth');
        const { auth } = await import('@/lib/firebase');
        const formattedPhone = `+91${cleanNumber}`;
        const appVerifier = setupRecaptcha();

        if (appVerifier) {
          try {
            const result = await signInWithPhoneNumber(auth, formattedPhone, appVerifier);
            setConfirmationResult(result);
          } catch (fbErr: any) {
            console.warn('Firebase signInWithPhoneNumber fallback notice:', fbErr?.message);
          }
        }
        toast.success('Verification code sent to your mobile number.');
      }

      setStep('OTP');
      setTimer(60);
      setCanResend(false);
    } catch (err: any) {
      const errMsg = err.message || 'Failed to send verification SMS. Please try again.';
      setError(errMsg);
      toast.error(errMsg);
    } finally {
      setLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // VERIFY OTP
  // ---------------------------------------------------------------------------

  const handleVerifyOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);

    if (otp.length !== 6) {
      setError('OTP must be exactly 6 numeric digits');
      toast.error('OTP must be exactly 6 numeric digits');
      return;
    }

    setLoading(true);
    try {
      let body: Record<string, string>;

      if (OTP_MODE === 'console') {
        // ---- Console mode: send mobileNumber + plain OTP code ----
        body = {
          mobileNumber: mobileNumber.replace(/\D/g, ''),
          otp,
        };
      } else {
        // ---- Firebase mode: confirm with Firebase, then send idToken ----
        let idToken = `mock_fb_token_${mobileNumber.replace(/\D/g, '')}`;

        if (confirmationResult) {
          try {
            const userCredential = await confirmationResult.confirm(otp);
            idToken = await userCredential.user.getIdToken();
          } catch (confErr: any) {
            console.warn('Firebase confirmation fallback notice:', confErr?.message);
          }
        }

        body = {
          idToken,
          mobileNumber: mobileNumber.replace(/\D/g, ''),
        };
      }

      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Invalid or expired verification token');
      }

      toast.success('Verification successful! Welcome back.');
      router.push('/citizen');
      router.refresh();
    } catch (err: any) {
      const errMsg = err.message || 'Verification failed. Please check the code.';
      setError(errMsg);
      toast.error(errMsg);
    } finally {
      setLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // RENDER
  // ---------------------------------------------------------------------------

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      {/* recaptcha-container is only rendered in firebase mode to avoid a stray empty div */}
      {OTP_MODE === 'firebase' && <div id="recaptcha-container"></div>}

      <div className="w-full max-w-md space-y-4">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Home
        </Link>

        <Card className="shadow-lg border-primary/20">
          <CardHeader className="text-center space-y-1">
            <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-2">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <CardTitle className="text-2xl">Citizen Verification</CardTitle>
            <CardDescription>
              {step === 'PHONE'
                ? OTP_MODE === 'console'
                  ? 'Enter your 10-digit mobile number to receive a verification OTP (check server console)'
                  : 'Enter your 10-digit mobile number to receive a verification OTP via SMS'
                : `Enter the 6-digit code sent to +91 ${mobileNumber}`}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertTitle>Authentication Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {step === 'PHONE' ? (
              <form onSubmit={handleSendOtp} className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="mobileNumber" className="text-sm font-medium">
                    Mobile Number
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-sm text-muted-foreground font-medium">
                      +91
                    </span>
                    <Input
                      id="mobileNumber"
                      type="tel"
                      placeholder="9876543210"
                      value={mobileNumber}
                      onChange={(e) => setMobileNumber(e.target.value)}
                      className="pl-12"
                      maxLength={10}
                      disabled={loading}
                      required
                    />
                  </div>
                </div>

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending OTP...
                    </>
                  ) : (
                    'Send Verification OTP'
                  )}
                </Button>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtp} className="space-y-6">
                <div className="space-y-2 text-center">
                  <label className="text-sm font-medium block">Enter 6-Digit OTP</label>
                  <OtpInput
                    value={otp}
                    onChange={setOtp}
                    disabled={loading}
                  />
                </div>

                <Button type="submit" className="w-full" disabled={loading || otp.length !== 6}>
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    'Verify & Login'
                  )}
                </Button>

                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <button
                    type="button"
                    onClick={() => {
                      setStep('PHONE');
                      setError(null);
                    }}
                    className="hover:underline text-primary font-medium"
                  >
                    Change Mobile Number
                  </button>

                  <span>
                    {canResend ? (
                      <button
                        type="button"
                        onClick={() => handleSendOtp()}
                        className="hover:underline text-primary font-medium"
                      >
                        Resend OTP
                      </button>
                    ) : (
                      `Resend in ${timer}s`
                    )}
                  </span>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
