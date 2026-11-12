import { z } from 'zod';
import prisma from '@/lib/prisma';
import { resolveReportDateRange } from '@/services/department-report-service';

export const MATERIAL_ALLOWED_UNITS = [
  'nos',
  'kg',
  'm',
  'm2',
  'm3',
  'bag',
  'ltr',
  'set',
] as const;

export type MaterialAllowedUnit = (typeof MATERIAL_ALLOWED_UNITS)[number];

export const MAX_MATERIAL_COST_RANGE_DAYS = 366;

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface MaterialCostActor {
  id: string;
  role: string;
  departmentId: string | null;
}

export interface MaterialEntryInput {
  name: string;
  quantity: number;
  unit: MaterialAllowedUnit;
  unitCostPaise: number;
}

export interface ComplaintMaterialEntryView {
  id: string;
  complaintId: string;
  name: string;
  quantity: number;
  unit: string;
  unitCostPaise: number;
  lineTotalPaise: number;
  recordedByUserId: string;
  recordedByName: string;
  createdAt: string;
}

export interface ComplaintCostSummary {
  totalPaise: number;
  count: number;
}

export interface DepartmentMaterialCostRow {
  departmentId: string | null;
  departmentCode: string;
  departmentName: string;
  totalPaise: number;
  entryCount: number;
  complaintCount: number;
}

export interface DepartmentMaterialCostReport {
  range: {
    from: string;
    to: string;
  };
  totalPaise: number;
  entryCount: number;
  departments: DepartmentMaterialCostRow[];
}

export interface MaterialEntryRecordLike {
  id?: string;
  complaintId?: string;
  name?: string;
  quantity: number | string | { toString(): string };
  unit?: string;
  unitCostPaise: number;
  recordedByUserId?: string;
  createdAt?: Date;
  recordedByUser?: {
    id?: string;
    name?: string | null;
  } | null;
}

export interface DepartmentSummaryRecordLike {
  complaintId: string;
  quantity: number | string | { toString(): string };
  unitCostPaise: number;
  complaint: {
    departmentId: string | null;
    department: {
      id: string;
      code: string;
      name: string;
    } | null;
  };
}

export interface MaterialCostDbClient {
  complaint: {
    findUnique(args: {
      where: { id: string };
      select: {
        id: true;
        ticketNumber: true;
        title: true;
        departmentId: true;
        assignment: {
          select: {
            departmentOfficerId: true;
          };
        };
      };
    }): Promise<{
      id: string;
      ticketNumber: string;
      title: string;
      departmentId: string | null;
      assignment: {
        departmentOfficerId: string | null;
      } | null;
    } | null>;
  };
  complaintMaterialEntry: {
    findMany(args: {
      where: Record<string, unknown>;
      orderBy?: Record<string, 'asc' | 'desc'>;
      select?: Record<string, unknown>;
    }): Promise<unknown[]>;
    create(args: {
      data: {
        complaintId: string;
        name: string;
        quantity: number;
        unit: string;
        unitCostPaise: number;
        recordedByUserId: string;
      };
      select: Record<string, unknown>;
    }): Promise<unknown>;
  };
}

export type MaterialServiceErrorCode =
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION_ERROR';

export class MaterialServiceError extends Error {
  readonly code: MaterialServiceErrorCode;
  readonly status: number;

  constructor(code: MaterialServiceErrorCode, message: string) {
    super(message);
    this.name = 'MaterialServiceError';
    this.code = code;
    this.status = code === 'FORBIDDEN' ? 403 : code === 'NOT_FOUND' ? 404 : 400;
  }
}

export const materialEntryInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Material name must be at least 2 characters')
    .max(120, 'Material name must not exceed 120 characters'),
  quantity: z
    .number({ message: 'Quantity must be a number' })
    .finite('Quantity must be finite')
    .gt(0, 'Quantity must be greater than 0')
    .max(100000, 'Quantity must not exceed 100000'),
  unit: z.enum(MATERIAL_ALLOWED_UNITS, {
    message: `Unit must be one of: ${MATERIAL_ALLOWED_UNITS.join(', ')}`,
  }),
  unitCostPaise: z
    .number({ message: 'Unit cost must be an integer' })
    .int('Unit cost must be a whole integer in paise')
    .min(0, 'Unit cost cannot be negative')
    .max(10000000, 'Unit cost must not exceed 10000000 paise'),
});

