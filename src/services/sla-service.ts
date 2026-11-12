import crypto from 'crypto';
import { ComplaintStatus, NotificationType, PriorityLevel } from '@prisma/client';
import prisma from '@/lib/prisma';
import {
  buildAppUrl,
  sendTemplatedEmail,
  type EmailTemplateDataMap,
  type EmailTemplateName,
  type SendEmailResult,
} from '@/services/email-service';

export const DEFAULT_SLA_HOURS: Record<PriorityLevel, number> = {
  CRITICAL: 24,
  HIGH: 72,
  MEDIUM: 168,
  LOW: 336,
};

export const ACTIVE_SLA_STATUSES: ComplaintStatus[] = [
  ComplaintStatus.SUBMITTED,
  ComplaintStatus.AI_PROCESSING,
  ComplaintStatus.PENDING_DEPT_REVIEW,
  ComplaintStatus.ASSIGNED,
  ComplaintStatus.IN_PROGRESS,
];

export const TERMINAL_SLA_STATUSES = new Set<string>([
  ComplaintStatus.RESOLVED,
  ComplaintStatus.CLOSED,
  ComplaintStatus.REJECTED,
  ComplaintStatus.DUPLICATE,
]);

export interface SlaRuleInput {
  priority?: PriorityLevel | string;
  resolutionHours: number;
  isActive?: boolean;
}

export interface SlaComplaintInput {
  createdAt: Date | string;
  status: ComplaintStatus | string;
  priority?: PriorityLevel | string | null;
  escalatedAt?: Date | string | null;
  resolvedAt?: Date | string | null;
  closedAt?: Date | string | null;
  slaRule?: SlaRuleInput | null;
  slaResolutionHours?: number | null;
}

