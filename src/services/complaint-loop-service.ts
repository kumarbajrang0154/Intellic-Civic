import { ComplaintStatus, NotificationType, Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import {
  buildAppUrl,
  sendTemplatedEmail,
  type EmailTemplateDataMap,
  type EmailTemplateName,
  type SendEmailResult,
} from '@/services/email-service';
import {
  REOPEN_REASON_MAX_LENGTH,
  REOPEN_REASON_MIN_LENGTH,
} from '@/lib/validation';

export const REOPEN_WINDOW_DAYS = 7;
export const REOPEN_WINDOW_MS = REOPEN_WINDOW_DAYS * 24 * 60 * 60 * 1000;
export const MAX_REOPEN_COUNT = 1;

export interface FeedbackOutput {
  id: string;
  rating: number;
  comment?: string;
  createdAt: string;
}

export interface ReopenServiceOptions {
  clock?: () => Date;
  prismaClient?: typeof prisma;
  sendEmail?: <T extends EmailTemplateName>(
    template: T,
    toEmail: string,
    data: EmailTemplateDataMap[T],
  ) => Promise<SendEmailResult>;
}

export function isWithinReopenWindow(
  resolvedAt: Date | string | null | undefined,
  now: Date,
  windowDays: number = REOPEN_WINDOW_DAYS,
): boolean {
  if (!resolvedAt) return false;
  const resolvedDate = resolvedAt instanceof Date ? resolvedAt : new Date(resolvedAt);
  if (Number.isNaN(resolvedDate.getTime()) || Number.isNaN(now.getTime())) {
    return false;
  }
  const elapsedMs = now.getTime() - resolvedDate.getTime();
  return elapsedMs <= windowDays * 24 * 60 * 60 * 1000;
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002'
  ) || (typeof error === 'object' && error !== null && (error as any).code === 'P2002');
}

/**
 * Submits citizen feedback (rating 1..5, optional comment <= 500 chars) inside a transaction.
 * Returns 404 for both missing and non-owned complaints to avoid disclosing existence.
 * Returns 409 if feedback already exists for the complaint.
 */
export async function submitComplaintFeedback(
  complaintIdOrTicket: string,
  citizenId: string,
  rating: number,
  comment?: string,
  prismaClient: typeof prisma = prisma,
): Promise<{ ok: boolean; status: number; message: string; feedback?: FeedbackOutput }> {
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return { ok: false, status: 400, message: 'Rating must be an integer between 1 and 5.' };
  }

  const trimmedComment = comment?.trim() || undefined;
  if (trimmedComment && trimmedComment.length > 500) {
    return { ok: false, status: 400, message: 'Comment must not exceed 500 characters.' };
  }

  try {
    return await prismaClient.$transaction(async (tx) => {
      const complaint = await tx.complaint.findFirst({
        where: {
          OR: [{ id: complaintIdOrTicket }, { ticketId: complaintIdOrTicket }],
        },
        include: { feedback: true },
      });

      // Do not reveal whether another citizen's complaint exists
      if (!complaint || complaint.citizenId !== citizenId) {
        return { ok: false, status: 404, message: 'Complaint ticket not found.' };
      }

      if (complaint.status !== ComplaintStatus.RESOLVED && complaint.status !== ComplaintStatus.CLOSED) {
        return {
          ok: false,
          status: 400,
          message: 'Feedback can only be submitted for RESOLVED or CLOSED complaints.',
        };
      }

      if (complaint.feedback) {
        return {
          ok: false,
          status: 409,
          message: 'Feedback has already been submitted for this complaint.',
        };
      }

      const created = await tx.feedback.create({
        data: {
          complaintId: complaint.id,
          citizenId,
          rating,
          comment: trimmedComment,
        },
      });

      return {
        ok: true,
        status: 200,
        message: 'Feedback submitted successfully.',
        feedback: {
          id: created.id,
          rating: created.rating,
          comment: created.comment || undefined,
          createdAt: created.createdAt.toISOString(),
        },
      };
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return {
        ok: false,
        status: 409,
        message: 'Feedback has already been submitted for this complaint.',
      };
    }
    throw error;
  }
}

/**
 * Reopens a resolved/closed complaint once within the configured 7-day window inside a transaction.
 * Writes StatusHistory and in-app Notification rows for the assigned officer and Department Head,
 * then dispatches email notifications strictly after the transaction commits.
 */