export const materialCostReportQuerySchema = z
  .object({
    from: z.string().regex(ISO_DATE_RE, 'Invalid from date; expected YYYY-MM-DD').optional(),
    to: z.string().regex(ISO_DATE_RE, 'Invalid to date; expected YYYY-MM-DD').optional(),
  })
  .superRefine((value, ctx) => {
    let resolved: ReturnType<typeof resolveReportDateRange>;
    try {
      resolved = resolveReportDateRange(value.from, value.to);
    } catch (error) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['from'],
        message: error instanceof Error ? error.message : 'Invalid date range',
      });
      return;
    }

    const fromDayMs = Date.parse(`${resolved.fromIso}T00:00:00.000Z`);
    const toDayMs = Date.parse(`${resolved.toIso}T00:00:00.000Z`);
    const inclusiveDays = Math.floor((toDayMs - fromDayMs) / DAY_MS) + 1;
    if (inclusiveDays > MAX_MATERIAL_COST_RANGE_DAYS) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['to'],
        message: `Date range cannot exceed ${MAX_MATERIAL_COST_RANGE_DAYS} days`,
      });
    }
  });

function toFiniteNumber(value: number | string | { toString(): string }): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }
  const parsed = Number(value.toString());
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Computes integer line cost in paise, rounded to the nearest paise and clamped at zero.
 */
export function computeLineTotalPaise(
  quantity: number | string | { toString(): string },
  unitCostPaise: number,
): number {
  const numericQty = toFiniteNumber(quantity);
  if (!Number.isFinite(numericQty) || !Number.isFinite(unitCostPaise)) {
    return 0;
  }
  if (numericQty <= 0 || unitCostPaise <= 0) {
    return 0;
  }
  return Math.max(0, Math.round(numericQty * Math.trunc(unitCostPaise)));
}

/**
 * Summarizes total cost in paise and item count for a complaint's material entries.
 */
export function summarizeComplaintCost(
  entries: ReadonlyArray<Pick<MaterialEntryRecordLike, 'quantity' | 'unitCostPaise'>>,
): ComplaintCostSummary {
  let totalPaise = 0;
  for (const entry of entries) {
    totalPaise += computeLineTotalPaise(entry.quantity, entry.unitCostPaise);
  }
  return {
    totalPaise,
    count: entries.length,
  };
}

/**
 * Validates and normalizes an incoming material entry payload using Zod.
 */
export function validateMaterialEntry(input: unknown): {
  success: true;
  data: MaterialEntryInput;
} | {
  success: false;
  error: string;
} {
  const parsed = materialEntryInputSchema.safeParse(input);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return {
      success: false,
      error: firstIssue?.message ?? 'Invalid material entry payload',
    };
  }
  return {
    success: true,
    data: {
      name: parsed.data.name,
      quantity: Math.round(parsed.data.quantity * 100) / 100,
      unit: parsed.data.unit,
      unitCostPaise: parsed.data.unitCostPaise,
    },
  };
}

/**
 * Verifies whether a staff actor can view or record materials for a complaint.
 * Admins have full access, department heads are restricted to their department,
 * and department officers are restricted strictly to complaints assigned to them.
 */
export function checkComplaintMaterialAccess(
  actor: MaterialCostActor,
  complaint: {
    departmentId: string | null;
    assignment?: { departmentOfficerId: string | null } | null;
  },
): { allowed: true } | { allowed: false; reason: string } {
  if (actor.role === 'SUPER_ADMIN' || actor.role === 'ADMIN') {
    return { allowed: true };
  }

  if (actor.role === 'DEPARTMENT_HEAD') {
    if (!actor.departmentId || !complaint.departmentId || actor.departmentId !== complaint.departmentId) {
      return { allowed: false, reason: 'Access restricted to your department complaints' };
    }
    return { allowed: true };
  }

  if (actor.role === 'DEPARTMENT_OFFICER') {
    if (complaint.assignment?.departmentOfficerId !== actor.id) {
      return { allowed: false, reason: 'Access restricted to complaints assigned to you' };
    }
    return { allowed: true };
  }

  return { allowed: false, reason: 'Insufficient role for material cost tracking' };
}

