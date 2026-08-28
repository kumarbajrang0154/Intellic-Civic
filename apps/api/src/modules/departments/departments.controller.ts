import { Controller, Get, Param } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { DepartmentsService } from './departments.service';

@Controller('departments')
export class DepartmentsController {
  constructor(private readonly departmentsService: DepartmentsService) {}

  @Get(':id/staff')
  @Roles(UserRole.ADMIN, UserRole.DEPARTMENT_HEAD, UserRole.DEPARTMENT_OFFICER)
  async getDepartmentStaff(
    @Param('id') departmentId: string,
    @CurrentUser() user: { id: string; role: UserRole; departmentId?: string | null },
  ) {
    return this.departmentsService.getDepartmentStaff(departmentId, user);
  }
}
