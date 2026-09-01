import { Test, TestingModule } from '@nestjs/testing';
import { ComplaintStatus, PriorityLevel, UserRole } from '@prisma/client';
import { PrismaService } from '../src/database/prisma.service';
import { AiService } from '../src/modules/ai/ai.service';
import { ComplaintsController } from '../src/modules/complaints/complaints.controller';
import { ComplaintsService } from '../src/modules/complaints/complaints.service';

describe('AI Complaint Routing (Module 4 Part B E2E Tests)', () => {
  let complaintsController: ComplaintsController;
  let complaintsService: ComplaintsService;
  let aiService: AiService;
  let prismaService: any;

  const mockCitizen = {
    id: 'citizen-uuid-1',
    role: UserRole.CITIZEN,
    email: 'citizen1@test.com',
  };

  const mockAdmin = {
    id: 'admin-uuid-1',
    role: UserRole.ADMIN,
    email: 'admin@city.gov',
  };

  const sampleComplaint = {
    id: 'complaint-uuid-201',
    ticketId: 'CMP-2026-200201',
    citizenId: mockCitizen.id,
    title: 'Overflowing Sewage Drain',
    description: 'Sewage drain is overflowing on North Street causing health hazard.',
    status: ComplaintStatus.SUBMITTED,
    priority: PriorityLevel.HIGH,
    categoryId: 'cat-sewage-1',
    departmentId: null,
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
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
      },
      category: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'cat-sewage-1', name: 'Sewage & Drainage' },
        ]),
      },
      department: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'dept-sanitation-1', name: 'Sanitation Dept', categories: [{ id: 'cat-sewage-1' }] },
        ]),
      },
      aiPrediction: {
        upsert: jest.fn(),
      },
      auditLog: {
        create: jest.fn(),
      },
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
              suggested_category_id: 'cat-sewage-1',
              suggested_department_id: 'dept-sanitation-1',
              suggested_priority: PriorityLevel.HIGH,
              confidence_score: 0.90,
              category_changed_from_citizen: false,
              reasoning: 'Drain overflow clearly belongs to Sanitation.',
              routing_decision: 'AUTO_ROUTE',
            }),
            verifyEvidence: jest.fn(),
          },
        },
      ],
    }).compile();

    complaintsController = module.get<ComplaintsController>(ComplaintsController);
    complaintsService = module.get<ComplaintsService>(ComplaintsService);
    aiService = module.get<AiService>(AiService);
  });

  describe('1. Complaint Creation Triggers Async AI Routing', () => {
    it('should create complaint and trigger background AI routing call', async () => {
      prismaService.complaint.create.mockResolvedValue(sampleComplaint);

      const createDto = {
        title: 'Overflowing Sewage Drain',
        description: 'Sewage drain is overflowing on North Street causing health hazard.',
        categoryId: 'cat-sewage-1',
      };

      const result = await complaintsController.create(mockCitizen, createDto);

      expect(prismaService.complaint.create).toHaveBeenCalled();
      expect(result).toHaveProperty('id', sampleComplaint.id);
    });
  });

  describe('2. AUTO_ROUTE Sets Real departmentId', () => {
    it('should auto-assign departmentId when AI confidence >= 0.75 and complaint is unassigned', async () => {
      prismaService.complaint.create.mockResolvedValue(sampleComplaint);
      prismaService.complaint.findUnique.mockResolvedValue(sampleComplaint);
      prismaService.complaint.update.mockResolvedValue({
        ...sampleComplaint,
        departmentId: 'dept-sanitation-1',
      });

      await complaintsController.create(mockCitizen, {
        title: 'Overflowing Sewage Drain',
        description: 'Sewage drain is overflowing on North Street causing health hazard.',
      });

      // Wait brief tick for setImmediate
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(prismaService.complaint.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: sampleComplaint.id },
          data: expect.objectContaining({
            departmentId: 'dept-sanitation-1',
          }),
        }),
      );
      expect(prismaService.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'COMPLAINT_AUTO_ROUTED',
          }),
        }),
      );
    });
  });

  describe('3. Human Assignment Precedence Rule', () => {
    it('should NOT override departmentId if a human staff member manually assigned it before AI completes', async () => {
      prismaService.complaint.create.mockResolvedValue(sampleComplaint);

      // Human assigned department while AI was running
      prismaService.complaint.findUnique.mockResolvedValue({
        ...sampleComplaint,
        departmentId: 'dept-human-assigned-99',
      });

      await complaintsController.create(mockCitizen, {
        title: 'Overflowing Sewage Drain',
        description: 'Sewage drain is overflowing on North Street causing health hazard.',
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      // Should NOT call complaint.update with AI department
      expect(prismaService.complaint.update).not.toHaveBeenCalled();
      expect(prismaService.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'AI_ROUTING_SKIPPED_HUMAN_PRECEDENCE',
          }),
        }),
      );
    });
  });

  describe('4. SUGGEST_ONLY Decision Leaves departmentId Null', () => {
    it('should leave departmentId null but populate aiPrediction when confidence is in SUGGEST_ONLY range', async () => {
      jest.spyOn(aiService, 'routeComplaint').mockResolvedValueOnce({
        suggested_category_id: 'cat-sewage-1',
        suggested_department_id: 'dept-sanitation-1',
        suggested_priority: PriorityLevel.MEDIUM,
        confidence_score: 0.55,
        category_changed_from_citizen: false,
        reasoning: 'Plausible sanitation issue, staff review recommended.',
        routing_decision: 'SUGGEST_ONLY',
      });

      prismaService.complaint.create.mockResolvedValue(sampleComplaint);
      prismaService.complaint.findUnique.mockResolvedValue(sampleComplaint);

      await complaintsController.create(mockCitizen, {
        title: 'Minor drain odor',
        description: 'Strange odor near storm drain, needs inspection.',
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(prismaService.complaint.update).not.toHaveBeenCalled();
      expect(prismaService.aiPrediction.upsert).toHaveBeenCalled();
    });
  });

  describe('5. List Triage Filtering (needsTriage=true)', () => {
    it('should filter unassigned complaints when needsTriage=true query parameter is set', async () => {
      prismaService.complaint.count.mockResolvedValue(1);
      prismaService.complaint.findMany.mockResolvedValue([sampleComplaint]);

      const result = await complaintsController.findAll(mockAdmin, {
        page: 1,
        limit: 20,
        needsTriage: true,
      });

      expect(prismaService.complaint.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            departmentId: null,
          }),
        }),
      );
      expect(result.data.length).toBe(1);
    });
  });

  describe('6. Staff vs Citizen AI Suggestion Surface', () => {
    it('should surface aiSuggestion formatted helper object for Admin role', async () => {
      const complaintWithRouting = {
        ...sampleComplaint,
        aiPrediction: {
          id: 'ai-pred-200',
          suggestedCategoryId: 'cat-sewage-1',
          suggestedDepartmentId: 'dept-sanitation-1',
          suggestedPriority: PriorityLevel.HIGH,
          confidenceScore: 0.88,
          rawResponse: {
            reasoning: 'High confidence match for Sanitation Dept.',
            routing_decision: 'AUTO_ROUTE',
          },
        },
      };

      prismaService.complaint.findUnique.mockResolvedValue(complaintWithRouting);

      const response = await complaintsController.findOne(sampleComplaint.id, mockAdmin);

      expect(response).toHaveProperty('aiSuggestion');
      expect((response as any).aiSuggestion.routingDecision).toBe('AUTO_ROUTE');
      expect((response as any).aiSuggestion.reasoning).toBe('High confidence match for Sanitation Dept.');
    });
  });
});
