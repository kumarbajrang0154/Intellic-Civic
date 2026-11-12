import { ComplaintStatus } from '@prisma/client';
import { z } from 'zod';
import { isValidGisCoordinate } from '@/lib/gis-heatmap';
import prisma from '@/lib/prisma';
import { calculateHaversineDistanceMeters } from '@/services/duplicate-service';

export const SMART_ASSIGNMENT_ALLOWED_ROLES = [
  'SUPER_ADMIN',
  'ADMIN',
  'DEPARTMENT_HEAD',
  'DEPARTMENT_OFFICER',
] as const;

export const ASSIGNABLE_STAFF_ROLES = ['DEPARTMENT_OFFICER', 'FIELD_WORKER'] as const;

export const OPEN_ASSIGNMENT_STATUSES: ComplaintStatus[] = [
  ComplaintStatus.SUBMITTED,
  ComplaintStatus.AI_PROCESSING,
  ComplaintStatus.PENDING_DEPT_REVIEW,
  ComplaintStatus.ASSIGNED,
  ComplaintStatus.IN_PROGRESS,
];

export const MAX_ASSIGNMENT_SUGGESTIONS = 5;
export const WORKLOAD_WEIGHT = 0.6;
export const PROXIMITY_WEIGHT = 0.4;
export const WORKLOAD_SATURATION_COUNT = 10;
export const PROXIMITY_MAX_DISTANCE_METERS = 10_000;
export const NEUTRAL_PROXIMITY_SCORE = 0.5;
export const MAX_ASSIGNED_TASK_SCAN = 1000;

export const assignmentSuggestionsQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(MAX_ASSIGNMENT_SUGGESTIONS).optional(),
    role: z.enum(ASSIGNABLE_STAFF_ROLES).optional(),
  })
  .strict();

export interface AssignmentCandidateLocation {
  latitude: number;
  longitude: number;
}

export interface AssignmentCandidateInput {
  id: string;
  name: string;
  role: string;
  departmentId: string | null;
  openCount: number;
  lastLocation?: AssignmentCandidateLocation | null;
}

export interface AssignmentTargetComplaintInput {
  id: string;
  ticketId?: string;
  departmentId: string | null;
  location?: AssignmentCandidateLocation | null;
}

export interface CandidateScoreResult {
  eligible: boolean;
  score: number;
  distanceMeters: number | null;
  reasons: string[];
}

export interface AssignmentSuggestion {
  id: string;
  name: string;
  role: string;
  departmentId: string;
  openCount: number;
  distanceMeters: number | null;
  score: number;
  reasons: string[];
}

export interface RankCandidatesOptions {
  limit?: number;
  role?: 'DEPARTMENT_OFFICER' | 'FIELD_WORKER';
}

function formatOpenTasksReason(openCount: number): string {
  const safeCount = Math.max(0, Math.trunc(openCount));
  return `${safeCount} open task${safeCount === 1 ? '' : 's'}`;
}

function formatDistanceReason(distanceMeters: number): string {
  if (distanceMeters < 1000) {
    return `nearest task ${Math.round(distanceMeters)} m`;
  }
  return `nearest task ${(distanceMeters / 1000).toFixed(1)} km`;
}

/**
 * Pure heuristic scorer combining open workload and Haversine proximity to
 * a candidate's last known complaint location. Enforces same-department as a hard rule.
 */
