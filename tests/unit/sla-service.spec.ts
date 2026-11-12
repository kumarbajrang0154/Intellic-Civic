import { test, expect } from '@playwright/test';
import { NextRequest } from 'next/server';
import { ComplaintStatus, NotificationType, PriorityLevel } from '@prisma/client';
import {
  computeSlaDeadline,
  isBreached,
  listEscalatedComplaints,
  MAX_SLA_ESCALATION_PAGE_SIZE,
  normalizeSlaEscalationPagination,
  runSlaEscalationJob,
  verifyCronSecret,
  type SlaEscalationDbClient,
} from '@/services/sla-service';
import {
  GET as cronGetHandler,
  POST as cronPostHandler,
} from '@/app/api/cron/sla-escalation/route';

function createMockSlaPrisma(initialComplaints: any[], initialUsers: any[], initialRules: any[] = []) {
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

test.describe('SLA Service — Pure Computation & Auto-Escalation Idempotency', () => {
  test('computeSlaDeadline computes deterministic UTC deadline with fixed createdAt', () => {
    const createdAt = new Date('2026-10-01T08:00:00.000Z');
    const deadline24h = computeSlaDeadline(createdAt, { resolutionHours: 24, isActive: true });
    expect(deadline24h.toISOString()).toBe('2026-10-02T08:00:00.000Z');

    const deadline72h = computeSlaDeadline('2026-10-01T08:00:00.000Z', 72);
    expect(deadline72h.toISOString()).toBe('2026-10-04T08:00:00.000Z');
  });

  test('isBreached respects fixed clock, boundaries, active rules, and terminal statuses', () => {
    const createdAt = new Date('2026-10-01T00:00:00.000Z');
    const rule = { priority: PriorityLevel.CRITICAL, resolutionHours: 24, isActive: true };

    expect(
      isBreached({ createdAt, status: ComplaintStatus.IN_PROGRESS, priority: PriorityLevel.CRITICAL }, new Date('2026-10-01T23:59:59.000Z'), rule),
    ).toBe(false);

    // Exact deadline millisecond is not yet breached (> strict)
    expect(
      isBreached({ createdAt, status: ComplaintStatus.IN_PROGRESS, priority: PriorityLevel.CRITICAL }, new Date('2026-10-02T00:00:00.000Z'), rule),
    ).toBe(false);

    // 1 ms past deadline is breached
    expect(
      isBreached({ createdAt, status: ComplaintStatus.IN_PROGRESS, priority: PriorityLevel.CRITICAL }, new Date('2026-10-02T00:00:00.001Z'), rule),
    ).toBe(true);

    // Inactive rule never breaches
    expect(
      isBreached(
        { createdAt, status: ComplaintStatus.ASSIGNED, priority: PriorityLevel.CRITICAL },
        new Date('2026-10-10T00:00:00.000Z'),
        { priority: PriorityLevel.CRITICAL, resolutionHours: 24, isActive: false },
      ),
    ).toBe(false);

    // Terminal statuses never breach
    for (const status of [
      ComplaintStatus.RESOLVED,
      ComplaintStatus.CLOSED,
      ComplaintStatus.REJECTED,
      ComplaintStatus.DUPLICATE,
    ]) {
      expect(
        isBreached({ createdAt, status, priority: PriorityLevel.CRITICAL }, new Date('2026-10-10T00:00:00.000Z'), rule),
      ).toBe(false);
    }
  });

  test('runSlaEscalationJob escalates each breached complaint at most once across repeated runs', async () => {
    const fixedNow = new Date('2026-10-03T12:00:00.000Z');
    const { state, client } = createMockSlaPrisma(
      [
        {
          id: 'cmp_breached',
          ticketId: 'IC-1001',
          title: 'Broken Water Main on Maple St',
          status: ComplaintStatus.IN_PROGRESS,
          priority: PriorityLevel.CRITICAL,
          departmentId: 'dept_water',
          department: { id: 'dept_water', name: 'Water Supply' },
          createdAt: new Date('2026-10-01T08:00:00.000Z'),
          escalatedAt: null,
        },
        {
          id: 'cmp_within_sla',
          ticketId: 'IC-1002',
          title: 'Streetlight Flickering',
          status: ComplaintStatus.ASSIGNED,
          priority: PriorityLevel.HIGH,
          departmentId: 'dept_water',
          department: { id: 'dept_water', name: 'Water Supply' },
          createdAt: new Date('2026-10-02T00:00:00.000Z'), // HIGH = 72h -> deadline Oct 5
          escalatedAt: null,
        },
      ],
      [
        {
          id: 'head_1',
          name: 'Dept Head',
          email: 'head@civic.gov.in',
          role: 'DEPARTMENT_HEAD',
          departmentId: 'dept_water',
          isAuthorized: true,
          isSuspended: false,
          deletedAt: null,
        },
        {
          id: 'admin_1',
          name: 'City Admin',
          email: 'admin@civic.gov.in',
          role: 'ADMIN',
          departmentId: null,
          isAuthorized: true,
          isSuspended: false,
          deletedAt: null,
        },
      ],
      [{ priority: PriorityLevel.CRITICAL, resolutionHours: 24, isActive: true }],
    );

    const sentEmails: Array<{ template: string; to: string; ticketId: string }> = [];
    const mockSendEmail = async (template: any, to: string, data: any) => {
      sentEmails.push({ template, to, ticketId: data.ticketId });
      return { ok: true, status: 'SENT' as const, recipientHash: 'hash_1' };
    };

    const run1 = await runSlaEscalationJob({
      clock: () => fixedNow,
      prismaClient: client,
      sendEmail: mockSendEmail,
    });

    expect(run1.checked).toBe(2);
    expect(run1.escalated).toBe(1);
    expect(run1.skipped).toBe(1);
    expect(run1.escalatedTicketIds).toEqual(['IC-1001']);
    expect(state.complaints[0].escalatedAt).toEqual(fixedNow);
    expect(state.statusHistory).toHaveLength(1);
    expect(state.notifications).toHaveLength(1);
    expect(state.notifications[0].type).toBe(NotificationType.SLA_ESCALATED);
    expect(state.notifications[0].recipientUserId).toBe('head_1');
    expect(sentEmails).toEqual([{ template: 'slaEscalated', to: 'head@civic.gov.in', ticketId: 'IC-1001' }]);

    // Second run with the same fixed clock: idempotent (must not escalate again)
    const run2 = await runSlaEscalationJob({
      clock: () => fixedNow,
      prismaClient: client,
      sendEmail: mockSendEmail,
    });

    expect(run2.checked).toBe(1); // cmp_within_sla only; cmp_breached already has escalatedAt != null
    expect(run2.escalated).toBe(0);
    expect(run2.escalatedTicketIds).toEqual([]);
    expect(state.statusHistory).toHaveLength(1);
    expect(state.notifications).toHaveLength(1);
    expect(sentEmails).toHaveLength(1);
  });

  test('runSlaEscalationJob falls back to active ADMIN users when department has no Department Head', async () => {
    const fixedNow = new Date('2026-10-03T12:00:00.000Z');
    const { state, client } = createMockSlaPrisma(
      [
        {
          id: 'cmp_no_head',
          ticketId: 'IC-1009',
          title: 'Overflowing Drain',
          status: ComplaintStatus.SUBMITTED,
          priority: PriorityLevel.CRITICAL,
          departmentId: 'dept_sanitation',
          department: { id: 'dept_sanitation', name: 'Sanitation' },
          createdAt: new Date('2026-10-01T00:00:00.000Z'),
          escalatedAt: null,
        },
      ],
      [
        {
          id: 'admin_fallback',
          name: 'City Admin',
          email: 'admin@civic.gov.in',
          role: 'ADMIN',
          departmentId: null,
          isAuthorized: true,
          isSuspended: false,
          deletedAt: null,
        },
      ],
    );

    const sentTo: string[] = [];
    const res = await runSlaEscalationJob({
      clock: () => fixedNow,
      prismaClient: client,
      sendEmail: async (_template, to) => {
        sentTo.push(to);
        return { ok: true, status: 'SENT', recipientHash: 'h_admin' };
      },
    });

    expect(res.escalated).toBe(1);
    expect(state.notifications).toHaveLength(1);
    expect(state.notifications[0].recipientUserId).toBe('admin_fallback');
    expect(sentTo).toEqual(['admin@civic.gov.in']);
  });

  test('verifyCronSecret and cron route reject missing or invalid secrets with 401', async () => {
    expect(verifyCronSecret('top-secret-123', 'top-secret-123')).toBe(true);
    expect(verifyCronSecret('wrong-secret', 'top-secret-123')).toBe(false);
    expect(verifyCronSecret(null, 'top-secret-123')).toBe(false);
    expect(verifyCronSecret('anything', undefined)).toBe(false);

    const prevCronSecret = process.env.CRON_SECRET;
    process.env.CRON_SECRET = 'unit-test-cron-secret-value';
    try {
      const noHeaderReq = new NextRequest('http://localhost/api/cron/sla-escalation', { method: 'GET' });
      const resNoAuth = await cronGetHandler(noHeaderReq);
      expect(resNoAuth.status).toBe(401);

      const wrongSecretReq = new NextRequest('http://localhost/api/cron/sla-escalation', {
        method: 'POST',
        headers: { authorization: 'Bearer wrong-token' },
      });
      const resWrong = await cronPostHandler(wrongSecretReq);
      expect(resWrong.status).toBe(401);
    } finally {
      if (prevCronSecret === undefined) delete process.env.CRON_SECRET;
      else process.env.CRON_SECRET = prevCronSecret;
    }
  });
});

test.describe('listEscalatedComplaints role scoping, pagination cap, and PII safety', () => {
  const sampleRows = [
    {
      id: 'c-1',
      ticketId: 'IC-2026-101',
      title: 'Substation feeder trip',
      status: ComplaintStatus.IN_PROGRESS,
      priority: PriorityLevel.CRITICAL,
      departmentId: 'dept-power',
      department: { id: 'dept-power', name: 'Power Supply' },
      escalatedAt: new Date('2026-11-10T10:00:00.000Z'),
      // Extra PII fields to verify strict projection/stripping
      citizenId: 'cit-1',
      citizenName: 'Sensitive Citizen',
      citizenMobile: '9999999999',
      email: 'citizen@example.com',
      location: '123 Private Street',
    },
    {
      id: 'c-2',
      ticketId: 'IC-2026-102',
      title: 'Water main rupture',
      status: ComplaintStatus.ASSIGNED,
      priority: PriorityLevel.HIGH,
      departmentId: 'dept-water',
      department: { id: 'dept-water', name: 'Water Supply' },
      escalatedAt: new Date('2026-11-09T09:00:00.000Z'),
      citizenId: 'cit-2',
      citizenMobile: '8888888888',
    },
    {
      id: 'c-3',
      ticketId: 'IC-2026-103',
      title: 'Non-escalated draft',
      status: ComplaintStatus.SUBMITTED,
      priority: PriorityLevel.LOW,
      departmentId: 'dept-power',
      department: { id: 'dept-power', name: 'Power Supply' },
      escalatedAt: null,
    },
  ];

  function createEscalationListMockDb() {
    const capturedCalls: Array<{
      where: Record<string, unknown>;
      select: Record<string, unknown>;
      skip: number;
      take: number;
    }> = [];

    const db: SlaEscalationDbClient = {
      complaint: {
        findMany: async (args) => {
          capturedCalls.push({
            where: args.where,
            select: args.select,
            skip: args.skip,
            take: args.take,
          });
          const filtered = sampleRows.filter((row) => {
            if (args.where.escalatedAt && row.escalatedAt === null) return false;
            if (
              typeof args.where.departmentId === 'string' &&
              row.departmentId !== args.where.departmentId
            ) {
              return false;
            }
            return true;
          });
          return filtered.slice(args.skip, args.skip + args.take) as any;
        },
        count: async (args) =>
          sampleRows.filter((row) => {
            if (args.where.escalatedAt && row.escalatedAt === null) return false;
            if (
              typeof args.where.departmentId === 'string' &&
              row.departmentId !== args.where.departmentId
            ) {
              return false;
            }
            return true;
          }).length,
      },
    };

    return { db, capturedCalls };
  }

  test('ADMIN and SUPER_ADMIN see escalated complaints across all departments', async () => {
    for (const role of ['ADMIN', 'SUPER_ADMIN'] as const) {
      const { db, capturedCalls } = createEscalationListMockDb();
      const result = await listEscalatedComplaints({ role }, {}, db);

      expect(result.items.map((item) => item.ticketId)).toEqual(['IC-2026-101', 'IC-2026-102']);
      expect(result.pagination.total).toBe(2);
      expect(capturedCalls).toHaveLength(1);
      expect(capturedCalls[0].where).toEqual({ escalatedAt: { not: null } });
    }
  });

  test('DEPARTMENT_HEAD is scoped strictly to own departmentId and fails closed if missing', async () => {
    const { db, capturedCalls } = createEscalationListMockDb();
    const scoped = await listEscalatedComplaints(
      { role: 'DEPARTMENT_HEAD', departmentId: 'dept-power' },
      {},
      db,
    );

    expect(scoped.items.map((item) => item.ticketId)).toEqual(['IC-2026-101']);
    expect(scoped.pagination.total).toBe(1);
    expect(capturedCalls[0].where).toEqual({
      escalatedAt: { not: null },
      departmentId: 'dept-power',
    });

    const unassigned = await listEscalatedComplaints(
      { role: 'DEPARTMENT_HEAD', departmentId: null },
      {},
      db,
    );
    expect(unassigned.items).toEqual([]);
    expect(unassigned.pagination.total).toBe(0);
    // Unassigned dept head must fail closed without issuing an unfiltered query
    expect(capturedCalls).toHaveLength(1);
  });

  test('disallowed roles are rejected', async () => {
    const { db } = createEscalationListMockDb();
    for (const role of ['DEPARTMENT_OFFICER', 'FIELD_WORKER', 'CITIZEN']) {
      await expect(listEscalatedComplaints({ role }, {}, db)).rejects.toThrow(/Forbidden/);
    }
  });

  test('pagination limit is capped at 50 and non-positive values clamp safely', async () => {
    expect(MAX_SLA_ESCALATION_PAGE_SIZE).toBe(50);
    expect(normalizeSlaEscalationPagination({ page: 2, limit: 250 })).toEqual({
      page: 2,
      limit: 50,
      skip: 50,
    });
    expect(normalizeSlaEscalationPagination({ page: -3, limit: 0 })).toEqual({
      page: 1,
      limit: 1,
      skip: 0,
    });

    const { db, capturedCalls } = createEscalationListMockDb();
    const result = await listEscalatedComplaints(
      { role: 'SUPER_ADMIN' },
      { page: 2, limit: 200 },
      db,
    );

    expect(capturedCalls[0].take).toBe(50);
    expect(capturedCalls[0].skip).toBe(50);
    expect(result.pagination.limit).toBe(50);
    expect(result.pagination.page).toBe(2);
  });

  test('selects operational SLA fields only and strips all citizen PII', async () => {
    const { db, capturedCalls } = createEscalationListMockDb();
    const result = await listEscalatedComplaints({ role: 'ADMIN' }, {}, db);

    const select = capturedCalls[0].select;
    expect(select.ticketId).toBe(true);
    expect(select.title).toBe(true);
    expect(select.priority).toBe(true);
    expect(select.escalatedAt).toBe(true);
    expect(select.department).toEqual({ select: { id: true, name: true } });
    for (const piiField of [
      'citizen',
      'citizenId',
      'citizenName',
      'citizenMobile',
      'email',
      'location',
      'description',
    ]) {
      expect(select[piiField]).toBeUndefined();
    }

    expect(result.items).toHaveLength(2);
    for (const item of result.items) {
      expect(Object.keys(item).sort()).toEqual([
        'department',
        'escalatedAt',
        'id',
        'priority',
        'status',
        'ticketId',
        'title',
      ]);
    }
  });
});
