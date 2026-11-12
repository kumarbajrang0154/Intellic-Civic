import { z } from 'zod';
import prisma from '@/lib/prisma';
import {
  translateComplaintTextsWithAi,
  type SupportedTranslationLanguage,
} from '@/services/ai-provider';

export const translateComplaintSchema = z.object({
  targetLanguage: z.enum(['en', 'hi', 'ta']),
});

export interface TranslationDbClient {
  complaint: {
    findUnique: (args: any) => Promise<any>;
    update: (args: any) => Promise<any>;
  };
  aiPrediction: {
    update: (args: any) => Promise<any>;
  };
}

export interface TranslateComplaintActor {
  id: string;
  role: string;
  municipalityId?: string | null;
}

export class ComplaintTranslationError extends Error {
  readonly statusCode: number;
  constructor(message: string, statusCode: number) {
    super(message);
    this.name = 'ComplaintTranslationError';
    this.statusCode = statusCode;
  }
}

export interface TranslatedComplaintOutput {
  complaintId: string;
  ticketId: string;
  sourceLanguage: string;
  targetLanguage: SupportedTranslationLanguage;
  title: string;
  description: string;
  cached: boolean;
  provider: 'cache' | 'gemini' | 'fallback';
}

export async function translateComplaintToTargetLanguage(
  complaintId: string,
  targetLanguage: SupportedTranslationLanguage,
  actor: TranslateComplaintActor,
  options?: {
    db?: TranslationDbClient;
    translator?: typeof translateComplaintTextsWithAi;
  },
): Promise<TranslatedComplaintOutput> {
  const db = options?.db ?? (prisma as unknown as TranslationDbClient);
  const translator = options?.translator ?? translateComplaintTextsWithAi;

  const complaint = await db.complaint.findUnique({
    where: { id: complaintId },
    select: {
      id: true,
      ticketId: true,
      citizenId: true,
      municipalityId: true,
      title: true,
      description: true,
      language: true,
      titleEn: true,
      descriptionEn: true,
      aiPrediction: { select: { id: true, rawResponse: true } },
    },
  });

  if (!complaint) {
    throw new ComplaintTranslationError('Complaint not found.', 404);
  }

  if (actor.role === 'CITIZEN' && complaint.citizenId !== actor.id) {
    throw new ComplaintTranslationError('Forbidden: You can only translate your own complaints.', 403);
  }

  if (
    actor.role !== 'CITIZEN' &&
    actor.role !== 'SUPER_ADMIN' &&
    actor.municipalityId &&
    complaint.municipalityId &&
    actor.municipalityId !== complaint.municipalityId
  ) {
    throw new ComplaintTranslationError('Forbidden: Cross-municipality complaint access denied.', 403);
  }

  const sourceLanguage = (complaint.language || 'en').toLowerCase().trim() || 'en';

  if (sourceLanguage === targetLanguage) {
    return {
      complaintId: complaint.id,
      ticketId: complaint.ticketId,
      sourceLanguage,
      targetLanguage,
      title: complaint.title,
      description: complaint.description || '',
      cached: true,
      provider: 'cache',
    };
  }

  if (targetLanguage === 'en' && complaint.titleEn && complaint.descriptionEn) {
    return {
      complaintId: complaint.id,
      ticketId: complaint.ticketId,
      sourceLanguage,
      targetLanguage: 'en',
      title: complaint.titleEn,
      description: complaint.descriptionEn,
      cached: true,
      provider: 'cache',
    };
  }

  const rawResp =
    complaint.aiPrediction?.rawResponse && typeof complaint.aiPrediction.rawResponse === 'object'
      ? (complaint.aiPrediction.rawResponse as Record<string, any>)
      : {};
  const existingCache = rawResp.translations?.[targetLanguage];
  if (existingCache?.title && existingCache?.description) {
    return {
      complaintId: complaint.id,
      ticketId: complaint.ticketId,
      sourceLanguage,
      targetLanguage,
      title: String(existingCache.title),
      description: String(existingCache.description),
      cached: true,
      provider: 'cache',
    };
  }

  const translated = await translator({
    title: complaint.title,
    description: complaint.description || '',
    targetLanguage,
  });

  // Cache translated result in DB when Gemini succeeded
  if (translated.provider === 'gemini') {
    if (targetLanguage === 'en') {
      await db.complaint
        .update({
          where: { id: complaint.id },
          data: {
            titleEn: translated.titleTranslated,
            descriptionEn: translated.descriptionTranslated,
          },
        })
        .catch(() => {});
    }

    if (complaint.aiPrediction?.id) {
      await db.aiPrediction
        .update({
          where: { id: complaint.aiPrediction.id },
          data: {
            rawResponse: {
              ...rawResp,
              translations: {
                ...(rawResp.translations || {}),
                [targetLanguage]: {
                  title: translated.titleTranslated,
                  description: translated.descriptionTranslated,
                  translatedAt: new Date().toISOString(),
                },
              },
            },
          },
        })
        .catch(() => {});
    }
  }

  return {
    complaintId: complaint.id,
    ticketId: complaint.ticketId,
    sourceLanguage,
    targetLanguage,
    title: translated.titleTranslated,
    description: translated.descriptionTranslated,
    cached: false,
    provider: translated.provider,
  };
}

