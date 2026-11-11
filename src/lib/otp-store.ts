import prisma from '@/lib/prisma';

export interface OtpEnv {
  NODE_ENV?: string;
  VERCEL_ENV?: string;
}

export interface ConsoleOtpResponsePayload {
  success: true;
  message: string;
  otp?: string;
  mobileNumber: string;
  mode: 'console';
}

/** Returns true when running in Node or Vercel production environments. */
export function isProductionOtpEnv(env: OtpEnv = process.env): boolean {
  return env.NODE_ENV === 'production' || env.VERCEL_ENV === 'production';
}

/** Expose console OTP only in non-production development mode. */
export function shouldExposeOtpInResponse(env: OtpEnv = process.env): boolean {
  return !isProductionOtpEnv(env) && env.NODE_ENV === 'development';
}

/**
 * Builds the send-otp JSON payload for console mode, omitting the `otp` key
 * in production or any non-development environment.
 */
export function buildConsoleOtpResponsePayload(
  mobileNumber: string,
  otp: string,
  env: OtpEnv = process.env,
): ConsoleOtpResponsePayload {
  if (shouldExposeOtpInResponse(env)) {
    return {
      success: true,
      message: 'OTP sent successfully',
      otp,
      mobileNumber,
      mode: 'console',
    };
  }

  return {
    success: true,
    message: 'OTP sent successfully',
    mobileNumber,
    mode: 'console',
  };
}

export async function generateAndSaveOtp(mobileNumber: string): Promise<string> {
  const cleanNumber = mobileNumber.replace(/\D/g, '');
  // Generate random 6-digit OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  await prisma.otpRequest.create({
    data: {
      mobileNumber: cleanNumber,
      otpCode: otp,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 mins expiry
    },
  });

  return otp;
}

export interface OtpRequestRecord {
  id: string;
  otpCode: string;
}

export interface OtpRequestStore {
  findFirst: (args: {
    where: {
      mobileNumber: string;
      isVerified: boolean;
      expiresAt: { gt: Date };
    };
    orderBy: { createdAt: 'desc' };
  }) => Promise<OtpRequestRecord | null>;
  update: (args: {
    where: { id: string };
    data: { isVerified: boolean };
  }) => Promise<unknown>;
}

export interface VerifySavedOtpOptions {
  env?: OtpEnv;
  otpRequestStore?: OtpRequestStore;
}

const defaultOtpRequestStore: OtpRequestStore = {
  findFirst: (args) => prisma.otpRequest.findFirst(args),
  update: (args) => prisma.otpRequest.update(args),
};

export async function verifySavedOtp(
  mobileNumber: string,
  inputOtp: string,
  options: VerifySavedOtpOptions = {},
): Promise<boolean> {
  const cleanNumber = mobileNumber.replace(/\D/g, '');
  const env = options.env ?? process.env;

  // Prototype default code for rapid local testing (disabled in production / non-dev)
  if (!isProductionOtpEnv(env) && env.NODE_ENV === 'development' && inputOtp === '123456') {
    return true;
  }

  const store = options.otpRequestStore ?? defaultOtpRequestStore;

  const entry = await store.findFirst({
    where: {
      mobileNumber: cleanNumber,
      isVerified: false,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!entry) return false;

  if (entry.otpCode === inputOtp) {
    await store.update({
      where: { id: entry.id },
      data: { isVerified: true },
    });
    return true;
  }

  return false;
}
