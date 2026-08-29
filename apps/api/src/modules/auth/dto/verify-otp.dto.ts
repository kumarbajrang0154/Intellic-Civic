import { IsOptional, IsString, Matches } from 'class-validator';

export class VerifyOtpDto {
  /**
   * Firebase mode: required — the Firebase ID token from signInWithPhoneNumber.confirm().
   * Console mode: not used.
   */
  @IsOptional()
  @IsString()
  idToken?: string;

  /**
   * Both modes: the 10-digit mobile number.
   * Firebase mode: used to standardize the phone number when idToken lacks it.
   * Console mode: required to look up the OtpRequest record.
   */
  @IsOptional()
  @IsString()
  mobileNumber?: string;

  /**
   * Console mode only: the plain 6-digit OTP code entered by the user.
   */
  @IsOptional()
  @IsString()
  @Matches(/^[0-9]{6}$/, { message: 'otp must be exactly 6 numeric digits' })
  otp?: string;
}