function serializeMaterialEntry(record: {
  id: string;
  complaintId: string;
  name: string;
  quantity: number | string | { toString(): string };
  unit: string;
  unitCostPaise: number;
  recordedByUserId: string;
  createdAt: Date;
  recordedByUser?: { name?: string | null } | null;
}): ComplaintMaterialEntryView {
  const quantity = toFiniteNumber(record.quantity);
  return {
    id: record.id,
    complaintId: record.complaintId,
    name: record.name,
    quantity,
    unit: record.unit,
    unitCostPaise: record.unitCostPaise,
    lineTotalPaise: computeLineTotalPaise(quantity, record.unitCostPaise),
    recordedByUserId: record.recordedByUserId,
    recordedByName: record.recordedByUser?.name?.trim() || 'Staff Member',
    createdAt: record.createdAt.toISOString(),
  };
}

async function loadScopedComplaint(
  complaintId: string,
  actor: MaterialCostActor,
  db: MaterialCostDbClient,
) {
  const complaint = await db.complaint.findUnique({
    where: { id: complaintId },
    select: {
      id: true,
      ticketNumber: true,
      title: true,
      departmentId: true,
      assignment: {
        select: {
          departmentOfficerId: true,
        },
      },
    },
  });

  if (!complaint) {
    throw new MaterialServiceError('NOT_FOUND', 'Complaint not found');
  }

  const access = checkComplaintMaterialAccess(actor, complaint);
  if (!access.allowed) {
    throw new MaterialServiceError('FORBIDDEN', access.reason);
  }

  return complaint;
}

/**
 * Lists material cost entries and summary totals for a complaint visible to the actor.
 */
export async function listComplaintMaterials(
  complaintId: string,
  actor: MaterialCostActor,
  db: MaterialCostDbClient = prisma as unknown as MaterialCostDbClient,
): Promise<{
  complaintId: string;
  ticketNumber: string;
  title: string;
  entries: ComplaintMaterialEntryView[];
  summary: ComplaintCostSummary;
}> {
  const complaint = await loadScopedComplaint(complaintId, actor, db);

  const rawEntries = (await db.complaintMaterialEntry.findMany({
    where: { complaintId: complaint.id },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      complaintId: true,
      name: true,
      quantity: true,
      unit: true,
      unitCostPaise: true,
      recordedByUserId: true,
      createdAt: true,
      recordedByUser: {
        select: {
          name: true,
        },
      },
    },
  })) as Array<{
    id: string;
    complaintId: string;
    name: string;
    quantity: number | string | { toString(): string };
    unit: string;
    unitCostPaise: number;
    recordedByUserId: string;
    createdAt: Date;
    recordedByUser?: { name?: string | null } | null;
  }>;

  const entries = rawEntries.map(serializeMaterialEntry);

  return {
    complaintId: complaint.id,
    ticketNumber: complaint.ticketNumber,
    title: complaint.title,
    entries,
    summary: summarizeComplaintCost(entries),
  };
}

/**
 * Records a validated material entry against a complaint visible to the actor.
 */
export async function recordComplaintMaterialEntry(
  complaintId: string,
  rawInput: unknown,
  actor: MaterialCostActor,
  db: MaterialCostDbClient = prisma as unknown as MaterialCostDbClient,
): Promise<{
  entry: ComplaintMaterialEntryView;
  summary: ComplaintCostSummary;
}> {
  const complaint = await loadScopedComplaint(complaintId, actor, db);

  const validated = validateMaterialEntry(rawInput);
  if (!validated.success) {
    throw new MaterialServiceError('VALIDATION_ERROR', validated.error);
  }

  const created = (await db.complaintMaterialEntry.create({
    data: {
      complaintId: complaint.id,
      name: validated.data.name,
      quantity: validated.data.quantity,
      unit: validated.data.unit,
      unitCostPaise: validated.data.unitCostPaise,
      recordedByUserId: actor.id,
    },
    select: {
      id: true,
      complaintId: true,
      name: true,
      quantity: true,
      unit: true,
      unitCostPaise: true,
      recordedByUserId: true,
      createdAt: true,
      recordedByUser: {
        select: {
          name: true,
        },
      },
    },
  })) as {
    id: string;
    complaintId: string;
    name: string;
    quantity: number | string | { toString(): string };
    unit: string;
    unitCostPaise: number;
    recordedByUserId: string;
    createdAt: Date;
    recordedByUser?: { name?: string | null } | null;
  };

  const allEntries = (await db.complaintMaterialEntry.findMany({
    where: { complaintId: complaint.id },
    select: {
      quantity: true,
      unitCostPaise: true,
    },
  })) as Array<{
    quantity: number | string | { toString(): string };
    unitCostPaise: number;
  }>;

  return {
    entry: serializeMaterialEntry(created),
    summary: summarizeComplaintCost(allEntries),
  };
}

