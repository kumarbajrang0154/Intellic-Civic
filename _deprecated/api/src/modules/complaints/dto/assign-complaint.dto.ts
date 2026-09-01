import { IsOptional, IsString } from 'class-validator';

export class AssignComplaintDto {
  @IsOptional()
  @IsString()
  departmentId?: string;

  @IsOptional()
  @IsString()
  assignedOfficerId?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
