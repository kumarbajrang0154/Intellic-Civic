import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ComplaintStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../src/database/prisma.service';
import { ComplaintsController } from '../src/modules/complaints/complaints.controller';
import { ComplaintsService } from '../src/modules/complaints/complaints.service';
import { EvidenceController } from '../src/modules/evidence/evidence.controller';
import { EvidenceService } from '../src/modules/evidence/evidence.service';
import { AiService } from '../src/modules/ai/ai.service';

describe('OfficerModule & Officer Scoping (Module 8 E2E / Integration Tests)', () => {
  let complaintsController: ComplaintsController;
  let complaintsService: ComplaintsService;
  let evidenceController: EvidenceController;
  let evidenceService: EvidenceService;
  let prismaService: any;

  const mockDeptId = 'dept-sanitation-101';

  const mockOfficer1 = {
    id: 'officer-user-1',
    role: UserRole.DEPARTMENT_OFFICER,
    departmentId: mockDeptId,
    email: 'officer1@city.gov',
  };

  const mockOfficer2 = {
    id: 'officer-user-2',
    role: UserRole.DEPARTMENT_OFFICER,
    departmentId: mockDeptId,
    email: 'officer2@city.gov',
  };

  const mockDeptHead = {
    id: 'dept-head-1',
    role: UserRole.DEPARTMENT_HEAD,
    departmentId: mockDeptId,
    email: 'head@city.gov',
  };

  const sampleComplaintAssignedToOfficer1 = {
    id: 'cmp-officer-101',
    ticketId: 'CMP-2026-OFF101',
    citizenId: 'citizen-uuid-1',
    title: 'Trash overflow at Central Park',
    description: 'Bins overflowing on north entrance.',
    status: ComplaintStatus.ASSIGNED,
    departmentId: mockDeptId,
    assignment: {
      id: 'assign-101',
      complaintId: 'cmp-officer-101',
      departmentOfficerId: 'officer-user-1',
      assignedByUserId: 'dept-head-1',
    },
    createdAt: new Date(),
  };

  beforeEach(async () => {
    prismaService = {
      $transaction: jest.fn().mockImplementation(async (cb) => cb(prismaService)),
      complaint: {
        create: jest.fn(),
        findMany: jest.fn().mockResolvedValue([sampleComplaintAssignedToOfficer1]),
        findUnique: jest.fn().mockResolvedValue(sampleComplaintAssignedToOfficer1),
        count: jest.fn().mockResolvedValue(1),
        update: jest.fn(),
      } as any,
      evidence: {
        create: jest.fn().mockResolvedValue({
          id: 'ev-101',
          complaintId: 'cmp-officer-101',
          stage: 'DURING',
          imageUrl: 'https://cloudinary.com/test-during.jpg',
        }),
      } as any,
      auditLog: {
        create: jest.fn(),
      } as any,
      statusHistory: {
        create: jest.fn(),
      } as any,
      user: {
        findUnique: jest.fn().mockResolvedValue(mockOfficer1),
      } as any,
      assignment: {
        upsert: jest.fn().mockResolvedValue({}),
      } as any,
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ComplaintsController, EvidenceController],
      providers: [
        ComplaintsService,
        EvidenceService,
        {
          provide: PrismaService,
          useValue: prismaService,
        },
        {
          provide: AiService,
          useValue: {
            routeComplaint: jest.fn(),
            verifyEvidence: jest.fn().mockResolvedValue({ verified: true }),
          },
        },
      ],
    }).compile();

    complaintsController = module.get<ComplaintsController>(ComplaintsController);
    complaintsService = module.get<ComplaintsService>(ComplaintsService);
    evidenceController = module.get<EvidenceController>(EvidenceController);
    evidenceService = module.get<EvidenceService>(EvidenceService);
  });

  describe('1. Department Officer Scoping & assignedToMe Filtering', () => {
    it('1a. Officer querying assignedToMe=true filters by assignment.departmentOfficerId = self.id', async () => {
      const res = await complaintsController.findAll(mockOfficer1, { assignedToMe: true });

      expect(res.data).toBeDefined();
      expect(prismaService.complaint.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            departmentId: mockDeptId,
            assignment: { departmentOfficerId: 'officer-user-1' },
          }),
        }),
      );
    });

    it('1b. Officer querying assignedOfficerId filters by targeted officer ID', async () => {
      await complaintsController.findAll(mockOfficer1, { assignedOfficerId: 'officer-user-2' });

      expect(prismaService.complaint.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            departmentId: mockDeptId,
            assignment: { departmentOfficerId: 'officer-user-2' },
          }),
        }),
      );
    });

    it('1c. Officer can update status of a complaint assigned to them (ASSIGNED -> IN_PROGRESS)', async () => {
      prismaService.complaint.update.mockResolvedValue({
        ...sampleComplaintAssignedToOfficer1,
        status: ComplaintStatus.IN_PROGRESS,
      });

      const updated = await complaintsController.updateStatus(
        'cmp-officer-101',
        { status: ComplaintStatus.IN_PROGRESS, remarks: 'Commencing cleanup work' },
        mockOfficer1,
      );

      expect(updated).toBeDefined();
      expect(prismaService.complaint.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'cmp-officer-101' },
          data: expect.objectContaining({
            status: ComplaintStatus.IN_PROGRESS,
          }),
        }),
      );
    });

    it('1d. assignComplaint writes to tx.assignment.upsert setting departmentOfficerId matching assignedToMe filter', async () => {
      await complaintsService.assignComplaint(
        'cmp-officer-101',
        { assignedOfficerId: 'officer-user-1' },
        mockDeptHead as any,
      );

      expect(prismaService.assignment.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { complaintId: 'cmp-officer-101' },
          create: expect.objectContaining({
            departmentOfficerId: 'officer-user-1',
          }),
          update: expect.objectContaining({
            departmentOfficerId: 'officer-user-1',
          }),
        }),
      );
    });
  });

  describe('2. Officer Evidence Upload Permissions', () => {
    it('2a. DEPARTMENT_OFFICER can upload DURING or AFTER stage work evidence for a complaint in their department', async () => {
      const result = await evidenceController.addEvidence(
        'cmp-officer-101',
        {
          imageUrl: 'https://cloudinary.com/test-during.jpg',
          stage: 'DURING' as any,
          notes: 'Photo taken while clearing trash',
        },
        mockOfficer1,
      );

      expect(result).toBeDefined();
      expect(prismaService.evidence.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            complaintId: 'cmp-officer-101',
            stage: 'DURING',
            imageUrl: 'https://cloudinary.com/test-during.jpg',
          }),
        }),
      );
    });

    it('2b. DEPARTMENT_OFFICER gets 403 when trying to upload evidence for a complaint outside their department', async () => {
      prismaService.complaint.findUnique.mockResolvedValueOnce({
        id: 'cmp-other-dept-999',
        departmentId: 'dept-water-999',
      });

      await expect(
        evidenceController.addEvidence(
          'cmp-other-dept-999',
          {
            imageUrl: 'https://cloudinary.com/test-during.jpg',
            stage: 'DURING' as any,
          },
          mockOfficer1,
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
