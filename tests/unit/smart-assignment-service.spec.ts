import { test, expect } from '@playwright/test';
import {
  assignmentSuggestionsQuerySchema,
  getAssignmentCandidates,
  MAX_ASSIGNMENT_SUGGESTIONS,
  NEUTRAL_PROXIMITY_SCORE,
  PROXIMITY_WEIGHT,
  rankCandidates,
  scoreCandidate,
  WORKLOAD_WEIGHT,
  type AssignmentCandidateInput,
  type AssignmentTargetComplaintInput,
  type SmartAssignmentDbClient,
} from '@/services/smart-assignment-service';

test.describe('Smart Assignment Service — Candidate Scoring, Ranking & Privacy', () => {
  const baseComplaint: AssignmentTargetComplaintInput = {
    id: 'cmp-1',
    ticketId: 'IC-2026-900',
    departmentId: 'dept-roads',
    location: { latitude: 12.9716, longitude: 77.5946 },
  };

  test('lower workload ranks higher and different department is hard-excluded', () => {
    const lowWorkload: AssignmentCandidateInput = {
      id: 'u-low',
      name: 'Asha Officer',
      role: 'DEPARTMENT_OFFICER',
      departmentId: 'dept-roads',
      openCount: 1,
      lastLocation: { latitude: 12.9716, longitude: 77.5946 },
    };
    const highWorkload: AssignmentCandidateInput = {
      id: 'u-high',
      name: 'Bala Officer',
      role: 'DEPARTMENT_OFFICER',
      departmentId: 'dept-roads',
      openCount: 8,
      lastLocation: { latitude: 12.9716, longitude: 77.5946 },
    };
    const wrongDepartment: AssignmentCandidateInput = {
      id: 'u-other',
      name: 'Other Dept Officer',
      role: 'DEPARTMENT_OFFICER',
      departmentId: 'dept-water',
      openCount: 0,
      lastLocation: { latitude: 12.9716, longitude: 77.5946 },
    };

    const wrongScore = scoreCandidate(wrongDepartment, baseComplaint);
    expect(wrongScore.eligible).toBe(false);
    expect(wrongScore.score).toBe(0);
    expect(wrongScore.reasons).toContain('different department');

    const ranked = rankCandidates([wrongDepartment, highWorkload, lowWorkload], baseComplaint);
    expect(ranked.map((r) => r.id)).toEqual(['u-low', 'u-high']);
    expect(ranked[0].score).toBeGreaterThan(ranked[1].score);
    expect(ranked[0].reasons).toContain('same department');
    expect(ranked[0].reasons).toContain('1 open task');
    expect(ranked[1].reasons).toContain('8 open tasks');
  });

  test('nearer location ranks higher when workload is equal', () => {
    const nearWorker: AssignmentCandidateInput = {
      id: 'fw-near',
      name: 'Near Worker',
      role: 'FIELD_WORKER',
      departmentId: 'dept-roads',
      openCount: 3,
      lastLocation: { latitude: 12.9725, longitude: 77.5946 }, // ~100 m north
    };
    const farWorker: AssignmentCandidateInput = {
      id: 'fw-far',
      name: 'Far Worker',
      role: 'FIELD_WORKER',
      departmentId: 'dept-roads',
      openCount: 3,
      lastLocation: { latitude: 13.0216, longitude: 77.5946 }, // ~5.56 km north
    };

    const ranked = rankCandidates([farWorker, nearWorker], baseComplaint);
    expect(ranked.map((r) => r.id)).toEqual(['fw-near', 'fw-far']);
    expect(ranked[0].distanceMeters).not.toBeNull();
    expect(ranked[1].distanceMeters).not.toBeNull();
    expect(ranked[0].distanceMeters!).toBeLessThan(200);
    expect(ranked[1].distanceMeters!).toBeGreaterThan(5000);
    expect(ranked[0].score).toBeGreaterThan(ranked[1].score);
    expect(ranked[0].reasons.some((r) => r.startsWith('nearest task '))).toBe(true);
    expect(ranked[1].reasons.some((r) => r.startsWith('nearest task '))).toBe(true);
  });

  test('unknown location receives a neutral proximity score and explicit reason', () => {
    const noLocationCandidate: AssignmentCandidateInput = {
      id: 'fw-noloc',
      name: 'Unassigned Location Worker',
      role: 'FIELD_WORKER',
      departmentId: 'dept-roads',
      openCount: 0,
      lastLocation: null,
    };

    const breakdown = scoreCandidate(noLocationCandidate, baseComplaint);
    expect(breakdown.eligible).toBe(true);
    expect(breakdown.distanceMeters).toBeNull();
    expect(breakdown.score).toBeCloseTo(
      WORKLOAD_WEIGHT * 1 + PROXIMITY_WEIGHT * NEUTRAL_PROXIMITY_SCORE,
      4,
    );
    expect(breakdown.reasons).toContain('same department');
    expect(breakdown.reasons).toContain('0 open tasks');
    expect(breakdown.reasons).toContain('location unknown (neutral proximity)');

    // Also neutral if complaint itself has no GPS coordinates
    const noComplaintLoc: AssignmentTargetComplaintInput = {
      id: 'cmp-noloc',
      departmentId: 'dept-roads',
      location: null,
    };
    const candidateWithLoc: AssignmentCandidateInput = {
      ...noLocationCandidate,
      lastLocation: { latitude: 12.9716, longitude: 77.5946 },
    };
    const noCmpBreakdown = scoreCandidate(candidateWithLoc, noComplaintLoc);
    expect(noCmpBreakdown.distanceMeters).toBeNull();
    expect(noCmpBreakdown.reasons).toContain('location unknown (neutral proximity)');
  });

  test('enforces max 5 cap on ranked suggestions with reasons array', () => {
    expect(MAX_ASSIGNMENT_SUGGESTIONS).toBe(5);

    const pool: AssignmentCandidateInput[] = Array.from({ length: 8 }, (_, idx) => ({
      id: `worker-${idx}`,
      name: `Worker ${idx}`,
      role: 'FIELD_WORKER',
      departmentId: 'dept-roads',
      openCount: idx,
      lastLocation: { latitude: 12.9716 + idx * 0.002, longitude: 77.5946 },
    }));

    const cappedDefault = rankCandidates(pool, baseComplaint);
    expect(cappedDefault).toHaveLength(5);

    const cappedOverLimit = rankCandidates(pool, baseComplaint, { limit: 12 });
    expect(cappedOverLimit).toHaveLength(5);

    for (const item of cappedDefault) {
      expect(Array.isArray(item.reasons)).toBe(true);
      expect(item.reasons.length).toBeGreaterThanOrEqual(3);
    }
  });

  test('getAssignmentCandidates scopes DEPARTMENT_HEAD/OFFICER to own dept and omits all PII', async () => {
    const userSelects: Array<Record<string, unknown>> = [];
    const complaintSelects: Array<Record<string, unknown>> = [];

    const db: SmartAssignmentDbClient = {
      complaint: {
        findUnique: async (args) => {
          complaintSelects.push(args.select);
          if (args.where.id !== 'cmp-roads-1') return null;
          return {
            id: 'cmp-roads-1',
            ticketId: 'IC-2026-999',
            departmentId: 'dept-roads',
            location: { latitude: 12.9716, longitude: 77.5946 },
          };
        },
        findMany: async (args) => {
          complaintSelects.push(args.select);
          return [
            {
              id: 'open-task-1',
              assignedFieldWorkerId: 'fw-busy',
              updatedAt: new Date('2026-11-11T10:00:00.000Z'),
              assignment: null,
              location: { latitude: 12.99, longitude: 77.61 },
            },
            {
              id: 'open-task-2',
              assignedFieldWorkerId: 'fw-busy',
              updatedAt: new Date('2026-11-10T10:00:00.000Z'),
              assignment: null,
              location: { latitude: 12.9716, longitude: 77.5946 },
            },
          ];
        },
      },
      user: {
        findMany: async (args) => {
          userSelects.push(args.select);
          return [
            {
              id: 'fw-free',
              name: 'Free Worker',
              role: 'FIELD_WORKER',
              departmentId: 'dept-roads',
              email: 'secret@city.gov',
              mobileNumber: '9999999999',
            },
            {
              id: 'fw-busy',
              name: 'Busy Worker',
              role: 'FIELD_WORKER',
              departmentId: 'dept-roads',
              email: 'busy@city.gov',
            },
          ] as any;
        },
      },
    };

    // Wrong department fails closed with 403
    const crossDept = await getAssignmentCandidates(
      'cmp-roads-1',
      { role: 'DEPARTMENT_HEAD', departmentId: 'dept-water' },
      {},
      db,
    );
    expect(crossDept).toEqual({
      ok: false,
      statusCode: 403,
      error: 'Forbidden: complaint belongs to another department',
    });

    // Missing complaint fails closed with 404
    const missing = await getAssignmentCandidates(
      'cmp-missing',
      { role: 'ADMIN' },
      {},
      db,
    );
    expect(missing).toEqual({
      ok: false,
      statusCode: 404,
      error: 'Complaint not found',
    });

    // Authorized DEPARTMENT_OFFICER sees matching department suggestions sorted cleanly with zero PII
    const res = await getAssignmentCandidates(
      'cmp-roads-1',
      { role: 'DEPARTMENT_OFFICER', departmentId: 'dept-roads' },
      {},
      db,
    );
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.suggestions.map((s) => s.id)).toEqual(['fw-free', 'fw-busy']);
      expect(res.suggestions[0].openCount).toBe(0);
      expect(res.suggestions[1].openCount).toBe(2);

      for (const s of res.suggestions) {
        const keys = Object.keys(s).sort();
        expect(keys).toEqual([
          'departmentId',
          'distanceMeters',
          'id',
          'name',
          'openCount',
          'reasons',
          'role',
          'score',
        ]);
        for (const piiKey of [
          'email',
          'mobileNumber',
          'citizen',
          'citizenId',
          'citizenName',
          'address',
          'lastLocation',
        ]) {
          expect((s as unknown as Record<string, unknown>)[piiKey]).toBeUndefined();
        }
      }
    }

    // Verify Prisma queries select zero PII
    expect(userSelects[0].email).toBeUndefined();
    expect(userSelects[0].mobileNumber).toBeUndefined();
    expect(userSelects[0].address).toBeUndefined();
    for (const sel of complaintSelects) {
      expect(sel.citizen).toBeUndefined();
      expect(sel.citizenId).toBeUndefined();
      expect(sel.title).toBeUndefined();
    }

    expect(assignmentSuggestionsQuerySchema.safeParse({ limit: 3, role: 'FIELD_WORKER' }).success).toBe(true);
    expect(assignmentSuggestionsQuerySchema.safeParse({ limit: 10 }).success).toBe(false);
  });
});
