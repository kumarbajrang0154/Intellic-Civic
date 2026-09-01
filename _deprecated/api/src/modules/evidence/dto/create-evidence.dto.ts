import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { EvidenceStage } from '@prisma/client';

export class CreateEvidenceDto {
  @IsOptional()
  @IsEnum(EvidenceStage)
  stage?: EvidenceStage;

  @IsString()
  @IsNotEmpty()
  imageUrl: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
