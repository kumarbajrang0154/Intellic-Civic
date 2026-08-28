import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { ApproveUserDto } from './dto/approve-user.dto';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: ListUsersQueryDto) {
    const { page = 1, limit = 20, role, departmentId, pendingOnly, search } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.UserWhereInput = {};

    if (pendingOnly) {
      where.isAuthorized = false;
    }

    if (role) {
      where.role = role;
    }

    if (departmentId) {
      where.departmentId = departmentId;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { mobileNumber: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [total, data] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          email: true,
          mobileNumber: true,
          avatarUrl: true,
          role: true,
          isAuthorized: true,
          departmentId: true,
          createdAt: true,
          department: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        mobileNumber: true,
        avatarUrl: true,
        role: true,
        isAuthorized: true,
        departmentId: true,
        createdAt: true,
        department: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async approveUser(id: string, dto: ApproveUserDto, adminId: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const targetRole = dto.role || user.role || UserRole.DEPARTMENT_OFFICER;
    const targetDepartmentId = dto.departmentId !== undefined ? dto.departmentId : user.departmentId;

    if (targetRole !== UserRole.ADMIN && targetRole !== UserRole.CITIZEN && !targetDepartmentId) {
      throw new BadRequestException('Department ID is required for staff roles');
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        isAuthorized: true,
        role: targetRole,
        departmentId: targetRole === UserRole.ADMIN || targetRole === UserRole.CITIZEN ? null : targetDepartmentId,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isAuthorized: true,
        departmentId: true,
        createdAt: true,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        userId: adminId,
        action: 'USER_APPROVED_BY_ADMIN',
        entityType: 'USER',
        entityId: id,
        metadata: {
          approvedUserId: id,
          role: updated.role,
          departmentId: updated.departmentId,
        },
      },
    });

    return updated;
  }

  async rejectUser(id: string, adminId: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        isAuthorized: false,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isAuthorized: true,
        departmentId: true,
        createdAt: true,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        userId: adminId,
        action: 'USER_REJECTED_BY_ADMIN',
        entityType: 'USER',
        entityId: id,
        metadata: {
          rejectedUserId: id,
        },
      },
    });

    return updated;
  }

  async updateUser(id: string, dto: UpdateUserDto, adminId: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const dataToUpdate: Prisma.UserUpdateInput = {};

    if (dto.role) {
      dataToUpdate.role = dto.role;
    }

    if (dto.departmentId !== undefined) {
      dataToUpdate.department = dto.departmentId
        ? { connect: { id: dto.departmentId } }
        : { disconnect: true };
    }

    if (dto.name) {
      dataToUpdate.name = dto.name;
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: dataToUpdate,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isAuthorized: true,
        departmentId: true,
        createdAt: true,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        userId: adminId,
        action: 'USER_UPDATED_BY_ADMIN',
        entityType: 'USER',
        entityId: id,
        metadata: {
          updatedUserId: id,
          role: dto.role || null,
          departmentId: dto.departmentId || null,
          name: dto.name || null,
        },
      },
    });

    return updated;
  }
}
