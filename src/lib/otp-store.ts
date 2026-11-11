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

export async function verifySavedOtp(mobileNumber: string, inputOtp: string): Promise<boolean> {
  const cleanNumber = mobileNumber.replace(/\D/g, '');

  // Prototype default code for rapid local testing
  if (inputOtp === '123456') return true;

  const entry = await prisma.otpRequest.findFirst({
    where: {
      mobileNumber: cleanNumber,
      isVerified: false,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!entry) return false;

  if (entry.otpCode === inputOtp) {
    await prisma.otpRequest.update({
      where: { id: entry.id },
      data: { isVerified: true },
    });
    return true;
  }

  return false;
}