export async function reopenCitizenComplaint(
  complaintIdOrTicket: string,
  citizenId: string,
  reason: string,
  options: ReopenServiceOptions = {},
): Promise<{
  ok: boolean;
  status: number;
  message: string;
  complaint?: {
    id: string;
    ticketId: string;
    status: ComplaintStatus;
    reopenCount: number;
    reopenedAt: string;
    reopenReason: string;
  };
}> {
  const clock = options.clock || (() => new Date());
  const now = clock();
  const db = options.prismaClient || prisma;
  const emailSender =
    options.sendEmail ||
    (<T extends EmailTemplateName>(
      template: T,
      toEmail: string,
      data: EmailTemplateDataMap[T],
    ) => sendTemplatedEmail(template, toEmail, data));

  const trimmedReason = (reason || '').trim();
  if (trimmedReason.length < REOPEN_REASON_MIN_LENGTH || trimmedReason.length > REOPEN_REASON_MAX_LENGTH) {
    return {
      ok: false,
      status: 400,
      message: `A detailed reason (${REOPEN_REASON_MIN_LENGTH} to ${REOPEN_REASON_MAX_LENGTH} characters) is required to reopen.`,
    };
  }

  const txResult = await db.$transaction(async (tx) => {
    const complaint = await tx.complaint.findFirst({
      where: {
        OR: [{ id: complaintIdOrTicket }, { ticketId: complaintIdOrTicket }],
      },
      include: {
        assignment: {
          include: {
            departmentOfficer: {
              select: { id: true, name: true, email: true, role: true, isSuspended: true, deletedAt: true },
            },
          },
        },
      },
    });

    // Do not reveal whether another citizen's complaint exists
    if (!complaint || complaint.citizenId !== citizenId) {
      return { ok: false as const, status: 404, message: 'Complaint ticket not found.' };
    }

    if (complaint.reopenCount >= MAX_REOPEN_COUNT) {
      return {
        ok: false as const,
        status: 409,
        message: 'This complaint has already been reopened once and cannot be reopened again.',
      };
    }

    if (complaint.status !== ComplaintStatus.RESOLVED && complaint.status !== ComplaintStatus.CLOSED) {
      return {
        ok: false as const,
        status: 400,
        message: 'Only RESOLVED or CLOSED complaints can be reopened.',
      };
    }

    const resolutionTimestamp = complaint.resolvedAt || complaint.closedAt;
    if (!isWithinReopenWindow(resolutionTimestamp, now)) {
      return {
        ok: false as const,
        status: 400,
        message: `Reopen window expired. Complaints can only be reopened within ${REOPEN_WINDOW_DAYS} days of resolution.`,
      };
    }

    const nextStatus = complaint.departmentId
      ? ComplaintStatus.IN_PROGRESS
      : ComplaintStatus.PENDING_DEPT_REVIEW;

    const updated = await tx.complaint.updateMany({
      where: {
        id: complaint.id,
        citizenId,
        reopenCount: { lt: MAX_REOPEN_COUNT },
        status: { in: [ComplaintStatus.RESOLVED, ComplaintStatus.CLOSED] },
      },
      data: {
        status: nextStatus,
        reopenCount: { increment: 1 },
        reopenedAt: now,
        reopenReason: trimmedReason,
        readyForReview: false,
      },
    });

    if (updated.count === 0) {
      return {
        ok: false as const,
        status: 409,
        message: 'Complaint reopen conflicted with a concurrent update.',
      };
    }

    await tx.statusHistory.create({
      data: {
        complaintId: complaint.id,
        fromStatus: complaint.status,
        toStatus: nextStatus,
        changedByUserId: citizenId,
        notes: `Citizen reopened complaint: "${trimmedReason}"`,
      },
    });

    const recipientMap = new Map<string, { id: string; email: string | null; role: string }>();

    const assignedOfficer = complaint.assignment?.departmentOfficer;
    if (assignedOfficer && !assignedOfficer.isSuspended && !assignedOfficer.deletedAt) {
      recipientMap.set(assignedOfficer.id, {
        id: assignedOfficer.id,
        email: assignedOfficer.email,
        role: String(assignedOfficer.role || 'DEPARTMENT_OFFICER'),
      });
    }

    if (complaint.departmentId) {
      const deptHeads = await tx.user.findMany({
        where: {
          role: 'DEPARTMENT_HEAD',
          departmentId: complaint.departmentId,
          isAuthorized: true,
          isSuspended: false,
          deletedAt: null,
        },
        select: { id: true, email: true, role: true },
      });
      for (const head of deptHeads) {
        recipientMap.set(head.id, {
          id: head.id,
          email: head.email,
          role: String(head.role || 'DEPARTMENT_HEAD'),
        });
      }
    }

    if (recipientMap.size === 0) {
      const admins = await tx.user.findMany({
        where: {
          role: { in: ['ADMIN', 'SUPER_ADMIN'] },
          isAuthorized: true,
          isSuspended: false,
          deletedAt: null,
        },
        select: { id: true, email: true, role: true },
      });
      for (const admin of admins) {
        recipientMap.set(admin.id, {
          id: admin.id,
          email: admin.email,
          role: String(admin.role || 'ADMIN'),
        });
      }
    }

    const recipients = Array.from(recipientMap.values());
    for (const recipient of recipients) {
      await tx.notification.create({
        data: {
          complaintId: complaint.id,
          recipientUserId: recipient.id,
          type: NotificationType.COMPLAINT_REOPENED,
          message: `Complaint #${complaint.ticketId} was reopened by the citizen (${nextStatus.replace(/_/g, ' ')}).`,
        },
      });
    }

    return {
      ok: true as const,
      status: 200,
      complaint: {
        id: complaint.id,
        ticketId: complaint.ticketId,
        title: complaint.title,
        status: nextStatus,
        reopenCount: complaint.reopenCount + 1,
        reopenedAt: now.toISOString(),
        reopenReason: trimmedReason,
      },
      recipients,
    };
  });

  if (!txResult.ok) {
    return txResult;
  }

  // Email sending runs strictly after DB transaction commits
  for (const recipient of txResult.recipients) {
    if (!recipient.email) continue;
    const prefix =
      recipient.role === 'DEPARTMENT_HEAD'
        ? '/dept-head'
        : recipient.role === 'DEPARTMENT_OFFICER'
        ? '/officer'
        : '/admin';
    await emailSender('complaintReopened', recipient.email, {
      ticketId: txResult.complaint.ticketId,
      title: txResult.complaint.title,
      reason: txResult.complaint.reopenReason,
      newStatus: txResult.complaint.status,
      complaintUrl: buildAppUrl(`${prefix}/complaints/${txResult.complaint.id}`),
    });
  }

  return {
    ok: true,
    status: 200,
    message: 'Complaint reopened successfully.',
    complaint: {
      id: txResult.complaint.id,
      ticketId: txResult.complaint.ticketId,
      status: txResult.complaint.status,
      reopenCount: txResult.complaint.reopenCount,
      reopenedAt: txResult.complaint.reopenedAt,
      reopenReason: txResult.complaint.reopenReason,
    },
  };
}

