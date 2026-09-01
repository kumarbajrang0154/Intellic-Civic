import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ComplaintStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../src/database/prisma.service';
import { DepartmentsController } from '../src/modules/departments/departments.controller';
import { DepartmentsService } from '../src/modules/departments/departments.service';
import { ComplaintsController } from '../src/modules/complaints/complaints.controller';
import { ComplaintsService } from '../src/modules/complaints/complaints.service';
import { AiService } from '../src/modules/ai/ai.service';

describe('DepartmentsModule & AI Rejection (Module 7 E2E / Integration Tests)', () => {
  let departmentsController: DepartmentsController;
  let departmentsService: DepartmentsService;
  let complaintsController: ComplaintsController;
  let complaintsService: ComplaintsService;
  let prismaService: any;

  const mockDeptXId = 'dept-water-uuid-101';
  const mockDeptYId = 'dept-sanitation-uuid-202';

  const mockDeptHeadX = {
    id: 'dept-head-x-id',
    role: UserRole.DEPARTMENT_HEAD,
    departmentId: mockDeptXId,
    email: 'head.water@city.gov',
  };

  const mockDeptHeadY = {
    id: 'dept-head-y-id',
    role: UserRole.DEPARTMENT_HEAD,
    departmentId: mockDeptYId,
    email: 'head.sanitation@city.gov',
  };

  const mockOfficerX = {
    id: 'officer-x-id',
    role: UserRole.DEPARTMENT_OFFICER,
    departmentId: mockDeptXId,
    email: 'officer.water@city.gov',
  };

  const mockAdmin = {
    id: 'admin-uuid-1',
    role: UserRole.ADMIN,
    email: 'admin@city.gov',
  };

  const mockCitizen = {
    id: 'citizen-uuid-1',
    role: UserRole.CITIZEN,
    email: 'citizen@test.com',
  };

  const sampleDepartmentX = {
    id: mockDeptXId,
    name: 'Water Department',
    description: 'Handles water supply and pipe leakages',
  };

  const mockOfficers = [
    {
      id: 'officer-1',
      name: 'Alice Officer',
      email: 'alice@water.gov',
      role: UserRole.DEPARTMENT_OFFICER,
      avatarUrl: null,
      createdAt: new Date(),
    },
    {
      id: 'head-1',
      name: 'Bob Head',
      email: 'head.water@city.gov',
      role: UserRole.DEPARTMENT_HEAD,
      avatarUrl: null,
      createdAt: new Date(),
    },
  ];

  const mockFieldWorkers = [
    {
      id: 'fw-1',
      name: 'Charlie FieldWorker',
      phoneNumber: '+1234567890',
      isActive: true,
      createdAt: new Date(),
    },
  ];

  beforeEach(async () => {
    prismaService = {
      $transaction: jest.fn().mockImplementation(async (cb) => cb(prismaService)),
      department: {
        findUnique: jest.fn().mockResolvedValue(sampleDepartmentX),
        findMany: jest.fn().mockResolvedValue([sampleDepartmentX]),
      } as any,
      user: {
        findMany: jest.fn().mockResolvedValue(mockOfficers),
        findUnique: jest.fn(),
      } as any,
      fieldWorker: {
        findMany: jest.fn().mockResolvedValue(mockFieldWorkers),
      } as any,
      complaint: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
      } as any,
      aiPrediction: {
        update: jest.fn(),
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
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DepartmentsController, ComplaintsController],
      providers: [
        DepartmentsService,
        ComplaintsService,
        {
          provide: PrismaService,
          useValue: prismaService,
        },
        {
          provide: AiService,
          useValue: {
            routeComplaint: jest.fn(),
            verifyEvidence: jest.fn(),
          },
        },
      ],
    }).compile();

    departmentsController = module.get<DepartmentsController>(DepartmentsController);
    departmentsService = module.get<DepartmentsService>(DepartmentsService);
    complaintsController = module.get<ComplaintsController>(ComplaintsController);
    complaintsService = module.get<ComplaintsService>(ComplaintsService);
  });

  describe('1. GET /api/v1/departments/:id/staff (Department Staff Roster)', () => {
    it('1a. DEPARTMENT_HEAD of department X can successfully fetch staff for department X', async () => {
      const result = await departmentsController.getDepartmentStaff(mockDeptXId, mockDeptHeadX);

      expect(result).toBeDefined();
      expect(result.department.id).toBe(mockDeptXId);
      expect(result.officers).toHaveLength(2);
      expect(result.fieldWorkers).toHaveLength(1);
      expect(prismaService.department.findUnique).toHaveBeenCalledWith({
        where: { id: mockDeptXId },
      });
    });

    it('1b. DEPARTMENT_HEAD of department X gets 403 when requesting department Y staff', async () => {
      await expect(
        departmentsController.getDepartmentStaff(mockDeptYId, mockDeptHeadX),
      ).rejects.toThrow(ForbiddenException);
    });

    it('1c. SUPER_ADMIN (ADMIN role) can fetch staff for any department', async () => {
      const resultX = await departmentsController.getDepartmentStaff(mockDeptXId, mockAdmin);
      expect(resultX).toBeDefined();
      expect(resultX.department.id).toBe(mockDeptXId);

      const resultY = await departmentsController.getDepartmentStaff(mockDeptYId, mockAdmin);
      expect(resultY).toBeDefined();
    });

    it('1d. Response includes authorized officers & active FieldWorkers, passing query parameters to Prisma', async () => {
      await departmentsController.getDepartmentStaff(mockDeptXId, mockDeptHeadX);

      expect(prismaService.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            departmentId: mockDeptXId,
            role: { in: [UserRole.DEPARTMENT_HEAD, UserRole.DEPARTMENT_OFFICER] },
            isAuthorized: true,
          },
        }),
      );

      expect(prismaService.fieldWorker.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            departmentId: mockDeptXId,
            isActive: true,
          },
        }),
      );
    });

    it('1e. CITIZEN or DEPARTMENT_OFFICER role gets 403 ForbiddenException', async () => {
      await expect(
        departmentsService.getDepartmentStaff(mockDeptXId, mockCitizen as any),
      ).rejects.toThrow(ForbiddenException);

      await expect(
        departmentsService.getDepartmentStaff(mockDeptXId, mockOfficerX as any),
      ).rejects.toThrow(ForbiddenException);
    });

    it('1f. Throws NotFoundException if department does not exist', async () => {
      prismaService.department.findUnique.mockResolvedValueOnce(null);

      await expect(
        departmentsController.getDepartmentStaff('non-existent-dept', mockAdmin),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('2. Pending AI Confirmation & Suggestion Rejection Behavior', () => {
    const unassignedAiComplaint = {
      id: 'cmp-ai-suggested-100',
      ticketId: 'CMP-2026-AI100',
      citizenId: 'citizen-uuid-1',
      title: 'Leaking pipe on Oak St',
      description: 'Water flowing into road.',
      status: ComplaintStatus.SUBMITTED,
      departmentId: null,
      aiPrediction: {
        id: 'ai-pred-100',
        suggestedDepartmentId: mockDeptXId,
        isRejected: false,
        confidenceScore: 0.85,
      },
      createdAt: new Date(),
    };

    it('2a. Complaint with departmentId=null & aiPrediction.suggestedDepartmentId=X shows up when Head of X queries ?pendingAiConfirmation=true', async () => {
      prismaService.complaint.count.mockResolvedValue(1);
      prismaService.complaint.findMany.mockResolvedValue([unassignedAiComplaint]);

      const res = await complaintsController.findAll(mockDeptHeadX, {
        pendingAiConfirmation: true,
      });

      expect(res.data).toHaveLength(1);
      expect(res.data[0].id).toBe('cmp-ai-suggested-100');
      expect(prismaService.complaint.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            departmentId: null,
            aiPrediction: {
              suggestedDepartmentId: mockDeptXId,
              isRejected: false,
            },
          }),
        }),
      );
    });

    it('2b. The same complaint does NOT show up in Department Head X normal queue query', async () => {
      prismaService.complaint.count.mockResolvedValue(0);
      prismaService.complaint.findMany.mockResolvedValue([]);

      const res = await complaintsController.findAll(mockDeptHeadX, {});

      expect(res.data).toHaveLength(0);
      expect(prismaService.complaint.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            departmentId: mockDeptXId,
          }),
        }),
      );
    });

    it('2c. Department Head Y does NOT see this complaint in either query', async () => {
      prismaService.complaint.count.mockResolvedValue(0);
      prismaService.complaint.findMany.mockResolvedValue([]);

      // Pending AI confirmation query for Head Y
      await complaintsController.findAll(mockDeptHeadY, { pendingAiConfirmation: true });
      expect(prismaService.complaint.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            departmentId: null,
            aiPrediction: {
              suggestedDepartmentId: mockDeptYId,
              isRejected: false,
            },
          }),
        }),
      );

      // Normal query for Head Y
      await complaintsController.findAll(mockDeptHeadY, {});
      expect(prismaService.complaint.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            departmentId: mockDeptYId,
          }),
        }),
      );
    });

    it('2d. After "Confirm & Assign" is called, complaint has departmentId set and no longer matches pendingAiConfirmation', async () => {
      const assignedComplaint = {
        ...unassignedAiComplaint,
        departmentId: mockDeptXId,
        status: ComplaintStatus.ASSIGNED,
      };

      prismaService.complaint.findUnique.mockResolvedValue(unassignedAiComplaint);
      prismaService.complaint.update.mockResolvedValue(assignedComplaint);

      await complaintsController.assignComplaint('cmp-ai-suggested-100', { departmentId: mockDeptXId }, mockDeptHeadX);

      expect(prismaService.complaint.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'cmp-ai-suggested-100' },
          data: expect.objectContaining({
            departmentId: mockDeptXId,
            status: ComplaintStatus.SUBMITTED,
          }),
        }),
      );
    });

    it('2e. After "Not My Department" (rejectAiSuggestion), isRejected becomes true and AuditLog entry is written', async () => {
      prismaService.complaint.findUnique.mockResolvedValue(unassignedAiComplaint);

      await complaintsController.rejectAiSuggestion('cmp-ai-suggested-100', mockDeptHeadX);

      expect(prismaService.aiPrediction.update).toHaveBeenCalledWith({
        where: { complaintId: 'cmp-ai-suggested-100' },
        data: { isRejected: true },
      });

      expect(prismaService.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: mockDeptHeadX.id,
          action: 'AI_SUGGESTION_REJECTED_BY_DEPARTMENT',
          entityType: 'AiPrediction',
          entityId: 'ai-pred-100',
        }),
      });
    });

    it('2f. After rejection, complaint is excluded from pendingAiConfirmation query (isRejected=false check)', async () => {
      const rejectedComplaint = {
        ...unassignedAiComplaint,
        aiPrediction: {
          ...unassignedAiComplaint.aiPrediction,
          isRejected: true,
        },
      };

      // Mock DB filtering out rejected complaint
      prismaService.complaint.count.mockResolvedValue(0);
      prismaService.complaint.findMany.mockResolvedValue([]);

      const res = await complaintsController.findAll(mockDeptHeadX, {
        pendingAiConfirmation: true,
      });

      expect(res.data).toHaveLength(0);
      expect(prismaService.complaint.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            aiPrediction: {
              suggestedDepartmentId: mockDeptXId,
              isRejected: false,
            },
          }),
        }),
      );
    });
  });
});
