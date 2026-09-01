import { Injectable, Logger } from '@nestjs/common';
import { OtpProvider } from '../interfaces/otp-provider.interface';

@Injectable()
export class ConsoleOtpProvider implements OtpProvider {
  private readonly logger = new Logger(ConsoleOtpProvider.name);

  async sendOtp(mobileNumber: string, otpCode: string): Promise<boolean> {
    this.logger.log(`==================================================`);
    this.logger.log(`[DEV SMS SIMULATOR] OTP for +91${mobileNumber}: ${otpCode}`);
    this.logger.log(`==================================================`);
    return true;
  }
}
