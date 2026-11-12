import { z } from 'zod';
import prisma from '@/lib/prisma';

export const transparencyQuerySchema = z.object({
  departmentId: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .regex(/^[A-Za-z0-9_-]+$/, 'Invalid department identifier')
    .optional(),
  ward: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .regex(/^[A-Za-z0-9\s._-]+$/, 'Invalid ward filter')
    .optional(),
});

export type TransparencyQueryInput = z.infer<typeof transparencyQuerySchema>;

const RESOLVED_STATUSES = new Set(['RESOLVED', 'CLOSED']);
const PENDING_STATUSES = new Set(['SUBMITTED', 'AI_PROCESSING', 'PENDING_DEPT_REVIEW', 'ASSIGNED']);
const IN_PROGRESS_STATUSES = new Set(['IN_PROGRESS']);

export interface TransparencySourceRecord {
  status: string;
  priority: string | null;
  createdAt: Date | string;
  resolvedAt?: Date | string | null;
  closedAt?: Date | string | null;
  departmentId?: string | null;
  department?: { id: string; name: string } | null;
  municipalityId?: string | null;
  municipality?: { id: string; name: string; city?: string | null; state?: string | null } | null;
  location?: { address?: string | null } | null;
}

export interface DepartmentTransparencyRow {
  departmentId: string;
  departmentName: string;
  total: number;
  resolved: number;
  pending: number;
  inProgress: number;
  other: number;
  resolutionRatePct: number;
}

export interface WardTransparencyRow {
  ward: string;
  total: number;
  resolved: number;
  pending: number;
  inProgress: number;
  other: number;
  resolutionRatePct: number;
}

export interface PublicTransparencyReport {
  generatedAt: string;
  filters: {
    departmentId: string | null;
    ward: string | null;
  };
  availableDepartments: Array<{ id: string; name: string }>;
  availableWards: string[];
  summary: {
    total: number;
    resolved: number;
    pending: number;
    inProgress: number;
    rejectedOrDuplicate: number;
    resolutionRatePct: number;
    avgResolutionHours: number | null;
  };
  priorityBreakdown: {
    CRITICAL: number;
    HIGH: number;
    MEDIUM: number;
    LOW: number;
  };
  byDepartment: DepartmentTransparencyRow[];
  byWard: WardTransparencyRow[];
}

function isCoordinateOrFragmentLabel(label: string): boolean {
  return /[()]/.test(label) || /\d{2,}\.\d+/.test(label) || /^\s*location at/i.test(label);
}

function isPublicDepartmentEligible(rec: TransparencySourceRecord): boolean {
  const deptId = rec.department?.id?.trim();
  const deptName = rec.department?.name?.trim();
  if (!deptId || !deptName || deptId.toLowerCase() === 'unassigned') {
    return false;
  }
  if (/^Dept Z \d+/.test(deptName)) {
    return false;
  }
  return true;
}