function toValidDate(value: Date | string, label: string): Date {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid ${label} date`);
  }
  return date;
}

function resolveHours(ruleOrHours: SlaRuleInput | number): number {
  const hours = typeof ruleOrHours === 'number' ? ruleOrHours : ruleOrHours?.resolutionHours;
  if (typeof hours !== 'number' || !Number.isFinite(hours) || hours <= 0) {
    throw new Error('SLA rule resolutionHours must be a positive finite number');
  }
  return hours;
}

/**
 * Computes the UTC SLA deadline by adding rule.resolutionHours to createdAt.
 * Pure function with no hidden clock reads.
 */
export function computeSlaDeadline(
  createdAt: Date | string,
  rule: SlaRuleInput | number,
): Date {
  const start = toValidDate(createdAt, 'createdAt');
  const hours = resolveHours(rule);
  return new Date(start.getTime() + hours * 60 * 60 * 1000);
}

/**
 * Resolves the effective SLA rule for a complaint from an explicit rule or default priority table.
 */
export function resolveComplaintSlaRule(
  complaint: Pick<SlaComplaintInput, 'priority' | 'slaRule' | 'slaResolutionHours'>,
  explicitRule?: SlaRuleInput | null,
): SlaRuleInput | null {
  if (explicitRule !== undefined) {
    return explicitRule;
  }
  if (complaint.slaRule !== undefined) {
    return complaint.slaRule;
  }
  if (typeof complaint.slaResolutionHours === 'number' && Number.isFinite(complaint.slaResolutionHours)) {
    return { resolutionHours: complaint.slaResolutionHours, isActive: true };
  }
  const priorityKey = (complaint.priority || PriorityLevel.MEDIUM) as PriorityLevel;
  const fallbackHours = DEFAULT_SLA_HOURS[priorityKey] ?? DEFAULT_SLA_HOURS.MEDIUM;
  return { priority: priorityKey, resolutionHours: fallbackHours, isActive: true };
}

export function verifyCronSecret(
  provided: string | null | undefined,
  expected: string | null | undefined,
): boolean {
  if (!provided || !expected) return false;
  const providedTrimmed = provided.trim();
  const expectedTrimmed = expected.trim();
  if (!providedTrimmed || !expectedTrimmed) return false;

  const providedDigest = crypto.createHash('sha256').update(providedTrimmed).digest();
  const expectedDigest = crypto.createHash('sha256').update(expectedTrimmed).digest();
  return crypto.timingSafeEqual(providedDigest, expectedDigest);
}

/**
 * Pure check returning true if an active complaint has crossed its SLA deadline at `now`.
 */
export function isBreached(
  complaint: SlaComplaintInput,
  now: Date,
  rule?: SlaRuleInput | null,
): boolean {
  const effectiveNow = toValidDate(now, 'now');

  if (TERMINAL_SLA_STATUSES.has(String(complaint.status))) {
    return false;
  }

  const effectiveRule = resolveComplaintSlaRule(complaint, rule);
  if (!effectiveRule || effectiveRule.isActive === false) {
    return false;
  }

  const deadline = computeSlaDeadline(complaint.createdAt, effectiveRule);
  return effectiveNow.getTime() > deadline.getTime();
}

export interface EscalationRecipient {
  id: string;
  role: string | null;
  email: string | null;
  name: string;
}

export interface SlaEscalationRunResult {
  checked: number;
  escalated: number;
  skipped: number;
  failedEmailCount: number;
  escalatedTicketIds: string[];
  ranAt: string;
}

export interface RunSlaEscalationOptions {
  clock?: () => Date;
  prismaClient?: typeof prisma;
  sendEmail?: <T extends EmailTemplateName>(
    template: T,
    toEmail: string,
    data: EmailTemplateDataMap[T],
  ) => Promise<SendEmailResult>;
}

/**
 * Idempotently scans active complaints, marks newly breached ones as escalated inside a transaction,
 * writes StatusHistory + Notification records, and dispatches email alerts after commit.
 */
export async function runSlaEscalationJob(
  options: RunSlaEscalationOptions = {},
): Promise<SlaEscalationRunResult> {
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

  const [rules, candidates] = await Promise.all([
    db.slaRule.findMany(),
    db.complaint.findMany({
      where: {
        escalatedAt: null,
        status: { in: ACTIVE_SLA_STATUSES },
      },
      include: {
        department: { select: { id: true, name: true } },
      },
    }),
  ]);

  const rulesByPriority = new Map<string, SlaRuleInput>();
  for (const r of rules) {
    rulesByPriority.set(r.priority, {
      priority: r.priority,
      resolutionHours: r.resolutionHours,
      isActive: r.isActive,
    });
  }

  let escalated = 0;
  let skipped = 0;
  let failedEmailCount = 0;
  const escalatedTicketIds: string[] = [];

  for (const complaint of candidates) {
    const priorityKey = (complaint.priority || PriorityLevel.MEDIUM) as PriorityLevel;
    const configuredRule = rulesByPriority.has(priorityKey)
      ? rulesByPriority.get(priorityKey)!
      : {
          priority: priorityKey,
          resolutionHours: DEFAULT_SLA_HOURS[priorityKey] ?? DEFAULT_SLA_HOURS.MEDIUM,
          isActive: true,
        };

    if (!isBreached(complaint, now, configuredRule)) {
      skipped++;
      continue;
    }

    const deadlineIso = computeSlaDeadline(complaint.createdAt, configuredRule).toISOString();

    const txOutcome = await db.$transaction(async (tx) => {
      // Atomic idempotency guard: only claim if still unescalated and still active
      const claim = await tx.complaint.updateMany({
        where: {
          id: complaint.id,
          escalatedAt: null,
          status: { in: ACTIVE_SLA_STATUSES },
        },
        data: {
          escalatedAt: now,
        },
      });

      if (claim.count === 0) {
        return { claimed: false as const, recipients: [] as EscalationRecipient[] };
      }

      await tx.statusHistory.create({
        data: {
          complaintId: complaint.id,
          fromStatus: complaint.status,
          toStatus: complaint.status,
          changedByUserId: null,
          notes: `SLA breached (${configuredRule.resolutionHours}h target for ${priorityKey} priority). Escalated to Department Head / Admin.`,
        },
      });

      let recipients: EscalationRecipient[] = [];
      if (complaint.departmentId) {
        recipients = await tx.user.findMany({
          where: {
            role: 'DEPARTMENT_HEAD',
            departmentId: complaint.departmentId,
            isAuthorized: true,
            isSuspended: false,
            deletedAt: null,
          },
          select: { id: true, role: true, email: true, name: true },
        });
      }

      if (recipients.length === 0) {
        recipients = await tx.user.findMany({
          where: {
            role: { in: ['ADMIN', 'SUPER_ADMIN'] },
            isAuthorized: true,
            isSuspended: false,
            deletedAt: null,
          },
          select: { id: true, role: true, email: true, name: true },
        });
      }

      for (const recipient of recipients) {
        await tx.notification.create({
          data: {
            complaintId: complaint.id,
            recipientUserId: recipient.id,
            type: NotificationType.SLA_ESCALATED,
            message: `SLA Escalation: Complaint #${complaint.ticketId} (${priorityKey}) exceeded its ${configuredRule.resolutionHours}h SLA deadline.`,
          },
        });
      }

      return { claimed: true as const, recipients };
    });

    if (!txOutcome.claimed) {
      skipped++;
      continue;
    }

    escalated++;
    escalatedTicketIds.push(complaint.ticketId);

    // Send email notifications strictly after DB transaction commits
    for (const recipient of txOutcome.recipients) {
      if (!recipient.email) continue;
      const routePrefix = recipient.role === 'DEPARTMENT_HEAD' ? '/dept-head' : '/admin';
      const emailRes = await emailSender('slaEscalated', recipient.email, {
        ticketId: complaint.ticketId,
        title: complaint.title,
        priority: priorityKey,
        departmentName: complaint.department?.name ?? null,
        deadlineIso,
        complaintUrl: buildAppUrl(`${routePrefix}/complaints/${complaint.id}`),
      });
      if (!emailRes.ok && !emailRes.skipped) {
        failedEmailCount++;
      }
    }
  }

  return {
    checked: candidates.length,
    escalated,
    skipped,
    failedEmailCount,
    escalatedTicketIds,
    ranAt: now.toISOString(),
  };
}

