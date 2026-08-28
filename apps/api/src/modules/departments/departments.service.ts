import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ComplaintStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';

@Injectable()
export class DepartmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    const departments = await this.prisma.department.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: {
            users: true,
            complaints: true,
          },
        },
      },
    });

    // Compute active complaints count per department
    const activeCounts = await this.prisma.complaint.groupBy({
      by: ['departmentId'],
      where: {
        status: {
          in: [
            ComplaintStatus.SUBMITTED,
            ComplaintStatus.AI_PROCESSING,
            ComplaintStatus.PENDING_DEPT_REVIEW,
            ComplaintStatus.ASSIGNED,
            ComplaintStatus.IN_PROGRESS,
          ],
        },
        departmentId: { not: null },
      },
      _count: {
        id: true,
      },
    });

    const activeMap = new Map<string, number>();
    for (const item of activeCounts) {
      if (item.departmentId) {
        activeMap.set(item.departmentId, item._count.id);
      }
    }

    return departments.map((dept) => ({
      id: dept.id,
      name: dept.name,
      description: dept.description,
      createdAt: dept.createdAt,
      updatedAt: dept.updatedAt,
      staffCount: dept._count.users,
      complaintCount: dept._count.complaints,
      activeComplaintCount: activeMap.get(dept.id) || 0,
    }));
  }

  async create(dto: CreateDepartmentDto) {
    const existing = await this.prisma.department.findUnique({
      where: { name: dto.name },
    });

    if (existing) {
      throw new BadRequestException('Department with this name already exists');
    }

    return this.prisma.department.create({
      data: {
        name: dto.name,
        description: dto.description,
      },
    });
  }

  async update(id: string, dto: UpdateDepartmentDto) {
    const department = await this.prisma.department.findUnique({
      where: { id },
    });

    if (!department) {
      throw new NotFoundException('Department not found');
    }

    if (dto.name && dto.name !== department.name) {
      const existing = await this.prisma.department.findUnique({
        where: { name: dto.name },
      });
      if (existing) {
        throw new BadRequestException('Department with this name already exists');
      }
    }

    return this.prisma.department.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.description && { description: dto.description }),
      },
    });
  }

  async getDepartmentStaff(
    departmentId: string,
    user: { id: string; role: UserRole; departmentId?: string | null },
  ) {
    // Access control: ADMIN or DEPARTMENT_HEAD of that specific department
    if (user.role === UserRole.CITIZEN || user.role === UserRole.DEPARTMENT_OFFICER) {
      throw new ForbiddenException('Access denied to team roster');
    }
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
