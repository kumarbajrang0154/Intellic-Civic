import { test, expect } from '@playwright/test';
import { ComplaintStatus, NotificationType } from '@prisma/client';
import {
  castComplaintVote,
  isWithinReopenWindow,
  REOPEN_WINDOW_DAYS,
  removeComplaintVote,
  reopenCitizenComplaint,
  submitComplaintFeedback,
} from '@/services/complaint-loop-service';
import {
  validateComplaintIdParam,
  validateFeedbackInput,
  validateReopenInput,
} from '@/lib/validation';

function createMockLoopPrisma(seed: {
  complaints?: any[];
  feedbacks?: any[];
  votes?: any[];
  users?: any[];
}) {
  const state = {
    complaints: (seed.complaints || []).map((c) => ({
      voteCount: 0,
      reopenCount: 0,
      reopenedAt: null,
      reopenReason: null,
      readyForReview: false,
      assignment: null,
      ...c,
    })),
    feedbacks: (seed.feedbacks || []).map((f) => ({ ...f })),
    votes: (seed.votes || []).map((v) => ({ ...v })),
    users: (seed.users || []).map((u) => ({ ...u })),
    statusHistory: [] as any[],
    notifications: [] as any[],
  };

  const client: any = {
    complaint: {
      findFirst: async (args: any) => {
        const orList: any[] = args?.where?.OR || [];
        const match = state.complaints.find((c) =>
          orList.some(
            (cond) =>
              (cond.id && c.id === cond.id) || (cond.ticketId && c.ticketId === cond.ticketId),
          ),
        );
        if (!match) return null;
        const copy = { ...match };
        if (args?.include?.feedback) {
          copy.feedback = state.feedbacks.find((f) => f.complaintId === match.id) || null;
        }
        return copy;
      },
      findUnique: async (args: any) => {
        const match = state.complaints.find((c) => c.id === args?.where?.id);
        return match ? { ...match } : null;
      },
      update: async (args: any) => {
        const c = state.complaints.find((item) => item.id === args.where.id);
        if (!c) throw new Error('Complaint not found');
        if (args.data?.voteCount?.increment !== undefined) {
          c.voteCount += args.data.voteCount.increment;
        }
        return { ...c };
      },
      updateMany: async (args: any) => {
        const w = args.where || {};
        let count = 0;
        for (const c of state.complaints) {
          if (w.id && c.id !== w.id) continue;
          if (w.citizenId && c.citizenId !== w.citizenId) continue;
          if (w.reopenCount?.lt !== undefined && !(c.reopenCount < w.reopenCount.lt)) continue;
          if (w.status?.in && !w.status.in.includes(c.status)) continue;
          if (args.data?.reopenCount?.increment !== undefined) {
            c.reopenCount += args.data.reopenCount.increment;
          }
          const rest = { ...args.data };
          delete rest.reopenCount;
          Object.assign(c, rest);
          count++;
        }
        return { count };
      },
    },
    feedback: {
      create: async (args: any) => {
        const existing = state.feedbacks.find((f) => f.complaintId === args.data.complaintId);
        if (existing) {
          const err: any = new Error('Unique constraint failed');
          err.code = 'P2002';
          throw err;
        }
        const row = {
          id: `fb_${state.feedbacks.length + 1}`,
          createdAt: new Date('2026-10-05T10:00:00.000Z'),
          ...args.data,
        };
        state.feedbacks.push(row);
        return { ...row };
      },
    },
    complaintVote: {
      createMany: async (args: any) => {
        let count = 0;
        for (const item of args.data || []) {
          const dup = state.votes.find(
            (v) => v.complaintId === item.complaintId && v.citizenId === item.citizenId,
          );
          if (dup) {
            if (args.skipDuplicates) continue;
            const err: any = new Error('Unique constraint failed');
            err.code = 'P2002';
            throw err;
          }
          state.votes.push({
            id: `vote_${state.votes.length + 1}`,
            createdAt: new Date(),
            ...item,
          });
          count++;
        }
        return { count };
      },
      deleteMany: async (args: any) => {
        const before = state.votes.length;
        state.votes = state.votes.filter(
          (v) =>
            !(
              v.complaintId === args.where.complaintId &&
              v.citizenId === args.where.citizenId
            ),
        );
        return { count: before - state.votes.length };
      },
    },
    statusHistory: {
      create: async (args: any) => {
        const row = { id: `sh_${state.statusHistory.length + 1}`, ...args.data };
        state.statusHistory.push(row);
        return row;
      },
    },
    user: {
      findMany: async (args: any) => {
        return state.users
          .filter((u) => {
            const w = args?.where || {};
            if (typeof w.role === 'string' && u.role !== w.role) return false;
            if (w.role?.in && !w.role.in.includes(u.role)) return false;
            if (w.departmentId && u.departmentId !== w.departmentId) return false;
            if (w.isAuthorized !== undefined && u.isAuthorized !== w.isAuthorized) return false;
            if (w.isSuspended !== undefined && u.isSuspended !== w.isSuspended) return false;
            if (w.deletedAt === null && u.deletedAt !== null) return false;
            return true;
          })
          .map((u) => ({ ...u }));
      },
    },
    notification: {
      create: async (args: any) => {
        const row = { id: `notif_${state.notifications.length + 1}`, ...args.data };
        state.notifications.push(row);
        return row;
      },
    },
    $queryRaw: async (_strings: TemplateStringsArray, complaintId: string) => {
      const c = state.complaints.find((item) => item.id === complaintId);
      if (!c) return [];
      c.voteCount = Math.max(0, c.voteCount - 1);
      return [{ voteCount: c.voteCount }];
    },
    $transaction: async (fn: (tx: any) => Promise<any>) => fn(client),
  };

  return { state, client };
}

