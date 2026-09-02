'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, ShieldCheck, KeyRound, Check, Smartphone, Terminal } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { OtpInput } from '@/components/ui/otp-input';
import { toast } from 'sonner';
import { auth } from '@/lib/firebase';
import { RecaptchaVerifier, signInWithPhoneNumber, type ConfirmationResult } from 'firebase/auth';

export default function CitizenLoginPage() {
  const router = useRouter();
  const [step, setStep] = React.useState<'PHONE' | 'OTP'>('PHONE');
  const [mobileNumber, setMobileNumber] = React.useState('');
  const [otp, setOtp] = React.useState('');
  const [generatedOtp, setGeneratedOtp] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [timer, setTimer] = React.useState(60);
  const [canResend, setCanResend] = React.useState(false);
  const [confirmationResult, setConfirmationResult] = React.useState<ConfirmationResult | null>(null);

  const authMode = (process.env.NEXT_PUBLIC_OTP_AUTH_MODE || 'console').toLowerCase();

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
  // SEND OTP (CONSOLE VS FIREBASE BRANCHING)
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
      if (authMode === 'firebase') {
        // Firebase Client SDK Mode (Real SMS)
        let recaptchaVerifier = (window as any).recaptchaVerifier;
        if (!recaptchaVerifier) {
          recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
            size: 'invisible',
            callback: () => {
              console.log('Firebase reCAPTCHA verified');
            },
          });
          (window as any).recaptchaVerifier = recaptchaVerifier;
        }

        const formattedPhone = `+91${cleanNumber}`;
        const confirmation = await signInWithPhoneNumber(auth, formattedPhone, recaptchaVerifier);
        setConfirmationResult(confirmation);
        toast.success(`Firebase SMS sent to ${formattedPhone}`);
      } else {
        // Console Mode (Dev/Testing Prototype)
        const res = await fetch('/api/auth/send-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mobileNumber: cleanNumber }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.message || 'Failed to send OTP');
        }

        const receivedOtp = data.otp || '123456';
        setGeneratedOtp(receivedOtp);
        toast.success(`Verification OTP generated: ${receivedOtp}`);
      }

      setStep('OTP');
      setTimer(60);
      setCanResend(false);
    } catch (err: any) {
      console.error('OTP Send Error:', err);
      const errMsg = err.message || 'Failed to send verification code. Please try again.';
      setError(errMsg);
      toast.error(errMsg);
    } finally {
      setLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // VERIFY OTP (CONSOLE VS FIREBASE BRANCHING)
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
      const cleanNumber = mobileNumber.replace(/\D/g, '');
      let reqBody: any = { mobileNumber: cleanNumber };

      if (authMode === 'firebase') {
        if (!confirmationResult) {
          throw new Error('Firebase confirmation session expired. Please resend OTP.');
        }

        // 1. Confirm code with Firebase Client SDK
        const userCredential = await confirmationResult.confirm(otp);
        // 2. Fetch Firebase ID token
        const idToken = await userCredential.user.getIdToken();
        reqBody.idToken = idToken;
      } else {
        reqBody.otp = otp;
      }

      // 3. Post to backend verify-otp route
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reqBody),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Invalid or expired verification code');
      }

      if (data.isFirstTime || !data.user?.isProfileComplete) {
        toast.success('Welcome! Please complete your citizen profile details.');
        window.location.href = '/citizen/profile?firstTime=true';
      } else {
        toast.success(`Verification successful! Welcome back, ${data.user?.name || 'Citizen'}.`);
        window.location.href = '/citizen';
      }
    } catch (err: any) {
      console.error('OTP Verification Error:', err);
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
      {/* Invisible container for Firebase reCAPTCHA */}
      <div id="recaptcha-container"></div>

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

            {/* OTP Auth Mode Status Badge */}
            <div className="flex justify-center pb-1">
              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                authMode === 'firebase'
                  ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/30'
                  : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
              }`}>
                {authMode === 'firebase' ? (
                  <>
                    <Smartphone className="h-3 w-3" />
                    <span>Firebase Phone Auth (Real SMS)</span>
                  </>
                ) : (
                  <>
                    <Terminal className="h-3 w-3" />
                    <span>Console Mode (Dev Prototype)</span>
                  </>
                )}
              </span>
            </div>

            <CardTitle className="text-2xl">Citizen Verification</CardTitle>
            <CardDescription>
              {step === 'PHONE'
                ? 'Enter your 10-digit mobile number to receive a verification OTP'
                : `Enter the 6-digit verification code for +91 ${mobileNumber}`}
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
                      Sending Verification Code...
                    </>
                  ) : (
                    'Send Verification OTP'
                  )}
                </Button>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtp} className="space-y-5">
                {/* Console Mode Prototype OTP Banner */}
                {authMode === 'console' && generatedOtp && (
                  <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl space-y-2 text-center text-emerald-900 dark:text-emerald-200">
                    <div className="flex items-center justify-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                      <KeyRound className="h-4 w-4" />
                      <span>Prototype Verification Code</span>
                    </div>
                    <div className="text-3xl font-extrabold font-mono tracking-widest text-emerald-600 dark:text-emerald-400 select-all py-1">
                      {generatedOtp}
                    </div>
                    <div className="flex justify-center pt-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setOtp(generatedOtp)}
                        className="text-xs h-8 px-3 border-emerald-500/40 text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-300 gap-1.5"
                      >
                        <Check className="h-3.5 w-3.5" />
                        Auto-fill OTP ({generatedOtp})
                      </Button>
                    </div>
                  </div>
                )}

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
                      Verifying Code...
                    </>
                  ) : (
                    'Verify & Login'
                  )}
                </Button>

                <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setStep('PHONE');
                      setError(null);
                      setOtp('');
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
