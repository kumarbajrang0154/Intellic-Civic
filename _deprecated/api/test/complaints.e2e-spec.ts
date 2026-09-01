import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ComplaintStatus, PriorityLevel, UserRole } from '@prisma/client';
import { PrismaService } from '../src/database/prisma.service';
import { ComplaintsController } from '../src/modules/complaints/complaints.controller';
import { ComplaintsService } from '../src/modules/complaints/complaints.service';

import { AiService } from '../src/modules/ai/ai.service';

describe('ComplaintsModule (Module 3 E2E / Integration Tests)', () => {
  let controller: ComplaintsController;
  let service: ComplaintsService;
  let prismaService: any;

  const mockCitizen = {
    id: 'citizen-uuid-1',
    role: UserRole.CITIZEN,
    email: 'citizen1@test.com',
    mobileNumber: '+1234567890',
  };

  const mockCitizen2 = {
    id: 'citizen-uuid-2',
    role: UserRole.CITIZEN,
    email: 'citizen2@test.com',
    mobileNumber: '+1987654321',
  };

  const mockDeptHead = {
    id: 'dept-head-uuid-1',
    role: UserRole.DEPARTMENT_HEAD,
    departmentId: 'dept-water-uuid',
    email: 'head.water@city.gov',
  };

  const mockOfficer = {
    id: 'officer-uuid-1',
    role: UserRole.DEPARTMENT_OFFICER,
    departmentId: 'dept-water-uuid',
    email: 'officer1.water@city.gov',
  };

  const mockAdmin = {
    id: 'admin-uuid-1',
    role: UserRole.ADMIN,
    email: 'admin@city.gov',
  };

  const sampleComplaint = {
    id: 'complaint-uuid-1',
    ticketId: 'CMP-2026-100001',
    citizenId: 'citizen-uuid-1',
    title: 'Water Pipe Leakage near Main Street',
    description: 'There is a major water pipe leakage leaking hundreds of gallons of clean water.',
    status: ComplaintStatus.SUBMITTED,
    priority: PriorityLevel.MEDIUM,
    categoryId: 'cat-water-pipe',
    departmentId: 'dept-water-uuid',
    resolvedAt: null,
    closedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    prismaService = {
      $transaction: jest.fn().mockImplementation(async (cb) => cb(prismaService)),
      complaint: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
      } as any,
      category: {
        findMany: jest.fn().mockResolvedValue([]),
      } as any,
      department: {
        findMany: jest.fn().mockResolvedValue([]),
      } as any,
      auditLog: {
        create: jest.fn(),
      } as any,
      statusHistory: {
        create: jest.fn(),
      } as any,
      assignment: {
        upsert: jest.fn(),
      } as any,
      user: {
        findUnique: jest.fn(),
      } as any,
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ComplaintsController],
      providers: [
        ComplaintsService,
        {
          provide: PrismaService,
          useValue: prismaService,
        },
        {
          provide: AiService,
          useValue: {
            routeComplaint: jest.fn().mockResolvedValue({
              suggested_category_id: 'cat-1',
              suggested_department_id: 'dept-1',
              suggested_priority: PriorityLevel.MEDIUM,
              confidence_score: 0.8,
              category_changed_from_citizen: false,
              reasoning: 'Test recommendation',
              routing_decision: 'AUTO_ROUTE',
            }),
            verifyEvidence: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<ComplaintsController>(ComplaintsController);
    service = module.get<ComplaintsService>(ComplaintsService);
  });

  describe('1. Citizen creates a complaint successfully', () => {
    it('should create complaint with SUBMITTED status and record audit log', async () => {
      const createDto = {
        title: 'Broken Street Light on 5th Ave',
        description: 'Street light has been flickering and completely off for past 3 days.',
        priority: PriorityLevel.HIGH,
        location: {
          latitude: 37.7749,
          longitude: -122.4194,
          address: '5th Ave & Market St',
        },
      };

      (prismaService.complaint.create as jest.Mock).mockResolvedValue({
        id: 'new-complaint-uuid',
        ticketId: 'CMP-2026-999999',
        citizenId: mockCitizen.id,
        ...createDto,
        status: ComplaintStatus.SUBMITTED,
        departmentId: null,
        citizen: mockCitizen,
      });

      const result = await controller.create(mockCitizen, createDto);

      expect(prismaService.complaint.create).toHaveBeenCalled();
      expect(prismaService.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: mockCitizen.id,
            action: 'COMPLAINT_CREATED',
            entityType: 'Complaint',
          }),
        }),
      );
      expect(result).toHaveProperty('id');
      expect(result.status).toBe(ComplaintStatus.SUBMITTED);
    });
  });

  describe('2. Citizen cannot see another citizen\'s complaint (404 / ID enumeration protection)', () => {
    it('should throw NotFoundException (404) when a citizen tries to view another citizen\'s complaint', async () => {
      (prismaService.complaint.findUnique as jest.Mock).mockResolvedValue(sampleComplaint);

      // Citizen 2 trying to view Citizen 1's complaint
      await expect(controller.findOne(sampleComplaint.id, mockCitizen2)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('3. Department head sees only their department\'s complaints in list', () => {
    it('should filter complaints by departmentId for department head', async () => {
      (prismaService.complaint.count as jest.Mock).mockResolvedValue(1);
      (prismaService.complaint.findMany as jest.Mock).mockResolvedValue([sampleComplaint]);

      const result = await controller.findAll(mockDeptHead, { page: 1, limit: 20 });

      expect(prismaService.complaint.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            departmentId: 'dept-water-uuid',
          }),
        }),
      );
      expect(result.data.length).toBe(1);
    });
  });

  describe('4. Invalid status transition is rejected with 400', () => {
    it('should reject invalid transition (e.g. SUBMITTED -> RESOLVED directly) with BadRequestException', async () => {
      (prismaService.complaint.findUnique as jest.Mock).mockResolvedValue({
        ...sampleComplaint,
        status: ComplaintStatus.SUBMITTED,
      });

      await expect(
        controller.updateStatus(sampleComplaint.id, { status: ComplaintStatus.RESOLVED }, mockDeptHead),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('5. Valid status transition succeeds and creates audit log + status history', () => {
    it('should allow valid transition (SUBMITTED -> PENDING_DEPT_REVIEW) and record status history and audit log', async () => {
      const currentComplaint = {
        ...sampleComplaint,
        status: ComplaintStatus.SUBMITTED,
      };

      (prismaService.complaint.findUnique as jest.Mock).mockResolvedValue(currentComplaint);
      (prismaService.complaint.update as jest.Mock).mockResolvedValue({
        ...currentComplaint,
        status: ComplaintStatus.PENDING_DEPT_REVIEW,
      });

      const result = await controller.updateStatus(
        sampleComplaint.id,
        { status: ComplaintStatus.PENDING_DEPT_REVIEW, remarks: 'Routing to department pool' },
        mockDeptHead,
      );

      expect(prismaService.complaint.update).toHaveBeenCalled();
      expect(prismaService.statusHistory.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            complaintId: sampleComplaint.id,
            fromStatus: ComplaintStatus.SUBMITTED,
            toStatus: ComplaintStatus.PENDING_DEPT_REVIEW,
          }),
        }),
      );
      expect(prismaService.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'COMPLAINT_STATUS_UPDATED',
          }),
        }),
      );
      expect(result.status).toBe(ComplaintStatus.PENDING_DEPT_REVIEW);
    });
  });

  describe('6. Unassigned citizen role cannot call status update endpoint (403)', () => {
    it('should throw ForbiddenException when a citizen attempts to update complaint status', async () => {
      // In NestJS controller, @Roles(UserRole.DEPARTMENT_HEAD, UserRole.DEPARTMENT_OFFICER, UserRole.ADMIN) handles HTTP 403 via RolesGuard.
      // Also service checks staff scope. If called with citizen user on service directly:
      (prismaService.complaint.findUnique as jest.Mock).mockResolvedValue(sampleComplaint);

      await expect(
        service.updateStatus(
          sampleComplaint.id,
          { status: ComplaintStatus.PENDING_DEPT_REVIEW },
          mockCitizen as any,
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