/**
 * Aggregates material costs by department from raw entry rows without exposing citizen PII.
 */
export function summarizeDepartmentMaterialCosts(
  records: ReadonlyArray<DepartmentSummaryRecordLike>,
  range: { from: string; to: string },
): DepartmentMaterialCostReport {
  const buckets = new Map<
    string,
    {
      departmentId: string | null;
      departmentCode: string;
      departmentName: string;
      totalPaise: number;
      entryCount: number;
      complaintIds: Set<string>;
    }
  >();

  let grandTotalPaise = 0;

  for (const record of records) {
    const dept = record.complaint.department;
    const key = dept?.id ?? '__UNASSIGNED__';
    const lineTotal = computeLineTotalPaise(record.quantity, record.unitCostPaise);
    grandTotalPaise += lineTotal;

    const existing = buckets.get(key);
    if (existing) {
      existing.totalPaise += lineTotal;
      existing.entryCount += 1;
      existing.complaintIds.add(record.complaintId);
    } else {
      buckets.set(key, {
        departmentId: dept?.id ?? null,
        departmentCode: dept?.code ?? 'UNASSIGNED',
        departmentName: dept?.name ?? 'Unassigned Department',
        totalPaise: lineTotal,
        entryCount: 1,
        complaintIds: new Set([record.complaintId]),
      });
    }
  }

  const departments: DepartmentMaterialCostRow[] = Array.from(buckets.values())
    .map((bucket) => ({
      departmentId: bucket.departmentId,
      departmentCode: bucket.departmentCode,
      departmentName: bucket.departmentName,
      totalPaise: bucket.totalPaise,
      entryCount: bucket.entryCount,
      complaintCount: bucket.complaintIds.size,
    }))
    .sort((a, b) => {
      if (b.totalPaise !== a.totalPaise) {
        return b.totalPaise - a.totalPaise;
      }
      return a.departmentName.localeCompare(b.departmentName);
    });

  return {
    range,
    totalPaise: grandTotalPaise,
    entryCount: records.length,
    departments,
  };
}

/**
 * Returns admin-level per-department material costs over a validated date range (max 366 days).
 */
export async function getDepartmentMaterialCostSummary(
  query: { from?: string; to?: string },
  actor: Pick<MaterialCostActor, 'role'>,
  db: MaterialCostDbClient = prisma as unknown as MaterialCostDbClient,
  clock?: () => Date,
): Promise<DepartmentMaterialCostReport> {
  if (actor.role !== 'SUPER_ADMIN' && actor.role !== 'ADMIN') {
    throw new MaterialServiceError('FORBIDDEN', 'Only platform administrators can view material cost reports');
  }

  const parsedQuery = materialCostReportQuerySchema.safeParse(query);
  if (!parsedQuery.success) {
    const firstIssue = parsedQuery.error.issues[0];
    throw new MaterialServiceError(
      'VALIDATION_ERROR',
      firstIssue?.message ?? 'Invalid report query parameters',
    );
  }

  const resolved = resolveReportDateRange(parsedQuery.data.from, parsedQuery.data.to, clock);
  const inclusiveDays =
    Math.floor(
      (Date.parse(`${resolved.toIso}T00:00:00.000Z`) -
        Date.parse(`${resolved.fromIso}T00:00:00.000Z`)) /
        DAY_MS,
    ) + 1;

  if (inclusiveDays > MAX_MATERIAL_COST_RANGE_DAYS) {
    throw new MaterialServiceError(
      'VALIDATION_ERROR',
      `Date range cannot exceed ${MAX_MATERIAL_COST_RANGE_DAYS} days`,
    );
  }

  const rows = (await db.complaintMaterialEntry.findMany({
    where: {
      createdAt: {
        gte: resolved.fromStart,
        lte: resolved.toEnd,
      },
    },
    select: {
      complaintId: true,
      quantity: true,
      unitCostPaise: true,
      complaint: {
        select: {
          departmentId: true,
          department: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },
        },
      },
    },
  })) as DepartmentSummaryRecordLike[];

  return summarizeDepartmentMaterialCosts(rows, {
    from: resolved.fromIso,
    to: resolved.toIso,
  });
}

