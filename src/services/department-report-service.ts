import { z } from 'zod';
import prisma from '@/lib/prisma';

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const PENDING_STATUSES = new Set([
  'SUBMITTED',
  'AI_PROCESSING',
  'PENDING_DEPT_REVIEW',
  'ASSIGNED',
  'IN_PROGRESS',
]);
const RESOLVED_STATUSES = new Set(['RESOLVED', 'CLOSED']);

function parseValidUtcDate(dateStr: string): Date | null {
  if (!ISO_DATE_RE.test(dateStr)) return null;
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
  if (
    dt.getUTCFullYear() !== y ||
    dt.getUTCMonth() !== m - 1 ||
    dt.getUTCDate() !== d
  ) {
    return null;
  }
  return dt;
}

export const departmentReportQuerySchema = z
  .object({
    from: z
      .string()
      .trim()
      .refine((v) => parseValidUtcDate(v) !== null, 'from must be a valid YYYY-MM-DD calendar date')
      .optional(),
    to: z
      .string()
      .trim()
      .refine((v) => parseValidUtcDate(v) !== null, 'to must be a valid YYYY-MM-DD calendar date')
      .optional(),
    departmentId: z
      .string()
      .trim()
      .min(1)
      .max(64)
      .regex(/^[A-Za-z0-9_-]+$/, 'Invalid department identifier')
      .optional(),
    format: z.enum(['json', 'csv']).optional().default('json'),
  })
  .refine(
    (data) => {
      if (data.from && data.to) {
        const fromDt = parseValidUtcDate(data.from);
        const toDt = parseValidUtcDate(data.to);
        if (fromDt && toDt) {
          return fromDt.getTime() <= toDt.getTime();
        }
      }
      return true;
    },
    { message: 'from date must not be after to date', path: ['from'] },
  );

export type DepartmentReportQueryInput = z.infer<typeof departmentReportQuerySchema>;

export interface ReportDepartmentSource {
  id: string;
  name: string;
  isSuspended?: boolean;
}

export interface ReportComplaintSource {
  id: string;
  status: string;
  departmentId: string | null;
  createdAt: Date | string;
  resolvedAt?: Date | string | null;
  closedAt?: Date | string | null;
  reopenCount?: number | null;
}

export interface DepartmentPerformanceRow {
  departmentId: string;
  departmentName: string;
  isSuspended: boolean;
  totalComplaints: number;
  resolvedCount: number;
  pendingCount: number;
  repeatComplaintsCount: number;
  reopenedCount: number;
  duplicateCount: number;
  avgResolutionTimeHours: number | null;
  resolutionRatePct: number;
}

export interface DepartmentPerformanceReport {
  generatedAt: string;
  range: {
    from: string;
    to: string;
  };
  departmentFilter: string | null;
  totals: {
    totalComplaints: number;
    resolvedCount: number;
    pendingCount: number;
    repeatComplaintsCount: number;
    avgResolutionTimeHours: number | null;
    resolutionRatePct: number;
  };
  departments: DepartmentPerformanceRow[];
}

export function resolveReportDateRange(
  from?: string,
  to?: string,
  clock: () => Date = () => new Date(),
): { fromIso: string; toIso: string; fromStart: Date; toEnd: Date } {
  const now = clock();
  const defaultEnd = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999),
  );
  const defaultStart = new Date(defaultEnd.getTime() - 29 * 24 * 60 * 60 * 1000);
  defaultStart.setUTCHours(0, 0, 0, 0);

  const fromStart = from ? parseValidUtcDate(from)! : defaultStart;
  const toStart = to
    ? parseValidUtcDate(to)!
    : new Date(
        Date.UTC(
          defaultEnd.getUTCFullYear(),
          defaultEnd.getUTCMonth(),
          defaultEnd.getUTCDate(),
          0,
          0,
          0,
          0,
        ),
      );

  const toEnd = new Date(toStart.getTime());
  toEnd.setUTCHours(23, 59, 59, 999);

  if (fromStart.getTime() > toEnd.getTime()) {
    throw new Error('Invalid date range: start date is after end date');
  }

  return {
    fromIso: fromStart.toISOString().slice(0, 10),
    toIso: toStart.toISOString().slice(0, 10),
    fromStart,
    toEnd,
  };
}