/**
 * Upvotes ("Me too") a complaint on behalf of an authenticated citizen.
 * Idempotent: repeated POST by the same citizen preserves voteCount without error.
 * Rejects voting on own complaint with 403.
 */
export async function castComplaintVote(
  complaintIdOrTicket: string,
  citizenId: string,
  prismaClient: typeof prisma = prisma,
): Promise<{
  ok: boolean;
  status: number;
  message: string;
  voted?: boolean;
  voteCount?: number;
}> {
  return prismaClient.$transaction(async (tx) => {
    const complaint = await tx.complaint.findFirst({
      where: {
        OR: [{ id: complaintIdOrTicket }, { ticketId: complaintIdOrTicket }],
      },
      select: { id: true, citizenId: true, voteCount: true },
    });

    if (!complaint) {
      return { ok: false, status: 404, message: 'Complaint ticket not found.' };
    }

    if (complaint.citizenId === citizenId) {
      return { ok: false, status: 403, message: 'Forbidden: You cannot upvote your own complaint.' };
    }

    const created = await tx.complaintVote.createMany({
      data: [{ complaintId: complaint.id, citizenId }],
      skipDuplicates: true,
    });

    if (created.count > 0) {
      const updated = await tx.complaint.update({
        where: { id: complaint.id },
        data: { voteCount: { increment: 1 } },
        select: { voteCount: true },
      });
      return {
        ok: true,
        status: 200,
        message: 'Complaint upvoted.',
        voted: true,
        voteCount: updated.voteCount,
      };
    }

    return {
      ok: true,
      status: 200,
      message: 'Complaint already upvoted.',
      voted: true,
      voteCount: complaint.voteCount,
    };
  });
}

/**
 * Removes a citizen's "Me too" upvote from a complaint atomically.
 * Idempotent: removing a non-existent vote succeeds with the current count.
 */
export async function removeComplaintVote(
  complaintIdOrTicket: string,
  citizenId: string,
  prismaClient: typeof prisma = prisma,
): Promise<{
  ok: boolean;
  status: number;
  message: string;
  voted?: boolean;
  voteCount?: number;
}> {
  return prismaClient.$transaction(async (tx) => {
    const complaint = await tx.complaint.findFirst({
      where: {
        OR: [{ id: complaintIdOrTicket }, { ticketId: complaintIdOrTicket }],
      },
      select: { id: true, citizenId: true, voteCount: true },
    });

    if (!complaint) {
      return { ok: false, status: 404, message: 'Complaint ticket not found.' };
    }

    if (complaint.citizenId === citizenId) {
      return { ok: false, status: 403, message: 'Forbidden: You cannot vote on your own complaint.' };
    }

    const deleted = await tx.complaintVote.deleteMany({
      where: { complaintId: complaint.id, citizenId },
    });

    if (deleted.count > 0) {
      const rows = await tx.$queryRaw<Array<{ voteCount: number }>>`
        UPDATE "complaints"
        SET "voteCount" = GREATEST(0, "voteCount" - 1)
        WHERE "id" = ${complaint.id}
        RETURNING "voteCount"
      `;
      const newCount = rows?.[0]?.voteCount ?? Math.max(0, complaint.voteCount - 1);
      return {
        ok: true,
        status: 200,
        message: 'Upvote removed.',
        voted: false,
        voteCount: Number(newCount),
      };
    }

    return {
      ok: true,
      status: 200,
      message: 'Upvote already removed.',
      voted: false,
      voteCount: complaint.voteCount,
    };
  });
}

