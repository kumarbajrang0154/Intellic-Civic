import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CreateEvidenceDto } from './dto/create-evidence.dto';
import { EvidenceService } from './evidence.service';

@Controller('complaints')
export class EvidenceController {
  constructor(private readonly evidenceService: EvidenceService) {}

  /**
   * POST /api/v1/complaints/:id/evidence
   * Attach photo evidence to a complaint.
   */
  @Post(':id/evidence')
  @Roles(
    UserRole.CITIZEN,
    UserRole.DEPARTMENT_HEAD,
    UserRole.DEPARTMENT_OFFICER,
    UserRole.ADMIN,
  )
  @HttpCode(HttpStatus.CREATED)
  async addEvidence(
    @Param('id') complaintId: string,
    @Body() createEvidenceDto: CreateEvidenceDto,
    @CurrentUser()
    user: { id: string; role: UserRole; departmentId?: string | null },
  ) {
    return this.evidenceService.createEvidence(
      complaintId,
      createEvidenceDto,
      user,
    );
  }
}