/**
 * Pure calculator for department performance metrics over an inclusive UTC date range.
 */
export function computeDepartmentPerformanceReport(
  departments: ReportDepartmentSource[],
  complaints: ReportComplaintSource[],
  options: {
    from?: string;
    to?: string;
    departmentId?: string | null;
    clock?: () => Date;
  } = {},
): DepartmentPerformanceReport {
  const clock = options.clock || (() => new Date());
  const { fromIso, toIso, fromStart, toEnd } = resolveReportDateRange(
    options.from,
    options.to,
    clock,
  );
  const departmentFilter = options.departmentId?.trim() || null;

  interface MutableBucket {
    departmentId: string;
    departmentName: string;
    isSuspended: boolean;
    totalComplaints: number;
    resolvedCount: number;
    pendingCount: number;
    repeatComplaintsCount: number;
    reopenedCount: number;
    duplicateCount: number;
    resolutionHoursSum: number;
    resolutionHoursCount: number;
  }

  const buckets = new Map<string, MutableBucket>();
  for (const dept of departments) {
    if (departmentFilter && dept.id !== departmentFilter) continue;
    buckets.set(dept.id, {
      departmentId: dept.id,
      departmentName: dept.name,
      isSuspended: Boolean(dept.isSuspended),
      totalComplaints: 0,
      resolvedCount: 0,
      pendingCount: 0,
      repeatComplaintsCount: 0,
      reopenedCount: 0,
      duplicateCount: 0,
      resolutionHoursSum: 0,
      resolutionHoursCount: 0,
    });
  }

  let globalTotal = 0;
  let globalResolved = 0;
  let globalPending = 0;
  let globalRepeat = 0;
  let globalHoursSum = 0;
  let globalHoursCount = 0;

  const fromMs = fromStart.getTime();
  const toMs = toEnd.getTime();

  for (const complaint of complaints) {
    const createdMs = new Date(complaint.createdAt).getTime();
    if (!Number.isFinite(createdMs) || createdMs < fromMs || createdMs > toMs) {
      continue;
    }

    const deptId = complaint.departmentId || 'unassigned';
    if (departmentFilter && deptId !== departmentFilter) {
      continue;
    }

    if (!buckets.has(deptId)) {
      buckets.set(deptId, {
        departmentId: deptId,
        departmentName: deptId === 'unassigned' ? 'Unassigned' : deptId,
        isSuspended: false,
        totalComplaints: 0,
        resolvedCount: 0,
        pendingCount: 0,
        repeatComplaintsCount: 0,
        reopenedCount: 0,
        duplicateCount: 0,
        resolutionHoursSum: 0,
        resolutionHoursCount: 0,
      });
    }

    const bucket = buckets.get(deptId)!;
    const status = (complaint.status || '').toUpperCase();
    const isResolved = RESOLVED_STATUSES.has(status);
    const isPending = PENDING_STATUSES.has(status);
    const isReopened = (complaint.reopenCount ?? 0) > 0;
    const isDuplicate = status === 'DUPLICATE';
    const isRepeat = isReopened || isDuplicate;

    bucket.totalComplaints++;
    globalTotal++;

    if (isResolved) {
      bucket.resolvedCount++;
      globalResolved++;
      const endDate = complaint.resolvedAt || complaint.closedAt;
      const endMs = endDate ? new Date(endDate).getTime() : NaN;
      if (Number.isFinite(endMs) && endMs >= createdMs) {
        const hrs = (endMs - createdMs) / (1000 * 60 * 60);
        bucket.resolutionHoursSum += hrs;
        bucket.resolutionHoursCount++;
        globalHoursSum += hrs;
        globalHoursCount++;
      }
    } else if (isPending) {
      bucket.pendingCount++;
      globalPending++;
    }

    if (isReopened) bucket.reopenedCount++;
    if (isDuplicate) bucket.duplicateCount++;
    if (isRepeat) {
      bucket.repeatComplaintsCount++;
      globalRepeat++;
    }
  }

  const rows: DepartmentPerformanceRow[] = Array.from(buckets.values())
    .map((b) => ({
      departmentId: b.departmentId,
      departmentName: b.departmentName,
      isSuspended: b.isSuspended,
      totalComplaints: b.totalComplaints,
      resolvedCount: b.resolvedCount,
      pendingCount: b.pendingCount,
      repeatComplaintsCount: b.repeatComplaintsCount,
      reopenedCount: b.reopenedCount,
      duplicateCount: b.duplicateCount,
      avgResolutionTimeHours:
        b.resolutionHoursCount > 0
          ? Math.round((b.resolutionHoursSum / b.resolutionHoursCount) * 100) / 100
          : null,
      resolutionRatePct:
        b.totalComplaints > 0
          ? Math.round((b.resolvedCount / b.totalComplaints) * 100)
          : 0,
    }))
    .sort((a, b) => b.totalComplaints - a.totalComplaints || a.departmentName.localeCompare(b.departmentName));

  return {
    generatedAt: clock().toISOString(),
    range: { from: fromIso, to: toIso },
    departmentFilter,
    totals: {
      totalComplaints: globalTotal,
      resolvedCount: globalResolved,
      pendingCount: globalPending,
      repeatComplaintsCount: globalRepeat,
      avgResolutionTimeHours:
        globalHoursCount > 0
          ? Math.round((globalHoursSum / globalHoursCount) * 100) / 100
          : null,
      resolutionRatePct:
        globalTotal > 0 ? Math.round((globalResolved / globalTotal) * 100) : 0,
    },
    departments: rows,
  };
}