export const SLA_ESCALATION_ALLOWED_ROLES = [
  'SUPER_ADMIN',
  'ADMIN',
  'DEPARTMENT_HEAD',
] as const;

export const DEFAULT_SLA_ESCALATION_PAGE_SIZE = 20;
export const MAX_SLA_ESCALATION_PAGE_SIZE = 50;

export interface SlaEscalationActor {
  role: string;
  departmentId?: string | null;
}

export interface SlaEscalationListQuery {
  page?: number;
  limit?: number;
}

export interface SlaEscalationListItem {
  id: string;
  ticketId: string;
  title: string;
  status: ComplaintStatus;
  priority: PriorityLevel | null;
  department: { id: string; name: string } | null;
  escalatedAt: Date | null;
}

export interface SlaEscalationListResult {
  items: SlaEscalationListItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface SlaEscalationDbClient {
  complaint: {
    findMany: (args: {
      where: Record<string, unknown>;
      select: Record<string, unknown>;
      orderBy: { escalatedAt: 'desc' };
      skip: number;
      take: number;
    }) => Promise<SlaEscalationListItem[]>;
    count: (args: { where: Record<string, unknown> }) => Promise<number>;
  };
}

export function normalizeSlaEscalationPagination(query?: SlaEscalationListQuery): {
  page: number;
  limit: number;
  skip: number;
} {
  const rawPage =
    typeof query?.page === 'number' && Number.isFinite(query.page) ? Math.trunc(query.page) : 1;
  const page = Math.max(1, rawPage);

  const rawLimit =
    typeof query?.limit === 'number' && Number.isFinite(query.limit)
      ? Math.trunc(query.limit)
      : DEFAULT_SLA_ESCALATION_PAGE_SIZE;
  const limit = Math.min(MAX_SLA_ESCALATION_PAGE_SIZE, Math.max(1, rawLimit));

  return {
    page,
    limit,
    skip: (page - 1) * limit,
  };
}

/**
 * Lists SLA-escalated complaints scoped cleanly by role without exposing any citizen PII.
 * DEPARTMENT_HEAD actors only see escalations assigned to their own departmentId.
 */
export async function listEscalatedComplaints(
  actor: SlaEscalationActor,
  query?: SlaEscalationListQuery,
  db: SlaEscalationDbClient = prisma as unknown as SlaEscalationDbClient,
): Promise<SlaEscalationListResult> {
  if (
    !SLA_ESCALATION_ALLOWED_ROLES.includes(
      actor.role as (typeof SLA_ESCALATION_ALLOWED_ROLES)[number],
    )
  ) {
    throw new Error('Forbidden: insufficient permissions to view SLA escalations');
  }

  const { page, limit, skip } = normalizeSlaEscalationPagination(query);

  if (actor.role === 'DEPARTMENT_HEAD' && !actor.departmentId) {
    return {
      items: [],
      pagination: {
        page,
        limit,
        total: 0,
        totalPages: 0,
      },
    };
  }

  const where: Record<string, unknown> = {
    escalatedAt: { not: null },
  };
  if (actor.role === 'DEPARTMENT_HEAD') {
    where.departmentId = actor.departmentId;
  }

  const select = {
    id: true,
    ticketId: true,
    title: true,
    status: true,
    priority: true,
    escalatedAt: true,
    department: {
      select: {
        id: true,
        name: true,
      },
    },
  } as const;

  const [rows, total] = await Promise.all([
    db.complaint.findMany({
      where,
      select,
      orderBy: { escalatedAt: 'desc' },
      skip,
      take: limit,
    }),
    db.complaint.count({ where }),
  ]);

  const items: SlaEscalationListItem[] = rows.map((row) => ({
    id: row.id,
    ticketId: row.ticketId,
    title: row.title,
    status: row.status,
    priority: row.priority,
    department: row.department ? { id: row.department.id, name: row.department.name } : null,
    escalatedAt: row.escalatedAt,
  }));

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / limit),
    },
  };
}
