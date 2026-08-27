import { IsNotEmpty, IsString, Matches } from 'class-validator';

export class VerifyOtpDto {
  @IsNotEmpty({ message: 'mobileNumber is required' })
  @IsString()
  @Matches(/^[0-9]{10}$/, { message: 'mobileNumber must be exactly 10 numeric digits' })
  mobileNumber!: string;

  @IsNotEmpty({ message: 'otp is required' })
  @IsString()
  @Matches(/^[0-9]{6}$/, { message: 'otp must be exactly 6 numeric digits' })
  otp!: string;
}