export function scoreCandidate(
  candidate: AssignmentCandidateInput,
  complaint: AssignmentTargetComplaintInput,
): CandidateScoreResult {
  const sameDepartment = Boolean(
    complaint.departmentId &&
      candidate.departmentId &&
      candidate.departmentId === complaint.departmentId,
  );

  if (!sameDepartment) {
    return {
      eligible: false,
      score: 0,
      distanceMeters: null,
      reasons: ['different department'],
    };
  }

  const safeOpenCount =
    typeof candidate.openCount === 'number' && Number.isFinite(candidate.openCount)
      ? Math.max(0, Math.trunc(candidate.openCount))
      : 0;

  const workloadScore = Math.max(
    0,
    1 - Math.min(safeOpenCount, WORKLOAD_SATURATION_COUNT) / WORKLOAD_SATURATION_COUNT,
  );

  const hasComplaintGps = isValidGisCoordinate(
    complaint.location?.latitude,
    complaint.location?.longitude,
  );
  const hasCandidateGps = isValidGisCoordinate(
    candidate.lastLocation?.latitude,
    candidate.lastLocation?.longitude,
  );

  let distanceMeters: number | null = null;
  let proximityScore = NEUTRAL_PROXIMITY_SCORE;
  const reasons: string[] = ['same department', formatOpenTasksReason(safeOpenCount)];

  if (hasComplaintGps && hasCandidateGps) {
    const rawMeters = calculateHaversineDistanceMeters(
      complaint.location!.latitude,
      complaint.location!.longitude,
      candidate.lastLocation!.latitude,
      candidate.lastLocation!.longitude,
    );
    distanceMeters = Math.round(rawMeters * 100) / 100;
    proximityScore = Math.max(
      0,
      1 - Math.min(distanceMeters, PROXIMITY_MAX_DISTANCE_METERS) / PROXIMITY_MAX_DISTANCE_METERS,
    );
    reasons.push(formatDistanceReason(distanceMeters));
  } else {
    reasons.push('location unknown (neutral proximity)');
  }

  const combined = WORKLOAD_WEIGHT * workloadScore + PROXIMITY_WEIGHT * proximityScore;
  const clampedScore = Math.round(Math.max(0, Math.min(1, combined)) * 10000) / 10000;

  return {
    eligible: true,
    score: clampedScore,
    distanceMeters,
    reasons,
  };
}

/**
 * Pure ranking function returning up to 5 eligible same-department staff suggestions
 * sorted by descending score, then lower workload, then nearer distance.
 */
export function rankCandidates(
  candidates: AssignmentCandidateInput[],
  complaint: AssignmentTargetComplaintInput,
  opts?: RankCandidatesOptions,
): AssignmentSuggestion[] {
  const requestedLimit =
    typeof opts?.limit === 'number' && Number.isFinite(opts.limit)
      ? Math.trunc(opts.limit)
      : MAX_ASSIGNMENT_SUGGESTIONS;
  const limit = Math.min(MAX_ASSIGNMENT_SUGGESTIONS, Math.max(1, requestedLimit));

  const ranked: AssignmentSuggestion[] = [];

  for (const candidate of candidates) {
    if (opts?.role && candidate.role !== opts.role) {
      continue;
    }

    const result = scoreCandidate(candidate, complaint);
    if (!result.eligible || !candidate.departmentId) {
      continue;
    }

    ranked.push({
      id: candidate.id,
      name: candidate.name,
      role: candidate.role,
      departmentId: candidate.departmentId,
      openCount: Math.max(0, Math.trunc(candidate.openCount)),
      distanceMeters: result.distanceMeters,
      score: result.score,
      reasons: result.reasons,
    });
  }

  ranked.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.openCount !== b.openCount) return a.openCount - b.openCount;
    if (a.distanceMeters !== null && b.distanceMeters !== null) {
      return a.distanceMeters - b.distanceMeters;
    }
    if (a.distanceMeters !== null) return -1;
    if (b.distanceMeters !== null) return 1;
    return a.name.localeCompare(b.name);
  });

  return ranked.slice(0, limit);
}

export interface SmartAssignmentActor {
  role: string;
  departmentId?: string | null;
}

export interface SmartAssignmentDbClient {
  complaint: {
    findUnique: (args: {
      where: { id: string };
      select: Record<string, unknown>;
    }) => Promise<{
      id: string;
      ticketId: string;
      departmentId: string | null;
      location: { latitude: number; longitude: number } | null;
    } | null>;
    findMany: (args: {
      where: Record<string, unknown>;
      select: Record<string, unknown>;
      orderBy: { updatedAt: 'desc' };
      take: number;
    }) => Promise<
      Array<{
        id: string;
        assignedFieldWorkerId: string | null;
        updatedAt: Date;
        assignment: { departmentOfficerId: string } | null;
        location: { latitude: number; longitude: number } | null;
      }>
    >;
  };
  user: {
    findMany: (args: {
      where: Record<string, unknown>;
      select: Record<string, unknown>;
      take?: number;
    }) => Promise<
      Array<{
        id: string;
        name: string;
        role: string | null;
        departmentId: string | null;
      }>
    >;
  };
}

export interface AssignmentCandidatesResult {
  ok: true;
  complaintId: string;
  ticketId: string;
  departmentId: string | null;
  suggestions: AssignmentSuggestion[];
}

export interface AssignmentCandidatesError {
  ok: false;
  statusCode: 403 | 404;
  error: string;
}

/**
 * Loads active officers/field workers in the complaint's department with open task counts
 * and last known complaint coordinates, then ranks suggestions for staff confirmation.
 * Read-only: never auto-assigns or selects citizen PII.
 */
