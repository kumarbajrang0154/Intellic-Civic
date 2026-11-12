import { z } from 'zod';
import prisma from '@/lib/prisma';
import { extractWardLabel } from '@/services/transparency-service';

export const predictiveQuerySchema = z.object({
  lookbackDays: z.coerce.number().int().min(14).max(180).default(90),
  horizonDays: z.coerce.number().int().min(7).max(60).default(30),
  limit: z.coerce.number().int().min(1).max(30).default(12),
});

export interface PredictiveSourceComplaint {
  id: string;
  status: string;
  priority: string | null;
  createdAt: Date | string;
  category?: { name: string } | null;
  department?: { name: string } | null;
  municipality?: { name?: string | null; city?: string | null; state?: string | null } | null;
  location?: { address?: string | null } | null;
}

export type SurgeRiskLevel = 'HIGH' | 'ELEVATED' | 'STABLE';

export interface WardCategoryForecast {
  ward: string;
  category: string;
  department: string;
  totalInWindow: number;
  recent30Count: number;
  prior30Count: number;
  openBacklogCount: number;
  growthRatePct: number;
  projectedNextHorizonCount: number;
  riskLevel: SurgeRiskLevel;
  rationale: string;
}

export interface PredictiveAnalyticsReport {
  generatedAt: string;
  lookbackDays: number;
  horizonDays: number;
  totalAnalyzed: number;
  topSurges: WardCategoryForecast[];
  categorySummary: Array<{
    category: string;
    total: number;
    projectedNextHorizon: number;
    growthRatePct: number;
  }>;
}

const CLOSED_STATUSES = new Set(['RESOLVED', 'CLOSED', 'REJECTED', 'DUPLICATE']);

/**
 * Pure forecast computation over aggregate ward & category complaint histories.
 * Strictly zero citizen PII and zero exact coordinates.
 */
