import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ComplaintsService } from './complaints.service';
import { AssignComplaintDto } from './dto/assign-complaint.dto';
import { CreateComplaintDto } from './dto/create-complaint.dto';
import { ListComplaintsQueryDto } from './dto/list-complaints-query.dto';
import { UpdateComplaintStatusDto } from './dto/update-complaint-status.dto';

// TODO: Add OpenAPI/Swagger decorators (@ApiTags('Complaints'), @ApiOperation, @ApiResponse) once Swagger is bootstrapped in main.ts

@Controller('complaints')
export class ComplaintsController {
  constructor(private readonly complaintsService: ComplaintsService) {}

  /**
   * POST /api/v1/complaints
   * Create a new complaint. Allowed for CITIZEN role only.
   */
  @Post()
  @Roles(UserRole.CITIZEN)
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentUser() user: { id: string },
    @Body() createComplaintDto: CreateComplaintDto,
  ) {
    return this.complaintsService.create(user, createComplaintDto);
  }

  /**
   * GET /api/v1/complaints
   * List complaints with role-aware scoping and filters.
   */
  @Get()
  async findAll(
    @CurrentUser()
    user: { id: string; role: UserRole; departmentId?: string | null },
    @Query() query: ListComplaintsQueryDto,
  ) {
    return this.complaintsService.findAll(user, query);
  }

  /**
   * GET /api/v1/complaints/stats/summary
   * System-wide summary stats for Super Admin dashboard.
   */
  @Get('stats/summary')
  @Roles(UserRole.ADMIN)
  async getSystemStats() {
    return this.complaintsService.getSystemStats();
  }

  /**
   * GET /api/v1/complaints/:id
   * Get single complaint detail by ID.
   */
  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @CurrentUser()
    user: { id: string; role: UserRole; departmentId?: string | null },
  ) {
    return this.complaintsService.findOne(id, user);
  }

  /**
   * PATCH /api/v1/complaints/:id/status
   * Update complaint status. Allowed for DEPARTMENT_HEAD, DEPARTMENT_OFFICER, ADMIN.
   */
  @Patch(':id/status')
  @Roles(UserRole.DEPARTMENT_HEAD, UserRole.DEPARTMENT_OFFICER, UserRole.ADMIN)
  async updateStatus(
    @Param('id') id: string,
    @Body() updateComplaintStatusDto: UpdateComplaintStatusDto,
    @CurrentUser()
    user: { id: string; role: UserRole; departmentId?: string | null },
  ) {
    return this.complaintsService.updateStatus(id, updateComplaintStatusDto, user);
  }

  /**
   * PATCH /api/v1/complaints/:id/assign
   * Manually assign complaint to a department or department officer. Allowed for ADMIN, DEPARTMENT_HEAD.
   */
  @Patch(':id/assign')
  @Post(':id/assign')
  @Roles(UserRole.ADMIN, UserRole.DEPARTMENT_HEAD)
  async assignComplaint(
    @Param('id') id: string,
    @Body() assignComplaintDto: AssignComplaintDto,
    @CurrentUser()
    user: { id: string; role: UserRole; departmentId?: string | null },
  ) {
    return this.complaintsService.assignComplaint(id, assignComplaintDto, user);
  }

  /**
   * PATCH /api/v1/complaints/:id/reject-suggestion
   * POST /api/v1/complaints/:id/reject-suggestion
   * Reject an AI department suggestion. Allowed for ADMIN, DEPARTMENT_HEAD.
   */
  @Patch(':id/reject-suggestion')
  @Post(':id/reject-suggestion')
  @Roles(UserRole.ADMIN, UserRole.DEPARTMENT_HEAD)
  async rejectAiSuggestion(
    @Param('id') id: string,
    @CurrentUser()
    user: { id: string; role: UserRole; departmentId?: string | null },
  ) {
    return this.complaintsService.rejectAiSuggestion(id, user);
  }
}
