import { IsNotEmpty, IsString, Matches } from 'class-validator';

export class SendOtpDto {
  @IsNotEmpty({ message: 'mobileNumber is required' })
  @IsString()
  @Matches(/^[0-9]{10}$/, { message: 'mobileNumber must be exactly 10 numeric digits' })
  mobileNumber!: string;
}
