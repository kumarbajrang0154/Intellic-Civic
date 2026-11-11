import { z } from 'zod';

export const gisHeatmapQuerySchema = z.object({
  departmentId: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .regex(/^[A-Za-z0-9_-]+$/, 'Invalid department identifier')
    .optional(),
  status: z
    .enum([
      'SUBMITTED',
      'AI_PROCESSING',
      'PENDING_DEPT_REVIEW',
      'ASSIGNED',
      'IN_PROGRESS',
      'RESOLVED',
      'CLOSED',
      'REJECTED',
      'DUPLICATE',
    ])
    .optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  cellSizeDeg: z.coerce
    .number()
    .finite()
    .min(0.001)
    .max(0.1)
    .optional()
    .default(0.005),
});

export type GisHeatmapQueryInput = z.infer<typeof gisHeatmapQuerySchema>;

export interface GisComplaintInput {
  id: string;
  priority?: string | null;
  status?: string | null;
  location?: {
    latitude: number;
    longitude: number;
    address?: string | null;
  } | null;
}

export interface HeatPoint {
  id: string;
  lat: number;
  lng: number;
  weight: number;
  intensity: number;
  priority: string;
}

export interface HeatClusterCell {
  cellKey: string;
  centerLat: number;
  centerLng: number;
  count: number;
  totalWeight: number;
  intensity: number;
  criticalOrHighCount: number;
  color: string;
}

const PRIORITY_WEIGHTS: Record<string, number> = {
  CRITICAL: 2.0,
  HIGH: 1.5,
  MEDIUM: 1.0,
  LOW: 0.7,
};

export function getPriorityWeight(priority?: string | null): number {
  const key = (priority || 'MEDIUM').toUpperCase();
  return PRIORITY_WEIGHTS[key] ?? 1.0;
}

export function isValidGisCoordinate(lat: unknown, lng: unknown): lat is number {
  if (typeof lat !== 'number' || typeof lng !== 'number') return false;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return false;
  if (lat === 0 && lng === 0) return false;
  return true;
}

export function extractHeatPoints(complaints: GisComplaintInput[]): HeatPoint[] {
  const rawPoints = complaints
    .filter((c) => isValidGisCoordinate(c.location?.latitude, c.location?.longitude))
    .map((c) => {
      const weight = getPriorityWeight(c.priority);
      return {
        id: c.id,
        lat: c.location!.latitude,
        lng: c.location!.longitude,
        weight,
        intensity: Math.min(1, weight / 2.0),
        priority: (c.priority || 'MEDIUM').toUpperCase(),
      };
    });

  return rawPoints;
}

export function getHeatmapIntensityColor(intensity: number): string {
  const clamped = Math.max(0, Math.min(1, intensity));
  if (clamped >= 0.75) return '#DC2626'; // Critical hotspot (red)
  if (clamped >= 0.5) return '#D98E2B'; // Elevated density (amber/gold)
  if (clamped >= 0.25) return '#3B8F68'; // Moderate density (civic emerald)
  return '#3468A1'; // Low baseline density (civic slate-blue)
}

/**
 * Spatial grid density aggregator for deterministic server/client hotspot clustering.
 */
export function computeHeatmapClusters(
  points: HeatPoint[],
  cellSizeDeg: number = 0.005,
): HeatClusterCell[] {
  if (points.length === 0) return [];
  const step = Math.max(0.001, Math.min(0.1, cellSizeDeg));

  const buckets = new Map<
    string,
    {
      count: number;
      totalWeight: number;
      weightedLatSum: number;
      weightedLngSum: number;
      criticalOrHighCount: number;
    }
  >();

  for (const pt of points) {
    const latBin = Math.floor(pt.lat / step);
    const lngBin = Math.floor(pt.lng / step);
    const cellKey = `${latBin}:${lngBin}`;

    if (!buckets.has(cellKey)) {
      buckets.set(cellKey, {
        count: 0,
        totalWeight: 0,
        weightedLatSum: 0,
        weightedLngSum: 0,
        criticalOrHighCount: 0,
      });
    }

    const bucket = buckets.get(cellKey)!;
    bucket.count++;
    bucket.totalWeight += pt.weight;
    bucket.weightedLatSum += pt.lat * pt.weight;
    bucket.weightedLngSum += pt.lng * pt.weight;
    if (pt.priority === 'CRITICAL' || pt.priority === 'HIGH') {
      bucket.criticalOrHighCount++;
    }
  }

  let maxWeight = 0;
  for (const b of buckets.values()) {
    if (b.totalWeight > maxWeight) maxWeight = b.totalWeight;
  }

  return Array.from(buckets.entries())
    .map(([cellKey, b]) => {
      const intensity = maxWeight > 0 ? Math.round((b.totalWeight / maxWeight) * 1000) / 1000 : 0;
      return {
        cellKey,
        centerLat: Math.round((b.weightedLatSum / b.totalWeight) * 1_000_000) / 1_000_000,
        centerLng: Math.round((b.weightedLngSum / b.totalWeight) * 1_000_000) / 1_000_000,
        count: b.count,
        totalWeight: Math.round(b.totalWeight * 100) / 100,
        intensity,
        criticalOrHighCount: b.criticalOrHighCount,
        color: getHeatmapIntensityColor(intensity),
      };
    })
    .sort((a, b) => b.totalWeight - a.totalWeight || b.count - a.count);
}

