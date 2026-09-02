import prisma from '@/lib/prisma';

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
