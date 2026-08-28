import { IsNotEmpty, IsString } from 'class-validator';

export class ExchangeCodeDto {
  @IsNotEmpty({ message: 'code is required' })
  @IsString({ message: 'code must be a string' })
  code!: string;
}
