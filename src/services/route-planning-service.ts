import { z } from 'zod';
import prisma from '@/lib/prisma';
import { calculateHaversineDistanceMeters } from '@/services/duplicate-service';

export const routePlanQuerySchema = z.object({
  startLat: z.coerce.number().min(-90).max(90).optional(),
  startLng: z.coerce.number().min(-180).max(180).optional(),
  mode: z.enum(['distance', 'priority']).default('distance'),
});

export interface RouteStopInput {
  id: string;
  ticketId: string;
  title: string;
  titleEn?: string | null;
  status: string;
  priority: string | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

export interface PlannedRouteStop extends RouteStopInput {
  sequence: number;
  legDistanceKm: number;
  cumulativeDistanceKm: number;
  estimatedTravelMinutes: number;
}

export interface OptimizedFieldRoute {
  mode: 'distance' | 'priority';
  origin: { lat: number; lng: number } | null;
  totalStops: number;
  totalDistanceKm: number;
  estimatedTotalMinutes: number;
  stops: PlannedRouteStop[];
  unmappedStops: RouteStopInput[];
  googleMapsUrl: string | null;
}

const PRIORITY_WEIGHT: Record<string, number> = {
  CRITICAL: 0.35,
  HIGH: 0.65,
  MEDIUM: 1.0,
  LOW: 1.25,
};

/**
 * Pure nearest-neighbor route optimizer with optional urgency weighting.
 * Uses Haversine distances from `duplicate-service` and separates stops without GPS coordinates.
 */
export function optimizeFieldWorkerRoute(
  items: RouteStopInput[],
  options?: { startLat?: number; startLng?: number; mode?: 'distance' | 'priority' },
): OptimizedFieldRoute {
  const mode = options?.mode ?? 'distance';
  const mapped: Array<RouteStopInput & { latitude: number; longitude: number }> = [];
  const unmappedStops: RouteStopInput[] = [];

  for (const item of items) {
    if (
      typeof item.latitude === 'number' &&
      Number.isFinite(item.latitude) &&
      typeof item.longitude === 'number' &&
      Number.isFinite(item.longitude)
    ) {
      mapped.push({ ...item, latitude: item.latitude, longitude: item.longitude });
    } else {
      unmappedStops.push(item);
    }
  }

  if (mapped.length === 0) {
    return {
      mode,
      origin:
        typeof options?.startLat === 'number' && typeof options?.startLng === 'number'
          ? { lat: options.startLat, lng: options.startLng }
          : null,
      totalStops: unmappedStops.length,
      totalDistanceKm: 0,
      estimatedTotalMinutes: 0,
      stops: [],
      unmappedStops,
      googleMapsUrl: null,
    };
  }

  let currentLat =
    typeof options?.startLat === 'number' ? options.startLat : mapped[0].latitude;
  let currentLng =
    typeof options?.startLng === 'number' ? options.startLng : mapped[0].longitude;

  const origin =
    typeof options?.startLat === 'number' && typeof options?.startLng === 'number'
      ? { lat: options.startLat, lng: options.startLng }
      : { lat: mapped[0].latitude, lng: mapped[0].longitude };

  const remaining = [...mapped];
  const stops: PlannedRouteStop[] = [];
  let cumulativeKm = 0;

  while (remaining.length > 0) {
    let bestIdx = 0;
    let bestScore = Infinity;
    let bestDistanceMeters = 0;

    for (let i = 0; i < remaining.length; i++) {
      const candidate = remaining[i];
      const distMeters = calculateHaversineDistanceMeters(
        currentLat,
        currentLng,
        candidate.latitude,
        candidate.longitude,
      );
      const factor =
        mode === 'priority' ? (PRIORITY_WEIGHT[candidate.priority || 'MEDIUM'] ?? 1.0) : 1.0;
      const score = distMeters * factor;
      if (score < bestScore) {
        bestScore = score;
        bestIdx = i;
        bestDistanceMeters = distMeters;
      }
    }

    const chosen = remaining.splice(bestIdx, 1)[0];
    const legDistanceKm = Math.round((bestDistanceMeters / 1000) * 100) / 100;
    cumulativeKm = Math.round((cumulativeKm + legDistanceKm) * 100) / 100;
    // Assume ~24 km/h urban field vehicle speed (~2.5 min/km)
    const estimatedTravelMinutes = Math.max(legDistanceKm > 0 ? 1 : 0, Math.round(legDistanceKm * 2.5));

    stops.push({
      ...chosen,
      sequence: stops.length + 1,
      legDistanceKm,
      cumulativeDistanceKm: cumulativeKm,
      estimatedTravelMinutes,
    });

    currentLat = chosen.latitude;
    currentLng = chosen.longitude;
  }

  const estimatedTotalMinutes = stops.reduce((sum, s) => sum + s.estimatedTravelMinutes, 0);

  let googleMapsUrl: string | null = null;
  if (stops.length > 0) {
    const originParam = `${origin.lat},${origin.lng}`;
    const destStop = stops[stops.length - 1];
    const destParam = `${destStop.latitude},${destStop.longitude}`;
    const waypoints = stops
      .slice(0, -1)
      .slice(0, 8)
      .map((s) => `${s.latitude},${s.longitude}`)
      .join('|');
    googleMapsUrl = waypoints
      ? `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(originParam)}&destination=${encodeURIComponent(destParam)}&waypoints=${encodeURIComponent(waypoints)}`
      : `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(originParam)}&destination=${encodeURIComponent(destParam)}`;
  }

  return {
    mode,
    origin,
    totalStops: stops.length + unmappedStops.length,
    totalDistanceKm: cumulativeKm,
    estimatedTotalMinutes,
    stops,
    unmappedStops,
    googleMapsUrl,
  };
}

export interface RoutePlanDbClient {
  complaint: {
    findMany: (args: any) => Promise<any[]>;
  };
}

export async function getFieldWorkerPlannedRoute(
  fieldWorkerId: string,
  options?: { startLat?: number; startLng?: number; mode?: 'distance' | 'priority' },
  db: RoutePlanDbClient = prisma as unknown as RoutePlanDbClient,
): Promise<OptimizedFieldRoute> {
  const rows = await db.complaint.findMany({
    where: {
      assignedFieldWorkerId: fieldWorkerId,
      status: { in: ['ASSIGNED', 'IN_PROGRESS'] },
    },
    select: {
      id: true,
      ticketId: true,
      title: true,
      titleEn: true,
      status: true,
      priority: true,
      location: { select: { latitude: true, longitude: true, address: true } },
    },
    orderBy: { createdAt: 'asc' },
    take: 40,
  });

  const stopsInput: RouteStopInput[] = rows.map((r) => ({
    id: r.id,
    ticketId: r.ticketId,
    title: r.title,
    titleEn: r.titleEn ?? null,
    status: r.status,
    priority: r.priority ?? null,
    address: r.location?.address ?? null,
    latitude: r.location?.latitude ?? null,
    longitude: r.location?.longitude ?? null,
  }));

  return optimizeFieldWorkerRoute(stopsInput, options);
}