export function buildWardCategoryForecasts(
  records: PredictiveSourceComplaint[],
  opts?: { lookbackDays?: number; horizonDays?: number; limit?: number; now?: Date },
): PredictiveAnalyticsReport {
  const now = opts?.now ?? new Date();
  const lookbackDays = opts?.lookbackDays ?? 90;
  const horizonDays = opts?.horizonDays ?? 30;
  const limit = opts?.limit ?? 12;

  const recentCutoffMs = now.getTime() - 30 * 86_400_000;
  const priorCutoffMs = now.getTime() - 60 * 86_400_000;
  const windowCutoffMs = now.getTime() - lookbackDays * 86_400_000;

  type Bucket = {
    ward: string;
    category: string;
    department: string;
    totalInWindow: number;
    recent30Count: number;
    prior30Count: number;
    openBacklogCount: number;
  };

  const buckets = new Map<string, Bucket>();
  const categoryTotals = new Map<string, { recent30: number; prior30: number; total: number }>();

  let totalAnalyzed = 0;

  for (const rec of records) {
    const createdMs =
      rec.createdAt instanceof Date ? rec.createdAt.getTime() : new Date(rec.createdAt).getTime();
    if (!Number.isFinite(createdMs) || createdMs < windowCutoffMs) {
      continue;
    }

    totalAnalyzed += 1;
    const ward = extractWardLabel(rec.location?.address, rec.municipality);
    const category = rec.category?.name?.trim() || 'Uncategorized';
    const department = rec.department?.name?.trim() || 'General Triage';
    const key = `${ward}|||${category}`;

    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = {
        ward,
        category,
        department,
        totalInWindow: 0,
        recent30Count: 0,
        prior30Count: 0,
        openBacklogCount: 0,
      };
      buckets.set(key, bucket);
    }

    bucket.totalInWindow += 1;
    if (createdMs >= recentCutoffMs) {
      bucket.recent30Count += 1;
    } else if (createdMs >= priorCutoffMs) {
      bucket.prior30Count += 1;
    }
    if (!CLOSED_STATUSES.has(rec.status)) {
      bucket.openBacklogCount += 1;
    }

    const catStats = categoryTotals.get(category) ?? { recent30: 0, prior30: 0, total: 0 };
    catStats.total += 1;
    if (createdMs >= recentCutoffMs) catStats.recent30 += 1;
    else if (createdMs >= priorCutoffMs) catStats.prior30 += 1;
    categoryTotals.set(category, catStats);
  }

  const horizonScale = horizonDays / 30;
  const forecasts: WardCategoryForecast[] = [];

  for (const b of buckets.values()) {
    const baseline = Math.max(b.prior30Count, 1);
    const growthRatio = (b.recent30Count - b.prior30Count) / baseline;
    const growthRatePct = Math.round(growthRatio * 100);

    // Weighted trend projection: blend recent momentum + backlog recurrence factor
    const momentum = b.recent30Count + Math.max(0, b.recent30Count - b.prior30Count) * 0.5;
    const backlogPressure = b.openBacklogCount * 0.15;
    const projectedNextHorizonCount = Math.max(
      1,
      Math.round((momentum + backlogPressure) * horizonScale),
    );

    let riskLevel: SurgeRiskLevel = 'STABLE';
    if ((b.recent30Count >= 3 && growthRatePct >= 40) || projectedNextHorizonCount >= 6) {
      riskLevel = 'HIGH';
    } else if (
      (b.recent30Count >= 2 && growthRatePct >= 15) ||
      b.openBacklogCount >= 3 ||
      projectedNextHorizonCount >= 3
    ) {
      riskLevel = 'ELEVATED';
    }

    const direction =
      growthRatePct > 10
        ? `rising (+${growthRatePct}% vs prior 30d)`
        : growthRatePct < -10
        ? `easing (${growthRatePct}% vs prior 30d)`
        : 'steady volume';

    const rationale = `${b.category} in ${b.ward}: ${direction}, ${b.openBacklogCount} open backlog`;

    forecasts.push({
      ward: b.ward,
      category: b.category,
      department: b.department,
      totalInWindow: b.totalInWindow,
      recent30Count: b.recent30Count,
      prior30Count: b.prior30Count,
      openBacklogCount: b.openBacklogCount,
      growthRatePct,
      projectedNextHorizonCount,
      riskLevel,
      rationale,
    });
  }

  const riskRank: Record<SurgeRiskLevel, number> = { HIGH: 3, ELEVATED: 2, STABLE: 1 };
  forecasts.sort((a, b) => {
    if (riskRank[b.riskLevel] !== riskRank[a.riskLevel]) {
      return riskRank[b.riskLevel] - riskRank[a.riskLevel];
    }
    if (b.projectedNextHorizonCount !== a.projectedNextHorizonCount) {
      return b.projectedNextHorizonCount - a.projectedNextHorizonCount;
    }
    return b.growthRatePct - a.growthRatePct;
  });

  const categorySummary = Array.from(categoryTotals.entries())
    .map(([category, stats]) => {
      const base = Math.max(stats.prior30, 1);
      const growthRatePct = Math.round(((stats.recent30 - stats.prior30) / base) * 100);
      const projectedNextHorizon = Math.max(
        1,
        Math.round((stats.recent30 + Math.max(0, stats.recent30 - stats.prior30) * 0.4) * horizonScale),
      );
      return {
        category,
        total: stats.total,
        projectedNextHorizon,
        growthRatePct,
      };
    })
    .sort((a, b) => b.projectedNextHorizon - a.projectedNextHorizon)
    .slice(0, 10);

  return {
    generatedAt: now.toISOString(),
    lookbackDays,
    horizonDays,
    totalAnalyzed,
    topSurges: forecasts.slice(0, limit),
    categorySummary,
  };
}

export interface PredictiveDbClient {
  complaint: {
    findMany: (args: any) => Promise<PredictiveSourceComplaint[]>;
  };
}

export async function getPredictiveAnalytics(
  params?: {
    municipalityId?: string | null;
    departmentId?: string | null;
    lookbackDays?: number;
    horizonDays?: number;
    limit?: number;
  },
  db: PredictiveDbClient = prisma as unknown as PredictiveDbClient,
): Promise<PredictiveAnalyticsReport> {
  const lookbackDays = params?.lookbackDays ?? 90;
  const since = new Date(Date.now() - lookbackDays * 86_400_000);

  const where: any = {
    createdAt: { gte: since },
  };
  if (params?.municipalityId) {
    where.municipalityId = params.municipalityId;
  }
  if (params?.departmentId) {
    where.departmentId = params.departmentId;
  }

  const rows = await db.complaint.findMany({
    where,
    select: {
      id: true,
      status: true,
      priority: true,
      createdAt: true,
      category: { select: { name: true } },
      department: { select: { name: true } },
      municipality: { select: { name: true, city: true, state: true } },
      location: { select: { address: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 3000,
  });

  return buildWardCategoryForecasts(rows, {
    lookbackDays,
    horizonDays: params?.horizonDays ?? 30,
    limit: params?.limit ?? 12,
  });
}

