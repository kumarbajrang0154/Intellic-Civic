import { z } from 'zod';
import {
  startComplaintWork,
  submitWorkForReview,
  uploadWorkEvidence,
} from '@/services/fieldWorkerService';

export const offlineFieldActionSchema = z.discriminatedUnion('actionType', [
  z.object({
    idempotencyKey: z.string().min(4).max(120),
    actionType: z.literal('START_WORK'),
    complaintId: z.string().min(1).max(120),
    capturedAt: z.string().datetime().optional(),
  }),
  z.object({
    idempotencyKey: z.string().min(4).max(120),
    actionType: z.literal('UPLOAD_EVIDENCE'),
    complaintId: z.string().min(1).max(120),
    stage: z.enum(['BEFORE', 'DURING', 'AFTER']),
    imageUrl: z.string().min(1).max(500000),
    notes: z.string().max(1000).optional(),
    capturedAt: z.string().datetime().optional(),
  }),
  z.object({
    idempotencyKey: z.string().min(4).max(120),
    actionType: z.literal('SUBMIT_FOR_REVIEW'),
    complaintId: z.string().min(1).max(120),
    remarks: z.string().min(1).max(1000),
    capturedAt: z.string().datetime().optional(),
  }),
]);

export const fieldWorkerBatchSyncSchema = z.object({
  actions: z.array(offlineFieldActionSchema).min(1).max(20),
});

export type OfflineFieldActionInput = z.infer<typeof offlineFieldActionSchema>;

export interface FieldSyncExecutionResult {
  idempotencyKey: string;
  complaintId: string;
  actionType: OfflineFieldActionInput['actionType'];
  ok: boolean;
  status: number;
  message: string;
}

export async function processFieldWorkerOfflineBatch(
  actions: OfflineFieldActionInput[],
  fieldWorker: { id: string; name: string },
  executors?: {
    startWork?: typeof startComplaintWork;
    uploadEvidence?: typeof uploadWorkEvidence;
    submitReview?: typeof submitWorkForReview;
  },
): Promise<{
  total: number;
  succeeded: number;
  failed: number;
  results: FieldSyncExecutionResult[];
}> {
  const startWorkFn = executors?.startWork ?? startComplaintWork;
  const uploadEvidenceFn = executors?.uploadEvidence ?? uploadWorkEvidence;
  const submitReviewFn = executors?.submitReview ?? submitWorkForReview;

  const seenKeys = new Set<string>();
  const results: FieldSyncExecutionResult[] = [];
  let succeeded = 0;
  let failed = 0;

  for (const act of actions) {
    if (seenKeys.has(act.idempotencyKey)) {
      results.push({
        idempotencyKey: act.idempotencyKey,
        complaintId: act.complaintId,
        actionType: act.actionType,
        ok: true,
        status: 200,
        message: 'Duplicate idempotencyKey skipped in batch.',
      });
      succeeded += 1;
      continue;
    }
    seenKeys.add(act.idempotencyKey);

    try {
      let outcome: { ok: boolean; status: number; message: string };
      if (act.actionType === 'START_WORK') {
        outcome = await startWorkFn(act.complaintId, fieldWorker.id, fieldWorker.name);
      } else if (act.actionType === 'UPLOAD_EVIDENCE') {
        outcome = await uploadEvidenceFn(
          act.complaintId,
          fieldWorker.id,
          act.stage,
          act.imageUrl,
          act.notes,
          fieldWorker.name,
        );
      } else {
        outcome = await submitReviewFn(
          act.complaintId,
          fieldWorker.id,
          act.remarks,
          fieldWorker.name,
        );
      }

      if (outcome.ok) {
        succeeded += 1;
      } else {
        failed += 1;
      }

      results.push({
        idempotencyKey: act.idempotencyKey,
        complaintId: act.complaintId,
        actionType: act.actionType,
        ok: outcome.ok,
        status: outcome.status,
        message: outcome.message,
      });
    } catch (err: any) {
      failed += 1;
      results.push({
        idempotencyKey: act.idempotencyKey,
        complaintId: act.complaintId,
        actionType: act.actionType,
        ok: false,
        status: 500,
        message: (err?.message || 'Action sync failed').slice(0, 180),
      });
    }
  }

  return {
    total: actions.length,
    succeeded,
    failed,
    results,
  };
}

