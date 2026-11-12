import { z } from 'zod';
import prisma from '@/lib/prisma';
import { addAuditLog } from '@/lib/audit-store';
import {
  verifyBeforeAfterPhotosWithAi,
  type BeforeAfterVerificationResult,
} from '@/services/ai-provider';

export const beforeAfterVerifyRequestSchema = z.object({
  beforeEvidenceId: z.string().min(1).max(120).optional(),
  afterEvidenceId: z.string().min(1).max(120).optional(),
});

export interface BeforeAfterDbClient {
  complaint: {
    findUnique: (args: any) => Promise<any>;
  };
  aiPrediction: {
    update: (args: any) => Promise<any>;
  };
}

export interface BeforeAfterVerificationResponse {
  ok: true;
  complaintId: string;
  ticketId: string;
  beforeImageUrl: string;
  afterImageUrl: string;
  beforeSource: 'EVIDENCE_BEFORE' | 'INTAKE_IMAGE';
  verification: BeforeAfterVerificationResult;
}

export class BeforeAfterVerificationError extends Error {
  readonly statusCode: number;
  constructor(message: string, statusCode: number) {
    super(message);
    this.name = 'BeforeAfterVerificationError';
    this.statusCode = statusCode;
  }
}

export interface BeforeAfterActor {
  id: string;
  name: string;
  role: string;
  departmentId?: string | null;
  municipalityId?: string | null;
}

export async function verifyComplaintBeforeAfterPhotos(
  complaintId: string,
  actor: BeforeAfterActor,
  options?: {
    beforeEvidenceId?: string;
    afterEvidenceId?: string;
    db?: BeforeAfterDbClient;
    verifier?: typeof verifyBeforeAfterPhotosWithAi;
    skipAudit?: boolean;
  },
): Promise<BeforeAfterVerificationResponse> {
  const db = options?.db ?? (prisma as unknown as BeforeAfterDbClient);
  const verifier = options?.verifier ?? verifyBeforeAfterPhotosWithAi;

  const complaint = await db.complaint.findUnique({
    where: { id: complaintId },
    select: {
      id: true,
      ticketId: true,
      title: true,
      titleEn: true,
      description: true,
      descriptionEn: true,
      departmentId: true,
      municipalityId: true,
      assignedOfficerId: true,
      category: { select: { name: true } },
      images: { select: { id: true, imageUrl: true }, orderBy: { createdAt: 'asc' }, take: 1 },
      evidence: {
        select: { id: true, stage: true, imageUrl: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      },
      assignment: { select: { officerId: true } },
      aiPrediction: { select: { id: true, rawResponse: true } },
    },
  });

  if (!complaint) {
    throw new BeforeAfterVerificationError('Complaint not found.', 404);
  }

  // Enforce tenant & department isolation cleanly
  const isSuperAdmin = actor.role === 'SUPER_ADMIN';
  if (
    !isSuperAdmin &&
    actor.municipalityId &&
    complaint.municipalityId &&
    actor.municipalityId !== complaint.municipalityId
  ) {
    throw new BeforeAfterVerificationError('Forbidden: Cross-municipality complaint access denied.', 403);
  }

  if (actor.role === 'OFFICER') {
    const officerId = complaint.assignment?.officerId ?? complaint.assignedOfficerId;
    const assignedToActor = officerId === actor.id;
    const sameDept = actor.departmentId && complaint.departmentId === actor.departmentId;
    if (!assignedToActor && !sameDept) {
      throw new BeforeAfterVerificationError('Forbidden: Complaint belongs to another department.', 403);
    }
  } else if (actor.role === 'DEPARTMENT_HEAD') {
    if (actor.departmentId && complaint.departmentId && actor.departmentId !== complaint.departmentId) {
      throw new BeforeAfterVerificationError('Forbidden: Complaint belongs to another department.', 403);
    }
  }

  const evidenceList: Array<{ id: string; stage: string; imageUrl: string }> =
    complaint.evidence || [];

  const beforeEvidence = options?.beforeEvidenceId
    ? evidenceList.find((e) => e.id === options.beforeEvidenceId)
    : evidenceList.find((e) => String(e.stage).toUpperCase() === 'BEFORE');

  const afterEvidence = options?.afterEvidenceId
    ? evidenceList.find((e) => e.id === options.afterEvidenceId)
    : [...evidenceList].reverse().find((e) => String(e.stage).toUpperCase() === 'AFTER');

  const fallbackIntakeImage = complaint.images?.[0]?.imageUrl;
  const beforeImageUrl = beforeEvidence?.imageUrl || fallbackIntakeImage || null;
  const beforeSource: 'EVIDENCE_BEFORE' | 'INTAKE_IMAGE' = beforeEvidence?.imageUrl
    ? 'EVIDENCE_BEFORE'
    : 'INTAKE_IMAGE';

  if (!beforeImageUrl || !afterEvidence?.imageUrl) {
    throw new BeforeAfterVerificationError(
      'Both a BEFORE (or citizen intake) photo and an AFTER field-work photo are required before running AI comparison.',
      400,
    );
  }

  const verification = await verifier({
    beforeImageUrl,
    afterImageUrl: afterEvidence.imageUrl,
    complaintTitle: complaint.titleEn || complaint.title,
    complaintDescription: complaint.descriptionEn || complaint.description,
    categoryName: complaint.category?.name || 'Civic Issue',
  });

  if (complaint.aiPrediction?.id) {
    const prevRaw =
      complaint.aiPrediction.rawResponse && typeof complaint.aiPrediction.rawResponse === 'object'
        ? complaint.aiPrediction.rawResponse
        : {};
    await db.aiPrediction
      .update({
        where: { id: complaint.aiPrediction.id },
        data: {
          rawResponse: {
            ...prevRaw,
            beforeAfterVerification: {
              ...verification,
              checkedAt: new Date().toISOString(),
              checkedByUserId: actor.id,
            },
          },
        },
      })
      .catch(() => {});
  }

  if (!options?.skipAudit) {
    await addAuditLog({
      actorId: actor.id,
      actorName: actor.name,
      action: 'BEFORE_AFTER_PHOTO_VERIFIED',
      entityType: 'Complaint',
      targetId: complaint.id,
      targetName: complaint.ticketId,
      metadata: {
        workVerified: verification.workVerified,
        issueResolved: verification.issueResolved,
        confidence: verification.confidence,
        provider: verification.provider,
      },
    }).catch(() => {});
  }

  return {
    ok: true,
    complaintId: complaint.id,
    ticketId: complaint.ticketId,
    beforeImageUrl,
    afterImageUrl: afterEvidence.imageUrl,
    beforeSource,
    verification,
  };
}

