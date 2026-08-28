import { Test, TestingModule } from '@nestjs/testing';
import { ComplaintStatus, EvidenceStage, PriorityLevel, UserRole } from '@prisma/client';
import { PrismaService } from '../src/database/prisma.service';
import { AiService } from '../src/modules/ai/ai.service';
import { ComplaintsController } from '../src/modules/complaints/complaints.controller';
import { ComplaintsService } from '../src/modules/complaints/complaints.service';
import { EvidenceController } from '../src/modules/evidence/evidence.controller';
import { EvidenceService } from '../src/modules/evidence/evidence.service';

describe('Evidence & AI Verification Integration (Module 4 Part A E2E Tests)', () => {
  let evidenceController: EvidenceController;
  let complaintsController: ComplaintsController;
  let evidenceService: EvidenceService;
  let aiService: AiService;
  let prismaService: any;

  const mockCitizen = {
    id: 'citizen-uuid-1',
    role: UserRole.CITIZEN,
    email: 'citizen1@test.com',
  };

  const mockDeptHead = {
    id: 'head-uuid-1',
    role: UserRole.DEPARTMENT_HEAD,
    departmentId: 'dept-water-1',
    email: 'head@water.gov',
  };

  const sampleComplaint = {
    id: 'complaint-uuid-101',
    ticketId: 'CMP-2026-100101',
    citizenId: mockCitizen.id,
    title: 'Pothole on Main Street',
    description: 'A deep pothole is causing vehicle damage near the crossroad.',
    status: ComplaintStatus.SUBMITTED,
    priority: PriorityLevel.HIGH,
    categoryId: 'cat-road-1',
    departmentId: 'dept-water-1',
    category: { id: 'cat-road-1', name: 'POTHOLE' },
    resolvedAt: null,
    closedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    prismaService = {
      $transaction: jest.fn().mockImplementation(async (cb) => cb(prismaService)),
      complaint: {
        findUnique: jest.fn(),
      },
      evidence: {
        create: jest.fn(),
      },
      aiPrediction: {
        upsert: jest.fn(),
      },
      auditLog: {
        create: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [EvidenceController, ComplaintsController],
      providers: [
        EvidenceService,
        ComplaintsService,
        {
          provide: PrismaService,
          useValue: prismaService,
        },
        {
          provide: AiService,
          useValue: {
            verifyEvidence: jest.fn().mockResolvedValue({
              is_relevant: true,
              matches_category: true,
              confidence_score: 0.91,
              detected_objects: ['pothole', 'asphalt'],
              quality_flags: [],
              reasoning: 'Photo shows clear road pothole.',
              recommendation: 'AUTO_APPROVE',
            }),
          },
        },
      ],
    }).compile();

    evidenceController = module.get<EvidenceController>(EvidenceController);
    complaintsController = module.get<ComplaintsController>(ComplaintsController);
    evidenceService = module.get<EvidenceService>(EvidenceService);
    aiService = module.get<AiService>(AiService);
  });

  describe('1. Evidence Upload & Non-blocking AI Call', () => {
    it('should create evidence record and trigger AI verification', async () => {
      prismaService.complaint.findUnique.mockResolvedValue(sampleComplaint);
      prismaService.evidence.create.mockResolvedValue({
        id: 'evidence-uuid-1',
        complaintId: sampleComplaint.id,
        stage: EvidenceStage.BEFORE,
        imageUrl: 'https://example.com/pothole.jpg',
        uploadedByUserId: mockCitizen.id,
        uploadedAt: new Date(),
      });

      const result = await evidenceController.addEvidence(
        sampleComplaint.id,
        {
          stage: EvidenceStage.BEFORE,
          imageUrl: 'https://example.com/pothole.jpg',
        },
        mockCitizen,
      );

      expect(prismaService.evidence.create).toHaveBeenCalled();
      expect(result).toHaveProperty('id', 'evidence-uuid-1');
    });
  });

  describe('2. Resilience: AI service downtime does not block evidence creation', () => {
    it('should create evidence successfully even if AI service throws exception or is offline', async () => {
      jest.spyOn(aiService, 'verifyEvidence').mockImplementationOnce(async () => {
        throw new Error('AI Service 503 Connection Refused');
      });

      prismaService.complaint.findUnique.mockResolvedValue(sampleComplaint);
      prismaService.evidence.create.mockResolvedValue({
        id: 'evidence-uuid-2',
        complaintId: sampleComplaint.id,
        stage: EvidenceStage.BEFORE,
        imageUrl: 'https://example.com/pothole2.jpg',
        uploadedByUserId: mockCitizen.id,
        uploadedAt: new Date(),
      });

      const result = await evidenceController.addEvidence(
        sampleComplaint.id,
        {
          imageUrl: 'https://example.com/pothole2.jpg',
        },
        mockCitizen,
      );

      expect(result).toHaveProperty('id', 'evidence-uuid-2');
    });
  });

  describe('3. Staff vs Citizen Role Access to AI Flags', () => {
    it('should redact raw AI reasoning and quality flags for citizens', async () => {
      const complaintWithAi = {
        ...sampleComplaint,
        citizenId: mockCitizen.id,
        aiPrediction: {
          id: 'ai-pred-1',
          confidenceScore: 0.95,
          rawResponse: {
            is_relevant: true,
            matches_category: true,
            confidence_score: 0.95,
            quality_flags: ['minor_blur'],
            reasoning: 'Internal staff reasoning note: camera lens dirty.',
            recommendation: 'AUTO_APPROVE',
          },
        },
      };

      prismaService.complaint.findUnique.mockResolvedValue(complaintWithAi);

      const citizenView = await complaintsController.findOne(sampleComplaint.id, mockCitizen);
      const rawRes = (citizenView.aiPrediction?.rawResponse as any);

      expect(rawRes.reasoning).toBeUndefined();
      expect(rawRes.quality_flags).toBeUndefined();
      expect(rawRes.statusMessage).toBe('Evidence accepted');
    });

    it('should expose full AI flags and reasoning for department staff', async () => {
      const complaintWithAi = {
        ...sampleComplaint,
        aiPrediction: {
          id: 'ai-pred-1',
          confidenceScore: 0.95,
          rawResponse: {
            is_relevant: true,
            matches_category: true,
            confidence_score: 0.95,
            quality_flags: ['minor_blur'],
            reasoning: 'Internal staff reasoning note: camera lens dirty.',
            recommendation: 'AUTO_APPROVE',
          },
        },
      };

      prismaService.complaint.findUnique.mockResolvedValue(complaintWithAi);

      const staffView = await complaintsController.findOne(sampleComplaint.id, mockDeptHead);
      const rawRes = (staffView.aiPrediction?.rawResponse as any);

      expect(rawRes.reasoning).toBe('Internal staff reasoning note: camera lens dirty.');
      expect(rawRes.quality_flags).toContain('minor_blur');
    });
  });
});
