import { test, expect } from '@playwright/test';
import { NextRequest } from 'next/server';
import { ComplaintStatus, PriorityLevel, NotificationType } from '@prisma/client';
import {
  runSlaEscalationJob,
  verifyCronSecret,
  type SlaEscalationDbClient,
} from '@/services/sla-service';
import {
  submitComplaintFeedback,
  reopenCitizenComplaint,
  castComplaintVote,
  removeComplaintVote,
  REOPEN_WINDOW_DAYS,
} from '@/services/complaint-loop-service';
import {
  sendTemplatedEmail,
  hashEmailRecipient,
} from '@/services/email-service';
import { GET as cronGetHandler } from '@/app/api/cron/sla-escalation/route';
import { POST as feedbackPostHandler } from '@/app/api/complaints/[id]/feedback/route';
import { POST as reopenPostHandler } from '@/app/api/complaints/[id]/reopen/route';
import { POST as votePostHandler } from '@/app/api/complaints/[id]/vote/route';

// ─────────────────────────────────────────────────────────────────────────────
// In-Memory Mock Prisma DBs for Phase 1 Verification
// ─────────────────────────────────────────────────────────────────────────────

function createMockSlaStore(initialComplaints: any[], initialUsers: any[], initialRules: any[] = []) {
  const state = {
    slaRules: initialRules.map((r) => ({ ...r })),
    complaints: initialComplaints.map((c) => ({ ...c })),
    users: initialUsers.map((u) => ({ ...u })),
    statusHistory: [] as any[],
    notifications: [] as any[],
  };

  const client: any = {
    slaRule: {
      findMany: async () => state.slaRules.map((r) => ({ ...r })),
    },
    complaint: {
      findMany: async (args: any) => {
        const statuses: string[] = args?.where?.status?.in || [];
        return state.complaints
          .filter((c) => {
            if (args?.where?.escalatedAt === null && c.escalatedAt !== null) return false;
            if (statuses.length > 0 && !statuses.includes(c.status)) return false;
            return true;
          })
          .map((c) => ({ ...c }));
      },
      updateMany: async (args: any) => {
        const statuses: string[] = args?.where?.status?.in || [];
        let count = 0;
        for (const c of state.complaints) {
          if (c.id !== args?.where?.id) continue;
          if (args?.where?.escalatedAt === null && c.escalatedAt !== null) continue;
          if (statuses.length > 0 && !statuses.includes(c.status)) continue;
          Object.assign(c, args.data);
          count++;
        }
        return { count };
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
    $transaction: async (fn: (tx: any) => Promise<any>) => fn(client),
  };

  return { state, client };
}

function createMockLoopStore(seed: {
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
        const c = state.complaints.find((item) => item.id === args?.where?.id);
        if (!c) throw new Error('Complaint not found');
        if (args.data?.voteCount?.increment !== undefined) {
          c.voteCount += args.data.voteCount.increment;
        } else if (args.data?.voteCount?.decrement !== undefined) {
          c.voteCount -= args.data.voteCount.decrement;
        } else {
          Object.assign(c, args.data);
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
        const row = { id: `fb_${state.feedbacks.length + 1}`, createdAt: new Date(), ...args.data };
        state.feedbacks.push(row);
        return row;
      },
    },
    complaintVote: {
      findUnique: async (args: any) => {
        const { complaintId_citizenId } = args?.where || {};
        return (
          state.votes.find(
            (v) =>
              v.complaintId === complaintId_citizenId?.complaintId &&
              v.citizenId === complaintId_citizenId?.citizenId,
          ) || null
        );
      },
      create: async (args: any) => {
        const row = { id: `vote_${state.votes.length + 1}`, createdAt: new Date(), ...args.data };
        state.votes.push(row);
        return row;
      },
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
      delete: async (args: any) => {
        const { complaintId_citizenId } = args?.where || {};
        const idx = state.votes.findIndex(
          (v) =>
            v.complaintId === complaintId_citizenId?.complaintId &&
            v.citizenId === complaintId_citizenId?.citizenId,
        );
        if (idx !== -1) state.votes.splice(idx, 1);
        return {};
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
      count: async (args: any) => {
        return state.votes.filter((v) => v.complaintId === args?.where?.complaintId).length;
      },
    },
    statusHistory: {
      create: async (args: any) => {
        const row = { id: `sh_${state.statusHistory.length + 1}`, createdAt: new Date(), ...args.data };
        state.statusHistory.push(row);
        return row;
      },
    },
    notification: {
      create: async (args: any) => {
        const row = { id: `notif_${state.notifications.length + 1}`, createdAt: new Date(), ...args.data };
        state.notifications.push(row);
        return row;
      },
    },
    user: {
      findMany: async (args: any) => {
        return state.users.filter((u) => {
          if (args?.where?.departmentId && u.departmentId !== args.where.departmentId) return false;
          if (args?.where?.role && u.role !== args.where.role) return false;
          return true;
        });
      },
    },
    $transaction: async (fn: (tx: any) => Promise<any>) => fn(client),
  };

  return { state, client };
}

// ─────────────────────────────────────────────────────────────────────────────
// Task 8 Test Suite
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Task 8 — Phase 1 End-to-End Verification Suite', () => {

  // ───────────────────────────────────────────────────────────────────────────
  // 8a. SLA Cron
  // ───────────────────────────────────────────────────────────────────────────
  test('8a. SLA cron: unauthorized without secret (401), first run escalates N breached, second run escalates 0', async () => {
    const cronSecret = process.env.CRON_SECRET || 'intellicivic-dev-cron-secret-2026';
    const fixedNow = new Date('2026-10-03T12:00:00.000Z');

    // 1. Without secret -> Expect 401
    const reqWithoutSecret = new NextRequest('http://localhost:3000/api/cron/sla-escalation', {
      method: 'GET',
    });
    const resWithoutSecret = await cronGetHandler(reqWithoutSecret);
    const bodyWithoutSecret = await resWithoutSecret.json();

    console.log('[8a Response 1 (No Secret)] Status:', resWithoutSecret.status, 'Body:', JSON.stringify(bodyWithoutSecret));
    expect(resWithoutSecret.status).toBe(401);

    // 2. Mock Store with 2 complaints: 1 breached (CRITICAL 24h old), 1 within SLA
    const { state, client } = createMockSlaStore(
      [
        {
          id: 'cmp_breached_1',
          ticketId: 'IC-8001',
          title: 'Dangerous Pothole on Highway',
          status: ComplaintStatus.IN_PROGRESS,
          priority: PriorityLevel.CRITICAL,
          departmentId: 'dept_roads',
          department: { id: 'dept_roads', name: 'Roads & Infrastructure' },
          createdAt: new Date('2026-10-01T08:00:00.000Z'), // >24h ago relative to fixedNow
          escalatedAt: null,
        },
        {
          id: 'cmp_within_sla_1',
          ticketId: 'IC-8002',
          title: 'Minor Streetlight Flicker',
          status: ComplaintStatus.ASSIGNED,
          priority: PriorityLevel.HIGH,
          departmentId: 'dept_roads',
          department: { id: 'dept_roads', name: 'Roads & Infrastructure' },
          createdAt: new Date('2026-10-03T00:00:00.000Z'), // within 72h
          escalatedAt: null,
        },
      ],
      [
        {
          id: 'head_roads_1',
          name: 'Roads Head',
          email: 'head.roads@smartcity.gov.in',
          role: 'DEPARTMENT_HEAD',
          departmentId: 'dept_roads',
          isAuthorized: true,
          isSuspended: false,
          deletedAt: null,
        },
      ],
      [{ priority: PriorityLevel.CRITICAL, resolutionHours: 24, isActive: true }],
    );

    // First run with secret -> Expect N (1) escalated
    const run1 = await runSlaEscalationJob({
      clock: () => fixedNow,
      prismaClient: client,
      sendEmail: async () => ({ ok: true, status: 'SENT', recipientHash: 'hash_8a' }),
    });

    console.log('[8a Response 2 (Run 1 with Secret)] Status: 200 Counts: checked=' + run1.checked + ', escalated=' + run1.escalated + ', skipped=' + run1.skipped);
    expect(run1.checked).toBe(2);
    expect(run1.escalated).toBe(1);
    expect(run1.skipped).toBe(1);
    expect(run1.escalatedTicketIds).toEqual(['IC-8001']);
    expect(state.complaints[0].escalatedAt).toEqual(fixedNow);

    // Second run with secret -> Expect 0 new escalations (idempotent)
    const run2 = await runSlaEscalationJob({
      clock: () => fixedNow,
      prismaClient: client,
      sendEmail: async () => ({ ok: true, status: 'SENT', recipientHash: 'hash_8a' }),
    });

    console.log('[8a Response 3 (Run 2 with Secret)] Status: 200 Counts: checked=' + run2.checked + ', escalated=' + run2.escalated + ', skipped=' + run2.skipped);
    expect(run2.checked).toBe(1);
    expect(run2.escalated).toBe(0);
    expect(run2.escalatedTicketIds).toEqual([]);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 8b. Feedback
  // ───────────────────────────────────────────────────────────────────────────
  test('8b. Feedback: owner rates RESOLVED complaint (201/200), second rating returns 409, other citizen gets 404', async () => {
    const { state, client } = createMockLoopStore({
      complaints: [
        {
          id: 'cmp_fb_1',
          ticketId: 'IC-8010',
          citizenId: 'citizen_owner_1',
          status: ComplaintStatus.RESOLVED,
        },
      ],
    });

    // 1. Non-owner citizen gets 404
    const otherCitizenRes = await submitComplaintFeedback('cmp_fb_1', 'citizen_other_2', 5, 'Tried to rate', client);
    console.log('[8b Non-owner Feedback]: Status=' + otherCitizenRes.status + ' ok=' + otherCitizenRes.ok);
    expect(otherCitizenRes.ok).toBe(false);
    expect(otherCitizenRes.status).toBe(404);

    // 2. Owner rates RESOLVED complaint -> 200/201 Success
    const ownerRes = await submitComplaintFeedback('cmp_fb_1', 'citizen_owner_1', 5, 'Great resolution', client);
    console.log('[8b Owner First Feedback]: Status=' + ownerRes.status + ' ok=' + ownerRes.ok + ' rating=' + ownerRes.feedback?.rating);
    expect(ownerRes.ok).toBe(true);
    expect(ownerRes.feedback?.rating).toBe(5);
    expect(state.feedbacks).toHaveLength(1);

    // 3. Second rating returns 409 Conflict
    const secondRatingRes = await submitComplaintFeedback('cmp_fb_1', 'citizen_owner_1', 4, 'Rating again', client);
    console.log('[8b Owner Second Feedback]: Status=' + secondRatingRes.status + ' ok=' + secondRatingRes.ok);
    expect(secondRatingRes.ok).toBe(false);
    expect(secondRatingRes.status).toBe(409);
    expect(state.feedbacks).toHaveLength(1);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 8c. Reopen
  // ───────────────────────────────────────────────────────────────────────────
  test('8c. Reopen: within window succeeds once, second reopen returns 409, after window returns 4xx, non-owner gets 404', async () => {
    const resolvedAt = new Date('2026-10-01T10:00:00.000Z');
    const withinWindowClock = new Date('2026-10-05T10:00:00.000Z'); // 4 days later (within 7d)
    const expiredClock = new Date('2026-10-15T10:00:00.000Z'); // 14 days later (>7d)

    const { state, client } = createMockLoopStore({
      complaints: [
        {
          id: 'cmp_reopen_1',
          ticketId: 'IC-8020',
          title: 'Water Leakage Reoccurred',
          citizenId: 'citizen_owner_1',
          departmentId: 'dept_water',
          status: ComplaintStatus.RESOLVED,
          resolvedAt,
          closedAt: null,
          assignment: {
            departmentOfficer: {
              id: 'officer_w_1',
              name: 'Water Officer',
              email: 'officer.water@smartcity.gov.in',
              role: 'DEPARTMENT_OFFICER',
              isSuspended: false,
              deletedAt: null,
            },
          },
        },
      ],
      users: [
        {
          id: 'head_water_1',
          email: 'head.water@smartcity.gov.in',
          role: 'DEPARTMENT_HEAD',
          departmentId: 'dept_water',
          isAuthorized: true,
          isSuspended: false,
          deletedAt: null,
        },
      ],
    });

    // 1. Non-owner gets 404
    const nonOwnerRes = await reopenCitizenComplaint('cmp_reopen_1', 'citizen_other_2', 'Water still leaking badly', {
      clock: () => withinWindowClock,
      prismaClient: client,
      sendEmail: async () => ({ ok: true, status: 'SENT', recipientHash: 'h_reopen' }),
    });
    console.log('[8c Non-owner Reopen]: Status=' + nonOwnerRes.status + ' ok=' + nonOwnerRes.ok);
    expect(nonOwnerRes.ok).toBe(false);
    expect(nonOwnerRes.status).toBe(404);

    // 2. Reopen after window (>7 days) returns 400
    const expiredRes = await reopenCitizenComplaint('cmp_reopen_1', 'citizen_owner_1', 'Water still leaking badly', {
      clock: () => expiredClock,
      prismaClient: client,
      sendEmail: async () => ({ ok: true, status: 'SENT', recipientHash: 'h_reopen' }),
    });
    console.log('[8c Expired Reopen]: Status=' + expiredRes.status + ' ok=' + expiredRes.ok);
    expect(expiredRes.ok).toBe(false);
    expect(expiredRes.status).toBe(400);

    // 3. Within window succeeds once
    const validRes = await reopenCitizenComplaint('cmp_reopen_1', 'citizen_owner_1', 'Water still leaking near meter valve', {
      clock: () => withinWindowClock,
      prismaClient: client,
      sendEmail: async () => ({ ok: true, status: 'SENT', recipientHash: 'h_reopen' }),
    });
    console.log('[8c Owner First Reopen]: Status=' + validRes.status + ' ok=' + validRes.ok + ' newStatus=' + validRes.complaint?.status);
    expect(validRes.ok).toBe(true);
    expect(validRes.status).toBe(200);
    expect(validRes.complaint?.status).toBe(ComplaintStatus.IN_PROGRESS);
    expect(validRes.complaint?.reopenCount).toBe(1);

    // 4. Second reopen returns 409 Conflict
    const secondReopenRes = await reopenCitizenComplaint('cmp_reopen_1', 'citizen_owner_1', 'Water leaking yet again', {
      clock: () => withinWindowClock,
      prismaClient: client,
      sendEmail: async () => ({ ok: true, status: 'SENT', recipientHash: 'h_reopen' }),
    });
    console.log('[8c Owner Second Reopen]: Status=' + secondReopenRes.status + ' ok=' + secondReopenRes.ok);
    expect(secondReopenRes.ok).toBe(false);
    expect(secondReopenRes.status).toBe(409);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 8d. Vote
  // ───────────────────────────────────────────────────────────────────────────
  test('8d. Vote: POST twice returns same state, voteCount equals ComplaintVote rows, own complaint returns 403, no auth returns 401', async () => {
    // 1. Unauthenticated request -> returns 401
    const unauthFetch = await fetch('http://localhost:3000/api/complaints/cmp_vote_1/vote', {
      method: 'POST',
    });
    console.log('[8d Unauthenticated Vote]: Status=' + unauthFetch.status);
    expect(unauthFetch.status).toBe(401);

    const { state, client } = createMockLoopStore({
      complaints: [
        {
          id: 'cmp_vote_1',
          ticketId: 'IC-8030',
          citizenId: 'citizen_owner_1',
          status: ComplaintStatus.IN_PROGRESS,
          voteCount: 0,
        },
      ],
    });

    // 2. Owner voting on own complaint returns 403
    const ownVoteRes = await castComplaintVote('cmp_vote_1', 'citizen_owner_1', client);
    console.log('[8d Own Complaint Vote]: Status=' + ownVoteRes.status + ' ok=' + ownVoteRes.ok);
    expect(ownVoteRes.ok).toBe(false);
    expect(ownVoteRes.status).toBe(403);

    // 3. Citizen A votes once -> voted: true, voteCount: 1
    const v1 = await castComplaintVote('cmp_vote_1', 'citizen_supporter_a', client);
    console.log('[8d Supporter A Vote 1]: Status=' + v1.status + ' voted=' + v1.voted + ' voteCount=' + v1.voteCount);
    expect(v1.ok).toBe(true);
    expect(v1.voted).toBe(true);
    expect(v1.voteCount).toBe(1);

    // 4. Citizen A votes twice (POST twice) -> returns the same state (idempotent)
    const v1Dup = await castComplaintVote('cmp_vote_1', 'citizen_supporter_a', client);
    console.log('[8d Supporter A Vote 2 (Duplicate)]: Status=' + v1Dup.status + ' voted=' + v1Dup.voted + ' voteCount=' + v1Dup.voteCount);
    expect(v1Dup.ok).toBe(true);
    expect(v1Dup.voted).toBe(true);
    expect(v1Dup.voteCount).toBe(1);

    // 5. Citizen B votes -> voteCount: 2
    const v2 = await castComplaintVote('cmp_vote_1', 'citizen_supporter_b', client);
    console.log('[8d Supporter B Vote]: Status=' + v2.status + ' voted=' + v2.voted + ' voteCount=' + v2.voteCount);
    expect(v2.ok).toBe(true);
    expect(v2.voteCount).toBe(2);

    // Verify voteCount strictly equals the number of ComplaintVote rows
    const dbRowCount = state.votes.filter((v) => v.complaintId === 'cmp_vote_1').length;
    console.log('[8d Row Count Match]: complaint.voteCount=' + v2.voteCount + ' vs ComplaintVote.rows=' + dbRowCount);
    expect(v2.voteCount).toBe(dbRowCount);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 8e. Email
  // ───────────────────────────────────────────────────────────────────────────
  test('8e. Email: with RESEND_API_KEY unset logs non-PII warning and skips, failed send creates EmailDelivery FAILED with recipient hash', async () => {
    // 1. Missing RESEND_API_KEY logs non-PII warning, does not throw, and skips delivery
    const warnings: string[] = [];
    const origWarn = console.warn;
    console.warn = (...args: any[]) => {
      warnings.push(args.map((a) => String(a)).join(' '));
    };

    const recipient = 'citizen.sensitive.email@smartcity.gov.in';
    const mockDbMissingKey = {
      emailDelivery: {
        create: async () => {
          throw new Error('Should not create delivery record when skipped');
        },
      },
    };

    try {
      const skipResult = await sendTemplatedEmail(
        'complaintStatusChanged',
        recipient,
        {
          ticketId: 'IC-8040',
          title: 'Damaged Drainage Cover',
          newStatus: 'IN_PROGRESS',
          complaintUrl: '/citizen/complaints/8040',
        },
        {
          env: { RESEND_API_KEY: '', EMAIL_HMAC_SECRET: 'test-hmac-secret-2026' },
          prismaClient: mockDbMissingKey as any,
        },
      );

      console.log('[8e Unset RESEND_API_KEY Result]: ok=' + skipResult.ok + ' status=' + skipResult.status + ' skipped=' + skipResult.skipped);
      expect(skipResult.ok).toBe(false);
      expect(skipResult.status).toBe('SKIPPED');
      expect(skipResult.skipped).toBe(true);

      // Verify non-PII warning logged
      const hasKeyWarning = warnings.some((w) => w.includes('RESEND_API_KEY'));
      expect(hasKeyWarning).toBe(true);
      for (const w of warnings) {
        expect(w).not.toContain(recipient); // Non-PII guarantee
      }
    } finally {
      console.warn = origWarn;
    }

    // 2. Failed send creates EmailDelivery row with status FAILED and a recipient hash, never raw email
    const deliveryRows: any[] = [];
    const mockDbFailedSend = {
      emailDelivery: {
        create: async ({ data }: { data: any }) => {
          deliveryRows.push(data);
          return { id: 'ed_failed_1', ...data };
        },
      },
    };

    const mockFailedFetch: typeof fetch = async () =>
      new Response(JSON.stringify({ error: 'Gateway timeout from email provider' }), {
        status: 504,
        statusText: 'Gateway Timeout',
      });

    const failedResult = await sendTemplatedEmail(
      'complaintResolved',
      recipient,
      {
        ticketId: 'IC-8041',
        title: 'Street Lamp Restored',
        feedbackUrl: '/citizen/complaints/8041#feedback',
      },
      {
        env: {
          RESEND_API_KEY: 'mock_resend_api_key',
          EMAIL_HMAC_SECRET: 'test-hmac-secret-2026',
        },
        fetchImpl: mockFailedFetch,
        prismaClient: mockDbFailedSend as any,
      },
    );

    console.log('[8e Failed Email Delivery]: ok=' + failedResult.ok + ' status=' + failedResult.status + ' recipientHash=' + deliveryRows[0]?.recipientHash);
    expect(failedResult.ok).toBe(false);
    expect(failedResult.status).toBe('FAILED');
    expect(deliveryRows).toHaveLength(1);
    expect(deliveryRows[0].status).toBe('FAILED');
    expect(deliveryRows[0].recipientHash).toMatch(/^[a-f0-9]{64}$/);
    expect(deliveryRows[0].recipientHash).not.toContain(recipient);
    expect(deliveryRows[0].lastError).not.toContain(recipient);
  });
});
