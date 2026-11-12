import { ComplaintStatus } from '@prisma/client';
import prisma from '@/lib/prisma';

export const DUPLICATE_ALLOWED_ROLES = [
  'SUPER_ADMIN',
  'ADMIN',
  'DEPARTMENT_HEAD',
] as const;

export const DUPLICATE_SIMILARITY_THRESHOLD = 0.4;
export const DUPLICATE_MAX_GEO_DISTANCE_METERS = 1000;
export const DUPLICATE_TEXT_WEIGHT_WITH_GEO = 0.65;
export const DUPLICATE_GEO_WEIGHT = 0.35;
export const DUPLICATE_MIN_TEXT_FOR_GEO_BONUS = 0.1;
export const DUPLICATE_SAME_DEPARTMENT_BOOST = 0.08;
export const MAX_DUPLICATE_RESULTS = 5;
export const MAX_DUPLICATE_CANDIDATE_POOL = 200;

export const TERMINAL_DUPLICATE_STATUSES = new Set<string>([
  ComplaintStatus.RESOLVED,
  ComplaintStatus.CLOSED,
  ComplaintStatus.REJECTED,
  ComplaintStatus.DUPLICATE,
]);

export const ACTIVE_COMPLAINT_STATUS_LIST: ComplaintStatus[] = [
  ComplaintStatus.SUBMITTED,
  ComplaintStatus.AI_PROCESSING,
  ComplaintStatus.PENDING_DEPT_REVIEW,
  ComplaintStatus.ASSIGNED,
  ComplaintStatus.IN_PROGRESS,
];

export const ACTIVE_DUPLICATE_STATUSES = new Set<string>(ACTIVE_COMPLAINT_STATUS_LIST);

const EARTH_RADIUS_METERS = 6_371_000;

const DUPLICATE_STOPWORDS = new Set<string>([
  'a',
  'an',
  'and',
  'are',
  'as',
  'at',
  'be',
  'been',
  'being',
  'but',
  'by',
  'can',
  'could',
  'did',
  'do',
  'does',
  'for',
  'from',
  'had',
  'has',
  'have',
  'here',
  'how',
  'in',
  'into',
  'is',
  'it',
  'its',
  'may',
  'might',
  'my',
  'near',
  'no',
  'not',
  'of',
  'on',
  'or',
  'our',
  'out',
  'over',
  'please',
  'she',
  'he',
  'they',
  'so',
  'some',
  'such',
  'than',
  'that',
  'the',
  'their',
  'them',
  'then',
  'there',
  'these',
  'this',
  'those',
  'to',
  'too',
  'under',
  'up',
  'very',
  'was',
  'we',
  'were',
  'what',
  'when',
  'where',
  'which',
  'who',
  'will',
  'with',
  'would',
  'you',
  'your',
]);

export interface DuplicateGpsCoordinates {
  latitude?: number | null;
  longitude?: number | null;
}

export interface DuplicateComplaintInput {
  id?: string;
  ticketId?: string;
  title: string;
  description?: string | null;
  status?: string | null;
  departmentId?: string | null;
  department?: { name?: string | null } | null;
  departmentName?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  location?: DuplicateGpsCoordinates | null;
  createdAt?: Date | string | null;
}

export interface SimilarityScoreBreakdown {
  score: number;
  textSimilarity: number;
  distanceMeters: number | null;
}

export interface FindPossibleDuplicatesOptions {
  threshold?: number;
  limit?: number;
  maxDistanceMeters?: number;
}

export interface PossibleDuplicateMatch {
  complaintId: string;
  ticketId: string;
  title: string;
  status: string;
  departmentId: string | null;
  departmentName: string | null;
  sameDepartment: boolean;
  distanceMeters: number | null;
  similarityScore: number;
  createdAt: string | null;
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function isValidLatitude(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= -90 && value <= 90;
}

function isValidLongitude(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= -180 && value <= 180;
}

function extractGpsCoordinates(
  input: DuplicateComplaintInput,
): { latitude: number; longitude: number } | null {
  const lat = input.location?.latitude ?? input.latitude;
  const lon = input.location?.longitude ?? input.longitude;
  if (!isValidLatitude(lat) || !isValidLongitude(lon)) {
    return null;
  }
  return { latitude: lat, longitude: lon };
}

/**
 * Computes great-circle distance in meters using the Haversine formula.
 */
export function calculateHaversineDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_METERS * c;
}

/**
 * Tokenizes text into lowercased alphanumeric words >= 2 chars, excluding stopwords.
 */
export function tokenizeForSimilarity(text: string): Set<string> {
  const cleaned = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length >= 2 && !DUPLICATE_STOPWORDS.has(token));

  return new Set(cleaned);
}

/**
 * Computes token Jaccard similarity (0..1) on lowercased non-stopword tokens.
 */
