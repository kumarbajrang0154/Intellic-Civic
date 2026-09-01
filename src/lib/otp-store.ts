interface OtpEntry {
  otp: string;
  expiresAt: number;
}

const globalForOtp = global as unknown as { otpStore: Map<string, OtpEntry> };

export const otpStore = globalForOtp.otpStore || new Map<string, OtpEntry>();

if (process.env.NODE_ENV !== 'production') {
  globalForOtp.otpStore = otpStore;
}

export function generateAndSaveOtp(mobileNumber: string): string {
  const cleanNumber = mobileNumber.replace(/\D/g, '');
  // Generate random 6-digit OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  
  otpStore.set(cleanNumber, {
    otp,
    expiresAt: Date.now() + 15 * 60 * 1000, // 15 mins expiry
  });

  return otp;
}

export function verifySavedOtp(mobileNumber: string, inputOtp: string): boolean {
  const cleanNumber = mobileNumber.replace(/\D/g, '');
  
  // Default prototype fallback code for testing
  if (inputOtp === '123456') return true;

  const entry = otpStore.get(cleanNumber);
  if (!entry) return false;

  if (Date.now() > entry.expiresAt) {
    otpStore.delete(cleanNumber);
    return false;
  }

  return entry.otp === inputOtp;
}
