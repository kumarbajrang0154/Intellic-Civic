import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class DepartmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async getDepartmentStaff(
    departmentId: string,
    user: { id: string; role: UserRole; departmentId?: string | null },
  ) {
    // Access control: ADMIN or DEPARTMENT_HEAD of that specific department
    if (user.role === UserRole.DEPARTMENT_HEAD && user.departmentId !== departmentId) {
      throw new ForbiddenException('Access denied to team roster outside your department');
    }

    const department = await this.prisma.department.findUnique({
      where: { id: departmentId },
    });

    if (!department) {
      throw new NotFoundException('Department not found');
    }

    const [officers, fieldWorkers] = await Promise.all([
      this.prisma.user.findMany({
        where: {
          departmentId,
          role: {
            in: [UserRole.DEPARTMENT_HEAD, UserRole.DEPARTMENT_OFFICER],
          },
          isAuthorized: true,
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          avatarUrl: true,
          createdAt: true,
        },
        orderBy: { name: 'asc' },
      }),
      this.prisma.fieldWorker.findMany({
        where: {
          departmentId,
          isActive: true,
        },
        select: {
          id: true,
          name: true,
          phoneNumber: true,
          isActive: true,
          createdAt: true,
        },
        orderBy: { name: 'asc' },
      }),
    ]);

    return {
      department: {
        id: department.id,
        name: department.name,
        description: department.description,
      },
      officers,
      fieldWorkers,
    };
  }
}
