import { ComplaintStatus } from '@prisma/client';
import { z } from 'zod';
import { isValidGisCoordinate } from '@/lib/gis-heatmap';
import prisma from '@/lib/prisma';
import { extractWardLabel } from '@/services/transparency-service';

export const MIN_AREA_GROUP_SIZE = 5;
export const OTHER_AREA_LABEL = 'Other';
export const MAX_OWN_STATUS_PINS = 200;
export const MAX_AREA_SOURCE_RECORDS = 5000;

export const liveStatusMapQuerySchema = z
  .object({
    status: z.nativeEnum(ComplaintStatus).optional(),
  })
  .strict();

export interface CitizenStatusPin {
  id: string;
  ticketId: string;
  status: string;
  priority: string;
  lat: number;
  lng: number;
  updatedAt: string;
}

export interface AreaStatusCount {
  area: string;
  total: number;
  pending: number;
  inProgress: number;
  resolved: number;
  other: number;
}

export interface CitizenOwnPinSourceRow {
  id: string;
  ticketId: string;
  status: ComplaintStatus | string;
  priority: string | null;
  updatedAt: Date | string;
  location: {
    latitude: number;
    longitude: number;
  } | null;
}

export interface AreaStatusSourceRecord {
  status: ComplaintStatus | string;
  municipality?: {
    name?: string | null;
    city?: string | null;
    state?: string | null;
  } | null;
  location?: {
    address?: string | null;
  } | null;
}

export interface LiveStatusMapDbClient {
  complaint: {
    findMany: (args: {
      where?: Record<string, unknown>;
      select: Record<string, unknown>;
      orderBy?: { updatedAt: 'desc' } | { createdAt: 'desc' };
      take?: number;
    }) => Promise<any[]>;
  };
}

const RESOLVED_STATUSES = new Set<string>([ComplaintStatus.RESOLVED, ComplaintStatus.CLOSED]);
const IN_PROGRESS_STATUSES = new Set<string>([ComplaintStatus.IN_PROGRESS]);
const PENDING_STATUSES = new Set<string>([
  ComplaintStatus.SUBMITTED,
  ComplaintStatus.AI_PROCESSING,
  ComplaintStatus.PENDING_DEPT_REVIEW,
  ComplaintStatus.ASSIGNED,
]);

function incrementStatusBucket(bucket: AreaStatusCount, status: string): void {
  bucket.total += 1;
  if (RESOLVED_STATUSES.has(status)) {
    bucket.resolved += 1;
  } else if (IN_PROGRESS_STATUSES.has(status)) {
    bucket.inProgress += 1;
  } else if (PENDING_STATUSES.has(status)) {
    bucket.pending += 1;
  } else {
    bucket.other += 1;
  }
}

function createEmptyAreaBucket(area: string): AreaStatusCount {
  return {
    area,
    total: 0,
    pending: 0,
    inProgress: 0,
    resolved: 0,
    other: 0,
  };
}

/**
 * Aggregates area-level status counts without coordinates or PII,
 * merging any group with fewer than `minGroupSize` complaints into "Other".
 */
export function aggregateAreaStatusCounts(
  records: AreaStatusSourceRecord[],
  minGroupSize: number = MIN_AREA_GROUP_SIZE,
): AreaStatusCount[] {
  const safeMinGroup = Number.isFinite(minGroupSize) && minGroupSize >= 1 ? Math.trunc(minGroupSize) : MIN_AREA_GROUP_SIZE;
  const rawBuckets = new Map<string, AreaStatusCount>();

  for (const record of records) {
    const rawLabel = extractWardLabel(record.location?.address, record.municipality).trim();
    const areaLabel = !rawLabel || rawLabel === 'Unspecified' ? OTHER_AREA_LABEL : rawLabel;
    const bucket = rawBuckets.get(areaLabel) ?? createEmptyAreaBucket(areaLabel);
    incrementStatusBucket(bucket, String(record.status));
    rawBuckets.set(areaLabel, bucket);
  }

  const results: AreaStatusCount[] = [];
  const otherBucket = createEmptyAreaBucket(OTHER_AREA_LABEL);

  rawBuckets.forEach((bucket, label) => {
    if (label === OTHER_AREA_LABEL || bucket.total < safeMinGroup) {
      otherBucket.total += bucket.total;
      otherBucket.pending += bucket.pending;
      otherBucket.inProgress += bucket.inProgress;
      otherBucket.resolved += bucket.resolved;
      otherBucket.other += bucket.other;
    } else {
      results.push(bucket);
    }
  });

  results.sort((a, b) => {
    if (b.total !== a.total) return b.total - a.total;
    return a.area.localeCompare(b.area);
  });

  if (otherBucket.total > 0) {
    results.push(otherBucket);
  }

  return results;
}

/**
 * Fetches status pins strictly owned by `citizenId` with valid GPS coordinates.
 * Never returns citizen PII or street addresses.
 */
export async function getCitizenOwnStatusPins(
  citizenId: string,
  opts?: { status?: ComplaintStatus },
  db: LiveStatusMapDbClient = prisma as unknown as LiveStatusMapDbClient,
): Promise<CitizenStatusPin[]> {
  const normalizedCitizenId = typeof citizenId === 'string' ? citizenId.trim() : '';
  if (!normalizedCitizenId) {
    return [];
  }

  const where: Record<string, unknown> = {
    citizenId: normalizedCitizenId,
    location: { isNot: null },
  };
  if (opts?.status) {
    where.status = opts.status;
  }

  const rows = (await db.complaint.findMany({
    where,
    select: {
      id: true,
      ticketId: true,
      status: true,
      priority: true,
      updatedAt: true,
      location: {
        select: {
          latitude: true,
          longitude: true,
        },
      },
    },
    orderBy: { updatedAt: 'desc' },
    take: MAX_OWN_STATUS_PINS,
  })) as CitizenOwnPinSourceRow[];

  const pins: CitizenStatusPin[] = [];
  for (const row of rows) {
    if (!row.location || !isValidGisCoordinate(row.location.latitude, row.location.longitude)) {
      continue;
    }

    const updatedAtIso =
      row.updatedAt instanceof Date
        ? row.updatedAt.toISOString()
        : new Date(row.updatedAt).toISOString();

    pins.push({
      id: row.id,
      ticketId: row.ticketId,
      status: String(row.status),
      priority: row.priority || 'MEDIUM',
      lat: row.location.latitude,
      lng: row.location.longitude,
      updatedAt: updatedAtIso,
    });
  }

  return pins;
}

/**
 * Fetches anonymized complaint status counts aggregated by ward/municipality label.
 * Never selects coordinates or individual complaint identifiers.
 */
export async function getAreaStatusCounts(
  db: LiveStatusMapDbClient = prisma as unknown as LiveStatusMapDbClient,
): Promise<AreaStatusCount[]> {
  const rows = (await db.complaint.findMany({
    select: {
      status: true,
      municipality: {
        select: {
          name: true,
          city: true,
          state: true,
        },
      },
      location: {
        select: {
          address: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: MAX_AREA_SOURCE_RECORDS,
  })) as AreaStatusSourceRecord[];

  return aggregateAreaStatusCounts(rows, MIN_AREA_GROUP_SIZE);
}

