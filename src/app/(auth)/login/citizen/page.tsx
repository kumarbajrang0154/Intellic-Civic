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

        let data: any = {};
        const contentType = res.headers.get('content-type');
        if (contentType?.includes('application/json')) {
          data = await res.json();
        } else {
          const responseText = await res.text();
          console.error('API returned non-JSON response:', {
            url: res.url,
            status: res.status,
            contentType,
            body: responseText,
          });
          throw new Error(`Server connection error (${res.status}). Please try again.`);
        }

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

      let data: any = {};
      const contentType = res.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        data = await res.json();
      } else {
        const responseText = await res.text();
        console.error('API returned non-JSON response:', {
          url: res.url,
          status: res.status,
          contentType,
          body: responseText,
        });
        throw new Error(`Server verification error (${res.status}). Please try again.`);
      }

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
    <div className="min-h-screen bg-[#F6F8FB] flex flex-col items-center justify-center p-4">
      {/* Invisible container for Firebase reCAPTCHA */}
      <div id="recaptcha-container"></div>

      <div className="w-full max-w-md space-y-4">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-[#475569] hover:text-[#0F2747] mb-2 font-medium transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Home
        </Link>

        <Card className="shadow-xs border border-[#E2E8F0] bg-white rounded-xl">
          <CardHeader className="text-center space-y-2 pb-4">
            <div className="mx-auto h-12 w-12 rounded-xl bg-[#0F2747] flex items-center justify-center text-white mb-1 shadow-xs">
              <ShieldCheck className="h-6 w-6" />
            </div>

            {/* OTP Auth Mode Status Badge */}
            <div className="flex justify-center pb-1">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#EEF2FF] text-[#4338CA] border border-indigo-200/60">
                {authMode === 'firebase' ? (
                  <>
                    <Smartphone className="h-3 w-3" />
                    <span>Firebase Phone Auth (SMS)</span>
                  </>
                ) : (
                  <>
                    <Terminal className="h-3 w-3" />
                    <span>Development Mode</span>
                  </>
                )}
              </span>
            </div>

            <CardTitle className="text-2xl font-bold text-[#0F2747] tracking-tight">
              Citizen Verification
            </CardTitle>
            <CardDescription className="text-xs text-[#475569] leading-relaxed">
              {step === 'PHONE'
                ? 'Enter your 10-digit mobile number to receive a verification OTP'
                : `Enter the 6-digit verification code sent to +91 ${mobileNumber}`}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive" className="border-rose-200 bg-rose-50 text-rose-900">
                <AlertTitle className="text-xs font-bold text-rose-900">Authentication Error</AlertTitle>
                <AlertDescription className="text-xs text-rose-800">{error}</AlertDescription>
              </Alert>
            )}

            {step === 'PHONE' ? (
              <form onSubmit={handleSendOtp} className="space-y-4">
                <div className="space-y-1.5 text-left">
                  <label htmlFor="mobileNumber" className="text-xs sm:text-sm font-semibold text-[#172033] block">
                    Mobile Number
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-3 text-sm text-[#475569] font-semibold">
                      +91
                    </span>
                    <Input
                      id="mobileNumber"
                      type="tel"
                      placeholder="9876543210"
                      value={mobileNumber}
                      onChange={(e) => setMobileNumber(e.target.value)}
                      className="pl-12 h-11 border-[#CBD5E1] bg-white text-[#172033] placeholder:text-[#64748B] focus:border-[#1769AA] focus:ring-[#1769AA]/20 font-medium"
                      maxLength={10}
                      disabled={loading}
                      required
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full bg-[#1769AA] hover:bg-[#12558a] text-white font-semibold h-11 text-sm rounded-lg shadow-xs transition-colors"
                  disabled={loading}
                >
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
                {/* Console Mode Development Notice Banner */}
                {authMode === 'console' && generatedOtp && (
                  <div className="p-3 bg-indigo-50/70 border border-indigo-200/80 rounded-lg text-center space-y-1.5">
                    <div className="flex items-center justify-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-indigo-900">
                      <KeyRound className="h-3.5 w-3.5 text-indigo-600" />
                      <span>Development Notice — Verification Code</span>
                    </div>
                    <div className="text-2xl font-bold font-mono tracking-widest text-[#0F2747] select-all py-0.5">
                      {generatedOtp}
                    </div>
                    <div className="flex justify-center pt-0.5">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setOtp(generatedOtp)}
                        className="text-xs h-7 px-3 border-indigo-200 text-indigo-700 hover:bg-indigo-100/60 font-medium gap-1"
                      >
                        <Check className="h-3.5 w-3.5 text-indigo-600" />
                        Auto-fill OTP ({generatedOtp})
                      </Button>
                    </div>
                  </div>
                )}

                <div className="space-y-2 text-center">
                  <label className="text-xs sm:text-sm font-semibold text-[#172033] block">
                    Enter 6-Digit OTP Code
                  </label>
                  <OtpInput
                    value={otp}
                    onChange={setOtp}
                    disabled={loading}
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full bg-[#1769AA] hover:bg-[#12558a] text-white font-semibold h-11 text-sm rounded-lg shadow-xs transition-colors"
                  disabled={loading || otp.length !== 6}
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Verifying Code...
                    </>
                  ) : (
                    'Verify & Login'
                  )}
                </Button>

                <div className="flex items-center justify-between text-xs pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setStep('PHONE');
                      setError(null);
                      setOtp('');
                    }}
                    className="hover:underline text-[#1769AA] font-semibold"
                  >
                    Change Mobile Number
                  </button>

                  <span>
                    {canResend ? (
                      <button
                        type="button"
                        onClick={() => handleSendOtp()}
                        className="hover:underline text-[#1769AA] font-semibold"
                      >
                        Resend OTP
                      </button>
                    ) : (
                      <span className="text-[#64748B] font-medium">Resend in {timer}s</span>
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
