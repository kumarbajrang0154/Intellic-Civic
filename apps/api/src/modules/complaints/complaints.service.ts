import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ComplaintStatus,
  PriorityLevel,
  Prisma,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { VALID_STATUS_TRANSITIONS } from './complaints.constants';
import { AssignComplaintDto } from './dto/assign-complaint.dto';
import { CreateComplaintDto } from './dto/create-complaint.dto';
import { ListComplaintsQueryDto } from './dto/list-complaints-query.dto';
import { UpdateComplaintStatusDto } from './dto/update-complaint-status.dto';

@Injectable()
export class ComplaintsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Helper to generate human-readable unique ticket IDs (e.g. CMP-2026-849201)
   */
  private generateTicketId(): string {
    const year = new Date().getFullYear();
    const randomDigits = Math.floor(100000 + Math.random() * 900000);
    return `CMP-${year}-${randomDigits}`;
  }

  /**
   * Create a new complaint. Allowed for CITIZEN role only.
   */
  async create(user: { id: string }, dto: CreateComplaintDto) {
    const ticketId = this.generateTicketId();
    const priority = dto.priority || PriorityLevel.MEDIUM;

    const result = await this.prisma.$transaction(async (tx) => {
      const complaint = await tx.complaint.create({
        data: {
          ticketId,
          citizenId: user.id,
          title: dto.title,
          description: dto.description,
          categoryId: dto.categoryId || null,
          priority,
          status: ComplaintStatus.SUBMITTED,
          departmentId: null, // Department is assigned later via AI routing (Module 4) or manual assignment
          location: dto.location
            ? {
                create: {
                  latitude: dto.location.latitude,
                  longitude: dto.location.longitude,
                  address: dto.location.address || null,
                },
              }
            : undefined,
        },
        include: {
          citizen: {
            select: {
              id: true,
              name: true,
              email: true,
              mobileNumber: true,
              avatarUrl: true,
            },
          },
          location: true,
          category: true,
        },
      });

      // Write Audit Log entry
      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: 'COMPLAINT_CREATED',
          entityType: 'Complaint',
          entityId: complaint.id,
          metadata: {
            title: complaint.title,
            categoryId: complaint.categoryId,
            priority: complaint.priority,
            ticketId: complaint.ticketId,
          },
        },
      });

      return complaint;
    });

    return result;
  }

  /**
   * List complaints with role-aware scoping, pagination, filtering, and sorting.
   */
  async findAll(
    user: { id: string; role: UserRole; departmentId?: string | null },
    query: ListComplaintsQueryDto,
  ) {
    const {
      page = 1,
      limit = 20,
      status,
      categoryId,
      priority,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.ComplaintWhereInput = {};

    // Role-based access boundaries
    if (user.role === UserRole.CITIZEN) {
      where.citizenId = user.id;
    } else if (
      user.role === UserRole.DEPARTMENT_HEAD ||
      user.role === UserRole.DEPARTMENT_OFFICER
    ) {
      if (user.departmentId) {
        where.departmentId = user.departmentId;
      } else {
        // Staff member without assigned department sees empty list
        where.departmentId = 'UNASSIGNED_DEPT_FLAG';
      }
    }
    // ADMIN (SUPER_ADMIN) has unrestricted view across all complaints

    // Apply explicit query filters
    if (status) {
      where.status = status;
    }
    if (categoryId) {
      where.categoryId = categoryId;
    }
    if (priority) {
      where.priority = priority;
    }

    const [total, data] = await Promise.all([
      this.prisma.complaint.count({ where }),
      this.prisma.complaint.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          citizen: {
            select: {
              id: true,
              name: true,
              email: true,
              mobileNumber: true,
            },
          },
          department: {
            select: {
              id: true,
              name: true,
            },
          },
          category: true,
          location: true,
          assignment: {
            include: {
              departmentOfficer: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
          },
        },
      }),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages,
      },
    };
  }

  /**
   * Retrieve single complaint detail with ownership and role access security.
   */
  async findOne(
    id: string,
    user: { id: string; role: UserRole; departmentId?: string | null },
  ) {
    const complaint = await this.prisma.complaint.findUnique({
      where: { id },
      include: {
        citizen: {
          select: {
            id: true,
            name: true,
            email: true,
            mobileNumber: true,
            avatarUrl: true,
          },
        },
        department: true,
        category: true,
        location: true,
        evidence: true,
        statusHistory: {
          include: {
            changedByUser: {
              select: {
                id: true,
                name: true,
                role: true,
              },
            },
          },
          orderBy: { changedAt: 'desc' },
        },
        aiPrediction: true,
        assignment: {
          include: {
            departmentOfficer: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
            assignedByUser: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!complaint) {
      throw new NotFoundException('Complaint not found');
    }

    // Role-based access check
    if (user.role === UserRole.CITIZEN) {
      if (complaint.citizenId !== user.id) {
        /**
         * BUSINESS REASONING:
         * Returning 404 instead of 403 for citizens prevents ID enumeration attacks.
         * Citizens should not be able to probe UUIDs to verify if another citizen's complaint exists.
         */
        throw new NotFoundException('Complaint not found');
      }
    } else if (
      user.role === UserRole.DEPARTMENT_HEAD ||
      user.role === UserRole.DEPARTMENT_OFFICER
    ) {
      if (
        !user.departmentId ||
        complaint.departmentId !== user.departmentId
      ) {
        throw new ForbiddenException(
          'Access denied to complaints outside your department scope',
        );
      }
    }

    return complaint;
  }

  /**
   * Update complaint status with state machine transition checks and audit history.
   */
  async updateStatus(
    id: string,
    dto: UpdateComplaintStatusDto,
    user: { id: string; role: UserRole; departmentId?: string | null },
  ) {
    const complaint = await this.prisma.complaint.findUnique({
      where: { id },
    });

    if (!complaint) {
      throw new NotFoundException('Complaint not found');
    }

    // Role authority check
    if (user.role === UserRole.CITIZEN) {
      throw new ForbiddenException(
        'Citizens are not authorized to update complaint status',
      );
    }

    if (
      user.role === UserRole.DEPARTMENT_HEAD ||
      user.role === UserRole.DEPARTMENT_OFFICER
    ) {
      if (
        !user.departmentId ||
        complaint.departmentId !== user.departmentId
      ) {
        throw new ForbiddenException(
          'You can only update complaints assigned to your department',
        );
      }
    }

    const currentStatus = complaint.status;
    const allowedNextStates = VALID_STATUS_TRANSITIONS[currentStatus] || [];

    if (!allowedNextStates.includes(dto.status)) {
      const allowedStr =
        allowedNextStates.length > 0
          ? allowedNextStates.join(', ')
          : 'None (terminal status reached)';
      throw new BadRequestException(
        `Invalid status transition from '${currentStatus}' to '${dto.status}'. Allowed next state(s): ${allowedStr}`,
      );
    }

    // Stamp terminal dates if applicable
    const terminalStatuses: ComplaintStatus[] = [
      ComplaintStatus.RESOLVED,
      ComplaintStatus.CLOSED,
      ComplaintStatus.REJECTED,
    ];
    const isTerminal = terminalStatuses.includes(dto.status);

    const now = new Date();

    const result = await this.prisma.$transaction(async (tx) => {
      const updatedComplaint = await tx.complaint.update({
        where: { id },
        data: {
          status: dto.status,
          resolvedAt:
            dto.status === ComplaintStatus.RESOLVED ||
            dto.status === ComplaintStatus.CLOSED
              ? complaint.resolvedAt || now
              : complaint.resolvedAt,
          closedAt:
            dto.status === ComplaintStatus.CLOSED ? now : complaint.closedAt,
        },
        include: {
          citizen: {
            select: {
              id: true,
              name: true,
              email: true,
              mobileNumber: true,
            },
          },
          department: true,
          location: true,
        },
      });

      // Record status transition in StatusHistory table
      await tx.statusHistory.create({
        data: {
          complaintId: id,
          fromStatus: currentStatus,
          toStatus: dto.status,
          changedByUserId: user.id,
        },
      });

      // Record AuditLog entry
      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: 'COMPLAINT_STATUS_UPDATED',
          entityType: 'Complaint',
          entityId: id,
          metadata: {
            fromStatus: currentStatus,
            toStatus: dto.status,
            remarks: dto.remarks || null,
          },
        },
      });

      return updatedComplaint;
    });

    return result;
  }

  /**
   * Manually assign complaint to a department and/or officer.
   */
  async assignComplaint(
    id: string,
    dto: AssignComplaintDto,
    user: { id: string; role: UserRole; departmentId?: string | null },
  ) {
    const complaint = await this.prisma.complaint.findUnique({
      where: { id },
    });

    if (!complaint) {
      throw new NotFoundException('Complaint not found');
    }

    // Department Head scope check
    if (user.role === UserRole.DEPARTMENT_HEAD) {
      if (!user.departmentId) {
        throw new ForbiddenException(
          'Department Head must be assigned to a department to assign complaints',
        );
      }
      if (
        complaint.departmentId &&
        complaint.departmentId !== user.departmentId
      ) {
        throw new ForbiddenException(
          'Department heads can only manage complaints within their own department',
        );
      }
      if (dto.departmentId && dto.departmentId !== user.departmentId) {
        throw new ForbiddenException(
          'Department heads cannot reassign complaints to another department',
        );
      }
    }

    const targetDepartmentId =
      dto.departmentId || complaint.departmentId || user.departmentId;

    // Validate assigned officer if provided
    if (dto.assignedOfficerId) {
      const officer = await this.prisma.user.findUnique({
        where: { id: dto.assignedOfficerId },
      });

      if (!officer) {
        throw new BadRequestException('Assigned officer not found');
      }

      if (targetDepartmentId && officer.departmentId !== targetDepartmentId) {
        throw new BadRequestException(
          'Assigned officer does not belong to the target department',
        );
      }
    }

    const shouldAutoAdvanceStatus =
      dto.assignedOfficerId &&
      (complaint.status === ComplaintStatus.SUBMITTED ||
        complaint.status === ComplaintStatus.PENDING_DEPT_REVIEW);

    const newStatus = shouldAutoAdvanceStatus
      ? ComplaintStatus.ASSIGNED
      : complaint.status;

    const result = await this.prisma.$transaction(async (tx) => {
      const updatedComplaint = await tx.complaint.update({
        where: { id },
        data: {
          departmentId: targetDepartmentId || null,
          status: newStatus,
        },
        include: {
          department: true,
          assignment: {
            include: {
              departmentOfficer: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
          },
        },
      });

      if (dto.assignedOfficerId) {
        await tx.assignment.upsert({
          where: { complaintId: id },
          create: {
            complaintId: id,
            departmentOfficerId: dto.assignedOfficerId,
            assignedByUserId: user.id,
            notes: dto.notes || null,
          },
          update: {
            departmentOfficerId: dto.assignedOfficerId,
            assignedByUserId: user.id,
            notes: dto.notes || null,
            assignedAt: new Date(),
          },
        });
      }

      if (shouldAutoAdvanceStatus) {
        await tx.statusHistory.create({
          data: {
            complaintId: id,
            fromStatus: complaint.status,
            toStatus: ComplaintStatus.ASSIGNED,
            changedByUserId: user.id,
          },
        });
      }

      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: 'COMPLAINT_ASSIGNED',
          entityType: 'Complaint',
          entityId: id,
          metadata: {
            departmentId: targetDepartmentId || null,
            assignedOfficerId: dto.assignedOfficerId || null,
            notes: dto.notes || null,
          },
        },
      });

      return updatedComplaint;
    });

    return result;
  }
}