export function computeTokenJaccardSimilarity(textA: string, textB: string): number {
  const tokensA = tokenizeForSimilarity(textA);
  const tokensB = tokenizeForSimilarity(textB);

  if (tokensA.size === 0 || tokensB.size === 0) {
    return 0;
  }

  let intersection = 0;
  tokensA.forEach((token) => {
    if (tokensB.has(token)) {
      intersection++;
    }
  });

  const union = tokensA.size + tokensB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Pure duplicate similarity scoring combining token Jaccard text similarity
 * with Haversine GPS proximity when both complaints carry valid coordinates.
 */
export function scoreSimilarity(
  a: DuplicateComplaintInput,
  b: DuplicateComplaintInput,
  opts?: { maxDistanceMeters?: number },
): SimilarityScoreBreakdown {
  const fullTextA = `${a.title || ''} ${a.description || ''}`.trim();
  const fullTextB = `${b.title || ''} ${b.description || ''}`.trim();
  const textSimilarity = computeTokenJaccardSimilarity(fullTextA, fullTextB);

  const coordsA = extractGpsCoordinates(a);
  const coordsB = extractGpsCoordinates(b);

  let distanceMeters: number | null = null;
  if (coordsA && coordsB) {
    const rawMeters = calculateHaversineDistanceMeters(
      coordsA.latitude,
      coordsA.longitude,
      coordsB.latitude,
      coordsB.longitude,
    );
    distanceMeters = Math.round(rawMeters * 100) / 100;
  }

  let rawScore = textSimilarity;
  if (distanceMeters !== null) {
    const maxRadius =
      typeof opts?.maxDistanceMeters === 'number' &&
      Number.isFinite(opts.maxDistanceMeters) &&
      opts.maxDistanceMeters > 0
        ? opts.maxDistanceMeters
        : DUPLICATE_MAX_GEO_DISTANCE_METERS;

    const proximityScore = Math.max(0, 1 - Math.min(distanceMeters, maxRadius) / maxRadius);
    const effectiveProximity =
      textSimilarity >= DUPLICATE_MIN_TEXT_FOR_GEO_BONUS ? proximityScore : 0;

    rawScore =
      textSimilarity >= DUPLICATE_MIN_TEXT_FOR_GEO_BONUS
        ? DUPLICATE_TEXT_WEIGHT_WITH_GEO * textSimilarity +
          DUPLICATE_GEO_WEIGHT * effectiveProximity
        : 0;
  }

  const clampedScore = Math.max(0, Math.min(1, rawScore));

  return {
    score: Math.round(clampedScore * 10000) / 10000,
    textSimilarity: Math.round(textSimilarity * 10000) / 10000,
    distanceMeters,
  };
}

function isSameComplaintIdentity(
  a: DuplicateComplaintInput,
  b: DuplicateComplaintInput,
): boolean {
  if (a.id && b.id && a.id === b.id) return true;
  if (a.ticketId && b.ticketId && a.ticketId === b.ticketId) return true;
  return false;
}

function isActiveDuplicateCandidateStatus(status: string | null | undefined): boolean {
  if (!status) return false;
  if (TERMINAL_DUPLICATE_STATUSES.has(status)) return false;
  return ACTIVE_DUPLICATE_STATUSES.has(status);
}

/**
 * Pure ranking function returning up to 5 active, non-terminal duplicate candidates
 * above threshold, preferring candidates in the same department. Never mutates state.
 */
export function findPossibleDuplicates(
  complaint: DuplicateComplaintInput,
  candidates: DuplicateComplaintInput[],
  opts?: FindPossibleDuplicatesOptions,
): PossibleDuplicateMatch[] {
  const threshold =
    typeof opts?.threshold === 'number' && Number.isFinite(opts.threshold)
      ? Math.max(0, Math.min(1, opts.threshold))
      : DUPLICATE_SIMILARITY_THRESHOLD;

  const requestedLimit =
    typeof opts?.limit === 'number' && Number.isFinite(opts.limit)
      ? Math.trunc(opts.limit)
      : MAX_DUPLICATE_RESULTS;
  const limit = Math.min(MAX_DUPLICATE_RESULTS, Math.max(1, requestedLimit));

  const matches: PossibleDuplicateMatch[] = [];

  for (const candidate of candidates) {
    if (isSameComplaintIdentity(complaint, candidate)) {
      continue;
    }
    if (!isActiveDuplicateCandidateStatus(candidate.status)) {
      continue;
    }

    const breakdown = scoreSimilarity(complaint, candidate, {
      maxDistanceMeters: opts?.maxDistanceMeters,
    });

    const sameDepartment = Boolean(
      complaint.departmentId &&
        candidate.departmentId &&
        complaint.departmentId === candidate.departmentId,
    );

    const adjustedScore =
      breakdown.score > 0 && sameDepartment
        ? Math.min(1, Math.round((breakdown.score + DUPLICATE_SAME_DEPARTMENT_BOOST) * 10000) / 10000)
        : breakdown.score;

    if (adjustedScore < threshold) {
      continue;
    }

    const createdAtIso =
      candidate.createdAt instanceof Date
        ? candidate.createdAt.toISOString()
        : typeof candidate.createdAt === 'string'
          ? candidate.createdAt
          : null;

    matches.push({
      complaintId: candidate.id || '',
      ticketId: candidate.ticketId || '',
      title: candidate.title,
      status: String(candidate.status),
      departmentId: candidate.departmentId ?? null,
      departmentName: candidate.department?.name ?? candidate.departmentName ?? null,
      sameDepartment,
      distanceMeters: breakdown.distanceMeters,
      similarityScore: adjustedScore,
      createdAt: createdAtIso,
    });
  }

  matches.sort((left, right) => {
    if (right.similarityScore !== left.similarityScore) {
      return right.similarityScore - left.similarityScore;
    }
    if (left.sameDepartment !== right.sameDepartment) {
      return left.sameDepartment ? -1 : 1;
    }
    if (left.distanceMeters !== null && right.distanceMeters !== null) {
      return left.distanceMeters - right.distanceMeters;
    }
    if (left.distanceMeters !== null) return -1;
    if (right.distanceMeters !== null) return 1;
    return 0;
  });

  return matches.slice(0, limit);
}

export interface DuplicateActor {
  role: string;
  departmentId?: string | null;
}

export interface DuplicateLookupComplaintRow {
  id: string;
  ticketId: string;
  title: string;
  description: string;
  status: ComplaintStatus;
  departmentId: string | null;
  createdAt: Date;
  department: { name: string } | null;
  location: { latitude: number; longitude: number } | null;
}

export interface DuplicateLookupDbClient {
  complaint: {
    findUnique: (args: {
      where: { id: string };
      select: Record<string, unknown>;
    }) => Promise<DuplicateLookupComplaintRow | null>;
    findMany: (args: {
      where: Record<string, unknown>;
      select: Record<string, unknown>;
      orderBy: { createdAt: 'desc' };
      take: number;
    }) => Promise<DuplicateLookupComplaintRow[]>;
  };
}

export interface DuplicateCandidateLookupResult {
  ok: true;
  target: {
    id: string;
    ticketId: string;
    title: string;
    status: ComplaintStatus;
    departmentId: string | null;
  };
  duplicates: PossibleDuplicateMatch[];
}

export interface DuplicateCandidateLookupError {
  ok: false;
  statusCode: 403 | 404;
  error: string;
}

/**
 * Fetches a target complaint and candidate pool from Prisma using non-PII selects only,
 * enforces DEPARTMENT_HEAD scoping, and returns possible duplicates for staff review.
 * Never auto-merges or modifies complaint status.
 */
export async function findDuplicateCandidatesForComplaint(
  complaintId: string,
  actor: DuplicateActor,
  opts?: FindPossibleDuplicatesOptions,
  db: DuplicateLookupDbClient = prisma as unknown as DuplicateLookupDbClient,
): Promise<DuplicateCandidateLookupResult | DuplicateCandidateLookupError> {
  if (
    !DUPLICATE_ALLOWED_ROLES.includes(actor.role as (typeof DUPLICATE_ALLOWED_ROLES)[number])
  ) {
    return {
      ok: false,
      statusCode: 403,
      error: 'Forbidden: insufficient permissions to inspect duplicate candidates',
    };
  }

  const select = {
    id: true,
    ticketId: true,
    title: true,
    description: true,
    status: true,
    departmentId: true,
    createdAt: true,
    department: {
      select: { name: true },
    },
    location: {
      select: {
        latitude: true,
        longitude: true,
      },
    },
  } as const;

  const target = await db.complaint.findUnique({
    where: { id: complaintId },
    select,
  });

  if (!target) {
    return {
      ok: false,
      statusCode: 404,
      error: 'Complaint not found',
    };
  }

  if (actor.role === 'DEPARTMENT_HEAD') {
    if (!actor.departmentId || target.departmentId !== actor.departmentId) {
      return {
        ok: false,
        statusCode: 403,
        error: 'Forbidden: complaint belongs to another department',
      };
    }
  }

  const candidateWhere: Record<string, unknown> = {
    id: { not: target.id },
    status: { in: ACTIVE_COMPLAINT_STATUS_LIST },
  };
  if (actor.role === 'DEPARTMENT_HEAD') {
    candidateWhere.departmentId = actor.departmentId;
  }

  const candidates = await db.complaint.findMany({
    where: candidateWhere,
    select,
    orderBy: { createdAt: 'desc' },
    take: MAX_DUPLICATE_CANDIDATE_POOL,
  });

  const duplicates = findPossibleDuplicates(target, candidates, opts);

  return {
    ok: true,
    target: {
      id: target.id,
      ticketId: target.ticketId,
      title: target.title,
      status: target.status,
      departmentId: target.departmentId,
    },
    duplicates,
  };
}