/**
 * Escapes CSV cell values and neutralizes spreadsheet formula injection prefixes (=, +, -, @, \t, \r).
 */
export function escapeCsvCell(value: string | number | boolean | null | undefined): string {
  const raw = value === null || value === undefined ? '' : String(value);
  const formulaSafe =
    typeof value === 'number'
      ? raw
      : /^[=+\-@\t\r]/.test(raw)
        ? `'${raw}`
        : raw;

  if (/[",\n\r]/.test(formulaSafe)) {
    return `"${formulaSafe.replace(/"/g, '""')}"`;
  }
  return `"${formulaSafe}"`;
}

export function formatDepartmentPerformanceCsv(report: DepartmentPerformanceReport): string {
  const headers = [
    'Department ID',
    'Department Name',
    'Period From',
    'Period To',
    'Total Complaints',
    'Resolved Count',
    'Pending Count',
    'Repeat Complaints',
    'Reopened Count',
    'Duplicate Count',
    'Avg Resolution Time (Hours)',
    'Resolution Rate (%)',
  ];

  const rows = report.departments.map((d) =>
    [
      d.departmentId,
      d.departmentName,
      report.range.from,
      report.range.to,
      d.totalComplaints,
      d.resolvedCount,
      d.pendingCount,
      d.repeatComplaintsCount,
      d.reopenedCount,
      d.duplicateCount,
      d.avgResolutionTimeHours ?? 'N/A',
      d.resolutionRatePct,
    ]
      .map(escapeCsvCell)
      .join(','),
  );

  return [headers.map(escapeCsvCell).join(','), ...rows].join('\n');
}

export async function getDepartmentPerformanceReport(options: {
  from?: string;
  to?: string;
  departmentId?: string | null;
  prismaClient?: typeof prisma;
  clock?: () => Date;
} = {}): Promise<DepartmentPerformanceReport> {
  const db = options.prismaClient || prisma;
  const clock = options.clock || (() => new Date());
  const { fromStart, toEnd } = resolveReportDateRange(options.from, options.to, clock);

  const [departments, complaints] = await Promise.all([
    db.department.findMany({
      ...(options.departmentId ? { where: { id: options.departmentId } } : {}),
      select: { id: true, name: true, isSuspended: true },
      orderBy: { name: 'asc' },
    }),
    db.complaint.findMany({
      where: {
        createdAt: {
          gte: fromStart,
          lte: toEnd,
        },
        ...(options.departmentId ? { departmentId: options.departmentId } : {}),
      },
      select: {
        id: true,
        status: true,
        departmentId: true,
        createdAt: true,
        resolvedAt: true,
        closedAt: true,
        reopenCount: true,
      },
    }),
  ]);

  return computeDepartmentPerformanceReport(departments, complaints, {
    from: options.from,
    to: options.to,
    departmentId: options.departmentId,
    clock,
  });
}

