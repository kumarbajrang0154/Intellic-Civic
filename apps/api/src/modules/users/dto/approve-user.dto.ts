import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { UserRole } from '@prisma/client';

export class ApproveUserDto {
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @IsOptional()
  @IsUUID()
  departmentId?: string;
}