test.describe('Validation Helpers', () => {
  test('enforces comment <= 500, rating 1..5 integer, reopen reason 10..500, and ID sanity', () => {
    expect(validateFeedbackInput({ rating: 5, comment: 'Quick repair' }).success).toBe(true);
    expect(validateFeedbackInput({ rating: 5, comments: 'Works cleanly' }).success).toBe(true);
    expect(validateFeedbackInput({ rating: 3.5 }).success).toBe(false);
    expect(validateFeedbackInput({ rating: 6 }).success).toBe(false);
    expect(validateFeedbackInput({ rating: 4, comment: 'a'.repeat(501) }).success).toBe(false);

    expect(validateReopenInput({ reason: 'short' }).success).toBe(false);
    expect(validateReopenInput({ reason: 'a'.repeat(501) }).success).toBe(false);
    expect(validateReopenInput({ reason: 'Water leak started again near valve.' }).success).toBe(true);

    expect(validateComplaintIdParam('   ').success).toBe(false);
    expect(validateComplaintIdParam('bad id').success).toBe(false);
    expect(validateComplaintIdParam('IC-1001').success).toBe(true);
  });
});

test.describe('Citizen Feedback, Reopen & "Me Too" Upvote Transactions', () => {
  test('owner can rate once; second rating returns 409; non-owner receives 404', async () => {
    const { state, client } = createMockLoopPrisma({
      complaints: [
        {
          id: 'c_1',
          ticketId: 'IC-2001',
          citizenId: 'citizen_owner',
          status: ComplaintStatus.RESOLVED,
        },
      ],
    });

    const otherUserRes = await submitComplaintFeedback('c_1', 'citizen_other', 5, 'Trying', client);
    expect(otherUserRes.ok).toBe(false);
    expect(otherUserRes.status).toBe(404);

    const firstRes = await submitComplaintFeedback('c_1', 'citizen_owner', 5, 'Fixed fast', client);
    expect(firstRes.ok).toBe(true);
    expect(firstRes.status).toBe(200);
    expect(firstRes.feedback?.rating).toBe(5);
    expect(state.feedbacks).toHaveLength(1);

    const secondRes = await submitComplaintFeedback('c_1', 'citizen_owner', 2, 'Again', client);
    expect(secondRes.ok).toBe(false);
    expect(secondRes.status).toBe(409);
    expect(state.feedbacks).toHaveLength(1);
  });

  test('reopen rejects non-owner (404), expired window (>7d), and second reopen (409); valid reopen notifies & emails', async () => {
    const resolvedAt = new Date('2026-10-01T10:00:00.000Z');
    const withinWindowNow = new Date('2026-10-05T10:00:00.000Z'); // 4 days later
    const expiredWindowNow = new Date(
      resolvedAt.getTime() + (REOPEN_WINDOW_DAYS + 1) * 24 * 60 * 60 * 1000,
    );

    const { state, client } = createMockLoopPrisma({
      complaints: [
        {
          id: 'c_2',
          ticketId: 'IC-2002',
          title: 'Road crater',
          citizenId: 'citizen_owner',
          departmentId: 'dept_roads',
          status: ComplaintStatus.RESOLVED,
          resolvedAt,
          closedAt: null,
          assignment: {
            departmentOfficer: {
              id: 'officer_1',
              name: 'Roads Officer',
              email: 'officer@roads.gov.in',
              role: 'DEPARTMENT_OFFICER',
              isSuspended: false,
              deletedAt: null,
            },
          },
        },
      ],
      users: [
        {
          id: 'head_roads',
          email: 'head@roads.gov.in',
          role: 'DEPARTMENT_HEAD',
          departmentId: 'dept_roads',
          isAuthorized: true,
          isSuspended: false,
          deletedAt: null,
        },
      ],
    });

    // Other citizen gets 404
    const nonOwner = await reopenCitizenComplaint('c_2', 'citizen_stranger', 'Still broken here!', {
      clock: () => withinWindowNow,
      prismaClient: client,
      sendEmail: async () => ({ ok: true, status: 'SENT', recipientHash: 'h' }),
    });
    expect(nonOwner.status).toBe(404);

    // Expired reopen window gets 400
    const expiredRes = await reopenCitizenComplaint('c_2', 'citizen_owner', 'Still broken here!', {
      clock: () => expiredWindowNow,
      prismaClient: client,
      sendEmail: async () => ({ ok: true, status: 'SENT', recipientHash: 'h' }),
    });
    expect(expiredRes.status).toBe(400);

    // Valid reopen succeeds
    const emailedRecipients: string[] = [];
    const okRes = await reopenCitizenComplaint('c_2', 'citizen_owner', 'Patch washed away after rain.', {
      clock: () => withinWindowNow,
      prismaClient: client,
      sendEmail: async (_template, to) => {
        emailedRecipients.push(to);
        return { ok: true, status: 'SENT', recipientHash: 'h' };
      },
    });
    expect(okRes.ok).toBe(true);
    expect(okRes.status).toBe(200);
    expect(okRes.complaint?.status).toBe(ComplaintStatus.IN_PROGRESS);
    expect(okRes.complaint?.reopenCount).toBe(1);
    expect(state.statusHistory).toHaveLength(1);
    expect(state.notifications.map((n) => n.recipientUserId).sort()).toEqual(['head_roads', 'officer_1']);
    expect(state.notifications[0].type).toBe(NotificationType.COMPLAINT_REOPENED);
    expect(emailedRecipients.sort()).toEqual(['head@roads.gov.in', 'officer@roads.gov.in']);

    // Second reopen attempt returns 409 even if resolved again later
    state.complaints[0].status = ComplaintStatus.RESOLVED;
    const twiceRes = await reopenCitizenComplaint('c_2', 'citizen_owner', 'Still not satisfactory.', {
      clock: () => withinWindowNow,
      prismaClient: client,
      sendEmail: async () => ({ ok: true, status: 'SENT', recipientHash: 'h' }),
    });
    expect(twiceRes.ok).toBe(false);
    expect(twiceRes.status).toBe(409);
  });

  test('"Me Too" vote is idempotent, matches exact vote row count, and rejects own-complaint votes (403)', async () => {
    const { state, client } = createMockLoopPrisma({
      complaints: [
        {
          id: 'c_3',
          ticketId: 'IC-2003',
          citizenId: 'citizen_owner',
          status: ComplaintStatus.IN_PROGRESS,
          voteCount: 0,
        },
      ],
    });

    // Owner voting on own complaint rejected with 403
    const ownPost = await castComplaintVote('c_3', 'citizen_owner', client);
    expect(ownPost.ok).toBe(false);
    expect(ownPost.status).toBe(403);

    const ownDel = await removeComplaintVote('c_3', 'citizen_owner', client);
    expect(ownDel.ok).toBe(false);
    expect(ownDel.status).toBe(403);

    // Citizen A votes twice (idempotent)
    const v1 = await castComplaintVote('c_3', 'citizen_a', client);
    expect(v1.ok).toBe(true);
    expect(v1.voted).toBe(true);
    expect(v1.voteCount).toBe(1);

    const v1Dup = await castComplaintVote('c_3', 'citizen_a', client);
    expect(v1Dup.ok).toBe(true);
    expect(v1Dup.voted).toBe(true);
    expect(v1Dup.voteCount).toBe(1);

    // Citizen B votes -> count 2, reconciles with rows
    const v2 = await castComplaintVote('c_3', 'citizen_b', client);
    expect(v2.voteCount).toBe(2);
    expect(state.complaints[0].voteCount).toBe(
      state.votes.filter((v) => v.complaintId === 'c_3').length,
    );

    // Citizen A unvotes -> count 1; double unvote -> still 1, reconciles with rows
    const del1 = await removeComplaintVote('c_3', 'citizen_a', client);
    expect(del1.ok).toBe(true);
    expect(del1.voted).toBe(false);
    expect(del1.voteCount).toBe(1);

    const del1Dup = await removeComplaintVote('c_3', 'citizen_a', client);
    expect(del1Dup.ok).toBe(true);
    expect(del1Dup.voteCount).toBe(1);
    expect(state.complaints[0].voteCount).toBe(
      state.votes.filter((v) => v.complaintId === 'c_3').length,
    );

    // Concurrent duplicate vote reads latest count inside transaction instead of stale snapshot
    const concurrentClient = {
      ...client,
      $transaction: async (fn: (tx: any) => Promise<any>) => {
        const txProxy = {
          ...client,
          complaint: {
            ...client.complaint,
            findFirst: async (args: any) => {
              const res = await client.complaint.findFirst(args);
              // Simulate another citizen voting before createMany runs
              state.complaints[0].voteCount = 9;
              return res;
            },
          },
        };
        return fn(txProxy);
      },
    };
    const concurrentDup = await castComplaintVote('c_3', 'citizen_b', concurrentClient as any);
    expect(concurrentDup.ok).toBe(true);
    expect(concurrentDup.voteCount).toBe(9);
  });

  test('isWithinReopenWindow enforces exact 7-day boundary and rejects future resolvedAt timestamps', () => {
    const resolvedAt = new Date('2026-10-01T10:00:00.000Z');
    const exactBoundary = new Date(resolvedAt.getTime() + 7 * 24 * 60 * 60 * 1000);
    const pastBoundary = new Date(exactBoundary.getTime() + 1);
    const beforeResolved = new Date(resolvedAt.getTime() - 1000);

    expect(isWithinReopenWindow(resolvedAt, exactBoundary)).toBe(true);
    expect(isWithinReopenWindow(resolvedAt, pastBoundary)).toBe(false);
    expect(isWithinReopenWindow(resolvedAt, beforeResolved)).toBe(false);
  });

  test('reopen still succeeds when post-commit email dispatch returns FAILED', async () => {
    const resolvedAt = new Date('2026-10-01T10:00:00.000Z');
    const now = new Date('2026-10-03T10:00:00.000Z');
    const { state, client } = createMockLoopPrisma({
      complaints: [
        {
          id: 'c_email_fail',
          ticketId: 'IC-2099',
          title: 'Collapsed Manhole',
          citizenId: 'citizen_owner',
          departmentId: 'dept_roads',
          status: ComplaintStatus.RESOLVED,
          resolvedAt,
        },
      ],
      users: [
        {
          id: 'head_roads',
          email: 'head@roads.gov.in',
          role: 'DEPARTMENT_HEAD',
          departmentId: 'dept_roads',
          isAuthorized: true,
          isSuspended: false,
          deletedAt: null,
        },
      ],
    });

    const result = await reopenCitizenComplaint(
      'c_email_fail',
      'citizen_owner',
      'Cover was not secured and sank again.',
      {
        clock: () => now,
        prismaClient: client,
        sendEmail: async () => ({
          ok: false,
          status: 'FAILED',
          recipientHash: 'abc123',
          error: 'Simulated SMTP outage',
        }),
      },
    );

    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
    expect(state.complaints[0].status).toBe(ComplaintStatus.IN_PROGRESS);
    expect(state.complaints[0].reopenCount).toBe(1);
    expect(state.notifications).toHaveLength(1);
  });
});
