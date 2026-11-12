import { z } from 'zod';
import prisma from '@/lib/prisma';
import { translateComplaintToTargetLanguage } from '@/services/translation-service';
import { findDuplicateCandidatesForComplaint } from '@/services/duplicate-service';

export const aiJobTypes = ['TRANSLATE', 'DUPLICATE_SCAN'] as const;
export type AiJobType = (typeof aiJobTypes)[number];

export const triggerAiJobsSchema = z.object({
  batchSize: z.coerce.number().int().min(1).max(25).default(10),
});

export interface AiJobDbClient {
  aiProcessingJob: {
    findMany: (args: any) => Promise<any[]>;
    create: (args: any) => Promise<any>;
    update: (args: any) => Promise<any>;
  };
}

export async function enqueueAiJob(
  params: {
    complaintId: string;
    jobType: AiJobType;
    payload?: Record<string, any>;
    maxAttempts?: number;
  },
  db: AiJobDbClient = prisma as unknown as AiJobDbClient,
): Promise<{ queued: boolean; jobId?: string; skippedReason?: string }> {
  try {
    const job = await db.aiProcessingJob.create({
      data: {
        complaintId: params.complaintId,
        jobType: params.jobType,
        status: 'PENDING',
        attempts: 0,
        maxAttempts: params.maxAttempts ?? 3,
        payload: params.payload ?? {},
        scheduledAt: new Date(),
      },
      select: { id: true },
    });
    return { queued: true, jobId: job.id };
  } catch (err: any) {
    if (err?.code === 'P2021') {
      return { queued: false, skippedReason: 'ai_processing_jobs migration pending' };
    }
    throw err;
  }
}

export async function listAiJobs(
  limit: number = 30,
  db: AiJobDbClient = prisma as unknown as AiJobDbClient,
) {
  try {
    const items = await db.aiProcessingJob.findMany({
      select: {
        id: true,
        complaintId: true,
        jobType: true,
        status: true,
        attempts: true,
        maxAttempts: true,
        lastError: true,
        scheduledAt: true,
        completedAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 100),
    });
    return { items, migrationPending: false };
  } catch (err: any) {
    if (err?.code === 'P2021') {
      return { items: [], migrationPending: true };
    }
    throw err;
  }
}

export async function processPendingAiJobs(
  options?: {
    batchSize?: number;
    db?: AiJobDbClient;
    now?: Date;
    executors?: {
      translate?: typeof translateComplaintToTargetLanguage;
      duplicateScan?: typeof findDuplicateCandidatesForComplaint;
    };
  },
): Promise<{
  processed: number;
  completed: number;
  retried: number;
  failed: number;
  migrationPending?: boolean;
}> {
  const db = options?.db ?? (prisma as unknown as AiJobDbClient);
  const now = options?.now ?? new Date();
  const batchSize = Math.min(Math.max(options?.batchSize ?? 10, 1), 25);

  const translateFn = options?.executors?.translate ?? translateComplaintToTargetLanguage;
  const dupFn = options?.executors?.duplicateScan ?? findDuplicateCandidatesForComplaint;

  let pending: any[] = [];
  try {
    pending = await db.aiProcessingJob.findMany({
      where: {
        status: 'PENDING',
        scheduledAt: { lte: now },
      },
      orderBy: { scheduledAt: 'asc' },
      take: batchSize,
    });
  } catch (err: any) {
    if (err?.code === 'P2021') {
      return { processed: 0, completed: 0, retried: 0, failed: 0, migrationPending: true };
    }
    throw err;
  }

  let completed = 0;
  let retried = 0;
  let failed = 0;

  for (const job of pending) {
    const nextAttempt = (job.attempts ?? 0) + 1;
    await db.aiProcessingJob.update({
      where: { id: job.id },
      data: { status: 'PROCESSING', attempts: nextAttempt },
    });

    try {
      let jobResult: Record<string, any> = {};

      if (job.jobType === 'TRANSLATE') {
        const targetLang =
          job.payload?.targetLanguage === 'hi' || job.payload?.targetLanguage === 'ta'
            ? job.payload.targetLanguage
            : 'en';
        const out = await translateFn(job.complaintId, targetLang, {
          id: 'system-cron',
          role: 'SUPER_ADMIN',
        });
        jobResult = { targetLanguage: targetLang, provider: out.provider, cached: out.cached };
      } else if (job.jobType === 'DUPLICATE_SCAN') {
        const res = await dupFn(job.complaintId, { role: 'SUPER_ADMIN' });
        if (!res.ok) {
          throw new Error(res.error);
        }
        jobResult = { matchCount: res.duplicates.length };
      } else {
        throw new Error(`Unsupported AI job type: ${String(job.jobType)}`);
      }

      await db.aiProcessingJob.update({
        where: { id: job.id },
        data: {
          status: 'COMPLETED',
          result: jobResult,
          lastError: null,
          completedAt: new Date(now),
        },
      });
      completed += 1;
    } catch (err: any) {
      const errorMsg = (err?.message || 'AI job execution failed').slice(0, 250);
      const maxAttempts = job.maxAttempts ?? 3;
      if (nextAttempt >= maxAttempts) {
        await db.aiProcessingJob.update({
          where: { id: job.id },
          data: {
            status: 'FAILED',
            lastError: errorMsg,
          },
        });
        failed += 1;
      } else {
        // Exponential backoff: 2^attempts minutes
        const backoffMs = Math.pow(2, nextAttempt) * 60_000;
        await db.aiProcessingJob.update({
          where: { id: job.id },
          data: {
            status: 'PENDING',
            lastError: errorMsg,
            scheduledAt: new Date(now.getTime() + backoffMs),
          },
        });
        retried += 1;
      }
    }
  }

  return {
    processed: pending.length,
    completed,
    retried,
    failed,
  };
}
