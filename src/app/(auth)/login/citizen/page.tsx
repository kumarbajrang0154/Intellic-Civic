'use client';

export const dynamic = 'force-dynamic';

import * as React from 'react';
import Link from 'next/link';
import { Loader2, ShieldCheck, KeyRound, Check, Smartphone, Terminal } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { OtpInput } from '@/components/ui/otp-input';
import { toast } from 'sonner';
import { auth } from '@/lib/firebase';
import { RecaptchaVerifier, signInWithPhoneNumber, type ConfirmationResult } from 'firebase/auth';

export default function CitizenLoginPage() {
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

  // ---------------------------------------------------------------------------
  // Firebase error code → user-friendly message
  // ---------------------------------------------------------------------------
  function firebaseErrorMessage(err: any): string {
    const code: string = err?.code ?? '';
    switch (code) {
      case 'auth/invalid-phone-number':    return 'Please enter a valid 10-digit phone number.';
      case 'auth/too-many-requests':       return 'Too many attempts. Please wait a few minutes and try again.';
      case 'auth/invalid-verification-code': return 'Incorrect OTP. Please check and try again.';
      case 'auth/code-expired':            return 'OTP has expired. Please request a new one.';
      case 'auth/quota-exceeded':          return 'SMS quota exceeded. Please try again later.';
      case 'auth/missing-phone-number':    return 'Phone number is required.';
      case 'auth/captcha-check-failed':    return 'reCAPTCHA verification failed. Please refresh and try again.';
      case 'auth/network-request-failed':  return 'Network error. Check your connection and try again.';
      case 'auth/user-disabled':           return 'This account has been disabled.';
      case 'auth/billing-not-enabled':     return 'Firebase Phone Auth requires enabling the Blaze plan or adding test phone numbers in Firebase Console.';
      case 'auth/operation-not-allowed':   return 'Phone authentication is not enabled in your Firebase Console (Authentication → Sign-in method → Phone).';
      default: return err?.message || 'Verification failed. Please try again.';
    }
  }

  // ---------------------------------------------------------------------------
  // reCAPTCHA verifier lifecycle — always clear before recreating
  // ---------------------------------------------------------------------------
  function clearRcVerifier() {
    try {
      const v = (window as any).__rcVerifier as RecaptchaVerifier | undefined;
      if (v) v.clear();
    } catch (_) { /* ignore — may already be cleared */ }
    (window as any).__rcVerifier = undefined;
  }

  // Cleanup verifier when navigating away
  React.useEffect(() => {
    return () => { clearRcVerifier(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        // ── Firebase SDK path ────────────────────────────────────────────────
        // Always destroy any prior verifier before (re)creating — a previous
        // failed attempt or resend leaves the widget in a broken/used state.
        clearRcVerifier();

        const recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
          size: 'invisible',
          callback: () => { /* solved automatically */ },
          'expired-callback': () => { clearRcVerifier(); },
        });
        (window as any).__rcVerifier = recaptchaVerifier;

        const formattedPhone = `+91${cleanNumber}`;
        const confirmation = await signInWithPhoneNumber(auth, formattedPhone, recaptchaVerifier);
        setConfirmationResult(confirmation);
        // Mask number in toast for privacy
        toast.success(`Verification code sent to +91 ••••${cleanNumber.slice(-4)}`);
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
      console.error('[OTP Send Error]', err);
      const errMsg = authMode === 'firebase'
        ? firebaseErrorMessage(err)
        : (err?.message || 'Failed to send verification code. Please try again.');
      setError(errMsg);
      toast.error(errMsg);
      // On any firebase send failure, clean up so the next attempt starts fresh
      if (authMode === 'firebase') clearRcVerifier();
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
          throw new Error('Verification session expired. Please request a new OTP.');
        }

        // 1. Confirm the code with Firebase client SDK
        let userCredential;
        try {
          userCredential = await confirmationResult.confirm(otp);
        } catch (fbErr: any) {
          // Map Firebase error codes to readable messages before re-throwing
          throw new Error(firebaseErrorMessage(fbErr));
        }

        // 2. Get short-lived Firebase ID token to hand off to our BFF
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
      console.error('[OTP Verify Error]', err);
      const errMsg = err?.message || 'Verification failed. Please check the code.';
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
    <div className="min-h-screen bg-[#F2EFE6] flex items-center justify-center p-4 sm:p-6 lg:p-12 font-sans">
      {/* Invisible container for Firebase reCAPTCHA */}
      <div id="recaptcha-container"></div>

      <div className="w-full max-w-5xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          {/* Left Column: Pill badge, Headline, Description, Bullets */}
          <div className="order-2 lg:order-1 lg:col-span-6 space-y-6 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#C9DFDC] text-[#131E20] text-xs font-bold uppercase tracking-wider shadow-2xs">
              <ShieldCheck className="w-4 h-4 text-[#3468A1]" />
              <span>IntelliCivic Platform</span>
            </div>

            <h1 className="text-2xl sm:text-3xl lg:text-5xl font-extrabold text-[#131E20] tracking-tight leading-[1.15]">
              Empowering Citizens with Smart AI Governance.
            </h1>

            <p className="text-sm sm:text-base text-[#6E6B64] leading-relaxed max-w-lg hidden sm:block">
              Report civic complaints effortlessly, get instant AI department triage, and monitor resolution progress in real time.
            </p>

            {/* Check-icon bullet lines */}
            <div className="space-y-3 pt-1 hidden sm:block">
              <div className="flex items-center gap-3 text-left">
                <div className="w-6 h-6 rounded-full bg-[#3B8F68]/15 text-[#3B8F68] flex items-center justify-center shrink-0">
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                </div>
                <span className="text-xs sm:text-sm font-semibold text-[#131E20]">
                  Automated routing to municipal department officers
                </span>
              </div>
              <div className="flex items-center gap-3 text-left">
                <div className="w-6 h-6 rounded-full bg-[#3B8F68]/15 text-[#3B8F68] flex items-center justify-center shrink-0">
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                </div>
                <span className="text-xs sm:text-sm font-semibold text-[#131E20]">
                  Offline-ready queue with automatic background sync
                </span>
              </div>
            </div>
          </div>

          {/* Right Column: White rounded-3xl Card */}
          <div className="order-1 lg:order-2 lg:col-span-6 w-full max-w-md mx-auto">
            <div className="bg-white rounded-3xl p-6 sm:p-8 md:p-10 border border-[#E5E2D9] shadow-[0_8px_30px_rgba(19,30,32,0.06)] space-y-6">
              {/* Card Header */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold tracking-widest uppercase text-[#6E6B64]">
                    PORTAL LOGIN
                  </span>
                  {/* Mode badge */}
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-[#C9DFDC]/60 text-[#131E20]">
                    {authMode === 'firebase' ? (
                      <>
                        <Smartphone className="h-3 w-3 text-[#3468A1]" />
                        <span>SMS Auth</span>
                      </>
                    ) : (
                      <>
                        <Terminal className="h-3 w-3 text-[#3468A1]" />
                        <span>Dev Mode</span>
                      </>
                    )}
                  </span>
                </div>

                <h2 className="text-2xl sm:text-3xl font-extrabold text-[#131E20] tracking-tight">
                  Citizen Verification
                </h2>
                <p className="text-xs sm:text-sm text-[#6E6B64] leading-relaxed">
                  {step === 'PHONE'
                    ? 'Enter your 10-digit mobile number to receive a verification OTP'
                    : `Enter the 6-digit verification code sent to +91 ${mobileNumber}`}
                </p>
              </div>

              {error && (
                <Alert variant="destructive" className="rounded-2xl border-rose-200 bg-rose-50 text-rose-950 p-4">
                  <AlertTitle className="text-xs font-bold text-rose-950">Authentication Error</AlertTitle>
                  <AlertDescription className="text-xs text-rose-900 font-medium">{error}</AlertDescription>
                </Alert>
              )}

              {step === 'PHONE' ? (
                <form onSubmit={handleSendOtp} className="space-y-5">
                  <div className="space-y-2 text-left">
                    <label htmlFor="mobileNumber" className="text-[11px] font-bold uppercase tracking-wider text-[#6E6B64] block">
                      MOBILE NUMBER
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-3 text-sm text-[#131E20] font-semibold select-none">
                        +91
                      </span>
                      <Input
                        id="mobileNumber"
                        type="tel"
                        placeholder="9876543210"
                        value={mobileNumber}
                        onChange={(e) => setMobileNumber(e.target.value)}
                        className="pl-14 h-11 rounded-2xl border-[#E5E2D9] bg-white text-[#131E20] placeholder:text-[#6E6B64] focus:border-[#3468A1] focus:ring-[#3468A1]/20 font-medium text-base md:text-sm"
                        maxLength={10}
                        disabled={loading}
                        required
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    className="w-full h-11 md:h-11 text-sm font-bold rounded-full bg-[#3468A1] hover:bg-[#2B5687] text-white shadow-sm"
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
                  {authMode === 'console' && generatedOtp && (
                    <div className="p-3.5 bg-[#C9DFDC]/30 border border-[#C9DFDC] rounded-2xl text-center space-y-1.5">
                      <div className="flex items-center justify-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[#131E20]">
                        <KeyRound className="h-3.5 w-3.5 text-[#3468A1]" />
                        <span>Development Code</span>
                      </div>
                      <div className="text-2xl font-bold font-mono tracking-widest text-[#131E20] select-all py-0.5">
                        {generatedOtp}
                      </div>
                      <div className="flex justify-center pt-0.5">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setOtp(generatedOtp)}
                          className="h-10 px-3 border-[#C9DFDC] text-[#131E20] bg-white hover:bg-[#F2EFE6] font-semibold gap-1 text-xs rounded-full"
                        >
                          <Check className="h-3.5 w-3.5 text-[#3B8F68]" />
                          Auto-fill OTP ({generatedOtp})
                        </Button>
                      </div>
                    </div>
                  )}

                  <div className="space-y-2 text-center">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-[#6E6B64] block">
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
                    className="w-full h-11 md:h-11 text-sm font-bold rounded-full bg-[#3468A1] hover:bg-[#2B5687] text-white shadow-sm"
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
                        setConfirmationResult(null);
                      }}
                      className="hover:underline text-[#3468A1] font-semibold h-11 min-h-[44px] inline-flex items-center"
                    >
                      Change Mobile Number
                    </button>

                    <span>
                      {canResend ? (
                        <button
                          type="button"
                          onClick={() => handleSendOtp()}
                          className="hover:underline text-[#3468A1] font-semibold h-11 min-h-[44px] inline-flex items-center"
                        >
                          Resend OTP
                        </button>
                      ) : (
                        <span className="text-[#6E6B64] font-medium inline-flex items-center h-11 min-h-[44px]">Resend in {timer}s</span>
                      )}
                    </span>
                  </div>
                </form>
              )}

              {/* Helper Links at bottom */}
              <div className="pt-2 border-t border-[#E5E2D9] flex items-center justify-center text-xs">
                <Link
                  href="/login/staff"
                  className="text-[#3468A1] hover:underline font-semibold h-11 min-h-[44px] inline-flex items-center"
                >
                  Staff Login &rarr;
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