function hasSensitivePattern(segment: string): boolean {
  if (isCoordinateOrFragmentLabel(segment)) return true;
  if (segment.includes('@')) return true;
  if (/\d{6,}/.test(segment)) return true; // phone numbers or postal codes
  if (/^\s*(?:\d+[A-Za-z/-]*|no\.?\s*\d+|plot\b|flat\b|door\b|house\b|#\s*\d+)/i.test(segment)) {
    return true;
  }
  return false;
}

/**
 * Normalizes a location into a coarse, non-identifying ward or locality label.
 * Never returns house numbers, phone numbers, email addresses, or street-level PII.
 */
export function extractWardLabel(
  address?: string | null,
  municipality?: { name?: string | null; city?: string | null; state?: string | null } | null,
): string {
  const cleaned = (address || '').trim();
  const rawFallback =
    municipality?.city?.trim() || municipality?.name?.trim() || 'General Civic Zone';
  const fallback = isCoordinateOrFragmentLabel(rawFallback) ? 'Unspecified' : rawFallback;

  if (!cleaned) {
    return fallback;
  }

  if (/^\s*location at/i.test(cleaned)) {
    return 'Unspecified';
  }

  const wardMatch = cleaned.match(
    /\b(ward|zone|sector|division)\s*(?:no\.?|number|#|:|-)?\s*([a-z0-9]{1,12}(?:-[a-z0-9]{1,8})?)/i,
  );
  if (wardMatch) {
    const prefix = wardMatch[1].charAt(0).toUpperCase() + wardMatch[1].slice(1).toLowerCase();
    const token = wardMatch[2].toUpperCase();
    const candidate = `${prefix} ${token}`;
    return isCoordinateOrFragmentLabel(candidate) ? 'Unspecified' : candidate;
  }

  const segments = cleaned
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const cityLower = (municipality?.city || '').trim().toLowerCase();
  const stateLower = (municipality?.state || '').trim().toLowerCase();

  for (let i = segments.length - 1; i >= 0; i--) {
    const seg = segments[i];
    const segLower = seg.toLowerCase();
    if (hasSensitivePattern(seg)) continue;
    if (segLower === stateLower || segLower === 'india') continue;
    if (segLower === cityLower && i > 0) continue;
    if (seg.length >= 2 && seg.length <= 48) {
      return seg.replace(/\s+/g, ' ');
    }
  }

  return isCoordinateOrFragmentLabel(cleaned) ? 'Unspecified' : fallback;
}

function toRatePct(resolved: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((resolved / total) * 100);
}

/**
 * Pure aggregator over strictly anonymized complaint metadata.
 */
export function aggregatePublicTransparencyStats(
  records: TransparencySourceRecord[],
  options: {
    departmentId?: string | null;
    ward?: string | null;
    clock?: () => Date;
  } = {},
): PublicTransparencyReport {
  const clock = options.clock || (() => new Date());
  const departmentFilter = options.departmentId?.trim() || null;
  const wardFilter = options.ward?.trim() || null;

  const deptCatalog = new Map<string, string>();
  const wardCatalog = new Set<string>();

  const enriched = records.map((rec) => {
    const includeDept = isPublicDepartmentEligible(rec);
    const deptId = includeDept ? rec.department!.id!.trim() : rec.departmentId || 'unassigned';
    const deptName = includeDept ? rec.department!.name!.trim() : 'Unassigned';
    const wardLabel = extractWardLabel(rec.location?.address, rec.municipality);
    if (includeDept) {
      deptCatalog.set(deptId, deptName);
    }
    wardCatalog.add(wardLabel);
    return { rec, deptId, deptName, wardLabel, includeDept };
  });

  const filtered = enriched.filter((item) => {
    if (departmentFilter && (!item.includeDept || item.deptId !== departmentFilter)) return false;
    if (wardFilter && item.wardLabel.toLowerCase() !== wardFilter.toLowerCase()) return false;
    return true;
  });

  let resolved = 0;
  let pending = 0;
  let inProgress = 0;
  let rejectedOrDuplicate = 0;
  let resolutionHoursSum = 0;
  let resolutionHoursCount = 0;

  const priorityBreakdown = {
    CRITICAL: 0,
    HIGH: 0,
    MEDIUM: 0,
    LOW: 0,
  };

  const deptBuckets = new Map<
    string,
    { departmentId: string; departmentName: string; total: number; resolved: number; pending: number; inProgress: number; other: number }
  >();
  const wardBuckets = new Map<
    string,
    { ward: string; total: number; resolved: number; pending: number; inProgress: number; other: number }
  >();

  for (const { rec, deptId, deptName, wardLabel, includeDept } of filtered) {
    const status = (rec.status || '').toUpperCase();
    const isResolved = RESOLVED_STATUSES.has(status);
    const isPending = PENDING_STATUSES.has(status);
    const isInProgress = IN_PROGRESS_STATUSES.has(status);

    if (isResolved) {
      resolved++;
      const createdMs = new Date(rec.createdAt).getTime();
      const completedDate = rec.resolvedAt || rec.closedAt;
      const completedMs = completedDate ? new Date(completedDate).getTime() : NaN;
      if (Number.isFinite(createdMs) && Number.isFinite(completedMs) && completedMs >= createdMs) {
        resolutionHoursSum += (completedMs - createdMs) / (1000 * 60 * 60);
        resolutionHoursCount++;
      }
    } else if (isPending) {
      pending++;
    } else if (isInProgress) {
      inProgress++;
    } else {
      rejectedOrDuplicate++;
    }

    const pKey = (rec.priority || 'MEDIUM').toUpperCase();
    if (pKey === 'CRITICAL' || pKey === 'HIGH' || pKey === 'MEDIUM' || pKey === 'LOW') {
      priorityBreakdown[pKey]++;
    }

    if (includeDept) {
      if (!deptBuckets.has(deptId)) {
        deptBuckets.set(deptId, {
          departmentId: deptId,
          departmentName: deptName,
          total: 0,
          resolved: 0,
          pending: 0,
          inProgress: 0,
          other: 0,
        });
      }
      const db = deptBuckets.get(deptId)!;
      db.total++;
      if (isResolved) db.resolved++;
      else if (isPending) db.pending++;
      else if (isInProgress) db.inProgress++;
      else db.other++;
    }

    if (!wardBuckets.has(wardLabel)) {
      wardBuckets.set(wardLabel, {
        ward: wardLabel,
        total: 0,
        resolved: 0,
        pending: 0,
        inProgress: 0,
        other: 0,
      });
    }
    const wb = wardBuckets.get(wardLabel)!;
    wb.total++;
    if (isResolved) wb.resolved++;
    else if (isPending) wb.pending++;
    else if (isInProgress) wb.inProgress++;
    else wb.other++;
  }

  const total = filtered.length;
  const byDepartment: DepartmentTransparencyRow[] = Array.from(deptBuckets.values())
    .map((d) => ({
      ...d,
      resolutionRatePct: toRatePct(d.resolved, d.total),
    }))
    .sort((a, b) => b.total - a.total || a.departmentName.localeCompare(b.departmentName));

  const byWard: WardTransparencyRow[] = Array.from(wardBuckets.values())
    .map((w) => ({
      ...w,
      resolutionRatePct: toRatePct(w.resolved, w.total),
    }))
    .sort((a, b) => b.total - a.total || a.ward.localeCompare(b.ward));

  return {
    generatedAt: clock().toISOString(),
    filters: {
      departmentId: departmentFilter,
      ward: wardFilter,
    },
    availableDepartments: Array.from(deptCatalog.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    availableWards: Array.from(wardCatalog).sort((a, b) => a.localeCompare(b)),
    summary: {
      total,
      resolved,
      pending,
      inProgress,
      rejectedOrDuplicate,
      resolutionRatePct: toRatePct(resolved, total),
      avgResolutionHours:
        resolutionHoursCount > 0
          ? Math.round((resolutionHoursSum / resolutionHoursCount) * 10) / 10
          : null,
    },
    priorityBreakdown,
    byDepartment,
    byWard,
  };
}

/**
 * Fetches aggregate civic transparency counts without ever selecting citizen PII.
 */
export async function getPublicTransparencySummary(options: {
  departmentId?: string | null;
  ward?: string | null;
  prismaClient?: typeof prisma;
  clock?: () => Date;
} = {}): Promise<PublicTransparencyReport> {
  const db = options.prismaClient || prisma;
  const records = await db.complaint.findMany({
    select: {
      status: true,
      priority: true,
      createdAt: true,
      resolvedAt: true,
      closedAt: true,
      departmentId: true,
      municipalityId: true,
      department: {
        select: { id: true, name: true },
      },
      municipality: {
        select: { id: true, name: true, city: true, state: true },
      },
      location: {
        select: { address: true },
      },
    },
  });

  return aggregatePublicTransparencyStats(records, {
    departmentId: options.departmentId,
    ward: options.ward,
    clock: options.clock,
  });
}
