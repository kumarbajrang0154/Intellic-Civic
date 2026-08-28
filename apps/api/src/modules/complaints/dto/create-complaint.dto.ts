import { Type } from 'class-transformer';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { PriorityLevel } from '@prisma/client';

export class CreateComplaintLocationDto {
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude: number;

  @IsOptional()
  @IsString()
  address?: string;
}

export class CreateComplaintDto {
  @IsString()
  @Length(5, 200)
  title: string;

  @IsString()
  @MinLength(20)
  description: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  /**
   * Priority suggested by citizen at creation.
   * BUSINESS RULE: Citizens can suggest priority, but backend defaults to MEDIUM if omitted.
   * Staff or AI routing can re-evaluate priority later.
   */
  @IsOptional()
  @IsEnum(PriorityLevel)
  priority?: PriorityLevel;

  @IsOptional()
  @ValidateNested()
  @Type(() => CreateComplaintLocationDto)
  location?: CreateComplaintLocationDto;
}