export async function getAssignmentCandidates(
  complaintId: string,
  actor: SmartAssignmentActor,
  opts?: RankCandidatesOptions,
  db: SmartAssignmentDbClient = prisma as unknown as SmartAssignmentDbClient,
): Promise<AssignmentCandidatesResult | AssignmentCandidatesError> {
  if (
    !SMART_ASSIGNMENT_ALLOWED_ROLES.includes(
      actor.role as (typeof SMART_ASSIGNMENT_ALLOWED_ROLES)[number],
    )
  ) {
    return {
      ok: false,
      statusCode: 403,
      error: 'Forbidden: insufficient permissions to view assignment suggestions',
    };
  }

  const complaint = await db.complaint.findUnique({
    where: { id: complaintId },
    select: {
      id: true,
      ticketId: true,
      departmentId: true,
      location: {
        select: {
          latitude: true,
          longitude: true,
        },
      },
    },
  });

  if (!complaint) {
    return {
      ok: false,
      statusCode: 404,
      error: 'Complaint not found',
    };
  }

  if (actor.role === 'DEPARTMENT_HEAD' || actor.role === 'DEPARTMENT_OFFICER') {
    if (!actor.departmentId || complaint.departmentId !== actor.departmentId) {
      return {
        ok: false,
        statusCode: 403,
        error: 'Forbidden: complaint belongs to another department',
      };
    }
  }

  if (!complaint.departmentId) {
    return {
      ok: true,
      complaintId: complaint.id,
      ticketId: complaint.ticketId,
      departmentId: null,
      suggestions: [],
    };
  }

  const roleFilter = opts?.role ? [opts.role] : [...ASSIGNABLE_STAFF_ROLES];

  const staffMembers = await db.user.findMany({
    where: {
      role: { in: roleFilter },
      departmentId: complaint.departmentId,
      isAuthorized: true,
      isSuspended: false,
      deletedAt: null,
    },
    select: {
      id: true,
      name: true,
      role: true,
      departmentId: true,
    },
    take: 100,
  });

  if (staffMembers.length === 0) {
    return {
      ok: true,
      complaintId: complaint.id,
      ticketId: complaint.ticketId,
      departmentId: complaint.departmentId,
      suggestions: [],
    };
  }

  const staffIds = staffMembers.map((member) => member.id);

  const openTasks = await db.complaint.findMany({
    where: {
      status: { in: OPEN_ASSIGNMENT_STATUSES },
      OR: [
        { assignedFieldWorkerId: { in: staffIds } },
        { assignment: { departmentOfficerId: { in: staffIds } } },
      ],
    },
    select: {
      id: true,
      assignedFieldWorkerId: true,
      updatedAt: true,
      assignment: {
        select: {
          departmentOfficerId: true,
        },
      },
      location: {
        select: {
          latitude: true,
          longitude: true,
        },
      },
    },
    orderBy: { updatedAt: 'desc' },
    take: MAX_ASSIGNED_TASK_SCAN,
  });

  const openCounts = new Map<string, number>();
  const lastLocations = new Map<string, AssignmentCandidateLocation>();

  for (const task of openTasks) {
    const assigneeIds = new Set<string>();
    if (task.assignedFieldWorkerId) assigneeIds.add(task.assignedFieldWorkerId);
    if (task.assignment?.departmentOfficerId) assigneeIds.add(task.assignment.departmentOfficerId);

    const hasValidLoc = isValidGisCoordinate(task.location?.latitude, task.location?.longitude);

    assigneeIds.forEach((assigneeId) => {
      openCounts.set(assigneeId, (openCounts.get(assigneeId) ?? 0) + 1);
      if (hasValidLoc && !lastLocations.has(assigneeId)) {
        lastLocations.set(assigneeId, {
          latitude: task.location!.latitude,
          longitude: task.location!.longitude,
        });
      }
    });
  }

  const candidates: AssignmentCandidateInput[] = staffMembers.map((member) => ({
    id: member.id,
    name: member.name,
    role: member.role || 'FIELD_WORKER',
    departmentId: member.departmentId,
    openCount: openCounts.get(member.id) ?? 0,
    lastLocation: lastLocations.get(member.id) ?? null,
  }));

  const suggestions = rankCandidates(candidates, complaint, opts);

  return {
    ok: true,
    complaintId: complaint.id,
    ticketId: complaint.ticketId,
    departmentId: complaint.departmentId,
    suggestions,
  };
}

