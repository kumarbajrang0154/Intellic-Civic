export interface OtpProvider {
  sendOtp(mobileNumber: string, otpCode: string): Promise<boolean>;
}

export const OTP_PROVIDER_TOKEN = 'OTP_PROVIDER_TOKEN';
