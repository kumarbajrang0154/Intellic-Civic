import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EvidenceStage, UserRole } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AiService } from '../ai/ai.service';
import { CreateEvidenceDto } from './dto/create-evidence.dto';

@Injectable()
export class EvidenceService {
  private readonly logger = new Logger(EvidenceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiService: AiService,
  ) {}

  /**
   * Attach photo evidence to a complaint and trigger non-blocking AI Vision verification.
   */
  async createEvidence(
    complaintId: string,
    dto: CreateEvidenceDto,
    user: { id: string; role: UserRole; departmentId?: string | null },
  ) {
    const complaint = await this.prisma.complaint.findUnique({
      where: { id: complaintId },
      include: { category: true },
    });

    if (!complaint) {
      throw new NotFoundException('Complaint not found');
    }

    // Role ownership & department checks
    if (user.role === UserRole.CITIZEN) {
      if (complaint.citizenId !== user.id) {
        throw new NotFoundException('Complaint not found');
      }
    } else if (
      user.role === UserRole.DEPARTMENT_HEAD ||
      user.role === UserRole.DEPARTMENT_OFFICER
    ) {
      if (user.departmentId && complaint.departmentId !== user.departmentId) {
        throw new ForbiddenException(
          'Cannot add evidence to complaints outside your department scope',
        );
      }
    }

    const stage = dto.stage || EvidenceStage.BEFORE;

    const evidence = await this.prisma.evidence.create({
      data: {
        complaintId,
        stage,
        imageUrl: dto.imageUrl,
        uploadedByUserId: user.id,
        notes: dto.notes || null,
      },
    });

    // Write audit log entry for evidence attachment
    await this.prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'EVIDENCE_ADDED',
        entityType: 'Evidence',
        entityId: evidence.id,
        metadata: {
          complaintId,
          stage,
          imageUrl: dto.imageUrl,
        },
      },
    });

    // Asynchronously trigger AI Vision verification in background (non-blocking)
    setImmediate(async () => {
      try {
        const categoryName = complaint.category?.name || 'GENERAL';
        const aiResult = await this.aiService.verifyEvidence({
          complaintId,
          complaintCategory: categoryName,
          complaintDescription: complaint.description,
          imageUrl: dto.imageUrl,
        });

        await this.prisma.aiPrediction.upsert({
          where: { complaintId },
          create: {
            complaintId,
            confidenceScore: aiResult.confidence_score,
            rawResponse: aiResult as any,
          },
          update: {
            confidenceScore: aiResult.confidence_score,
            rawResponse: aiResult as any,
          },
        });

        await this.prisma.auditLog.create({
          data: {
            userId: user.id,
            action: 'EVIDENCE_VERIFIED_BY_AI',
            entityType: 'Complaint',
            entityId: complaintId,
            metadata: {
              evidenceId: evidence.id,
              recommendation: aiResult.recommendation,
              confidenceScore: aiResult.confidence_score,
              qualityFlags: aiResult.quality_flags,
            },
          },
        });
      } catch (err: any) {
        this.logger.error(
          `Background AI evidence verification failed for complaint ${complaintId}: ${err.message}`,
        );
      }
    });

    return evidence;
  }
}
