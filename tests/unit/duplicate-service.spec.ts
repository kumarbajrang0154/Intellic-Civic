import { test, expect } from '@playwright/test';
import { ComplaintStatus } from '@prisma/client';
import {
  calculateHaversineDistanceMeters,
  DUPLICATE_SIMILARITY_THRESHOLD,
  findDuplicateCandidatesForComplaint,
  findPossibleDuplicates,
  MAX_DUPLICATE_RESULTS,
  scoreSimilarity,
  type DuplicateComplaintInput,
  type DuplicateLookupComplaintRow,
  type DuplicateLookupDbClient,
} from '@/services/duplicate-service';

test.describe('Duplicate Detection Service — Similarity Scoring & Staff Review Ranking', () => {
  test('identical or stopword-variant text scores high while unrelated text scores low', () => {
    const a: DuplicateComplaintInput = {
      id: 'cmp-1',
      ticketId: 'IC-1001',
      title: 'Burst water pipeline on Main Street',
      description: 'The main water pipe is leaking heavily near the junction.',
    };
    const identicalWithStopwords: DuplicateComplaintInput = {
      id: 'cmp-2',
      ticketId: 'IC-1002',
      title: 'A burst water pipeline at Main Street',
      description: 'Main water pipe leaking heavily over at the junction!',
    };
    const unrelated: DuplicateComplaintInput = {
      id: 'cmp-3',
      ticketId: 'IC-1003',
      title: 'Streetlight pole flickering near school park',
      description: 'Electrical lamp outage during evening hours.',
      latitude: 28.6139,
      longitude: 77.209,
    };
    const aWithGeo: DuplicateComplaintInput = {
      ...a,
      latitude: 28.6139,
      longitude: 77.209,
    };

    const high = scoreSimilarity(a, identicalWithStopwords);
    expect(high.textSimilarity).toBe(1);
    expect(high.score).toBe(1);
    expect(high.distanceMeters).toBeNull();

    const lowNoGeo = scoreSimilarity(a, unrelated);
    expect(lowNoGeo.textSimilarity).toBe(0);
    expect(lowNoGeo.score).toBe(0);
    expect(lowNoGeo.score).toBeLessThan(DUPLICATE_SIMILARITY_THRESHOLD);

    // Even when co-located at the exact same GPS coordinates, unrelated text must score low
    const lowSameGeo = scoreSimilarity(aWithGeo, unrelated);
    expect(lowSameGeo.distanceMeters).toBe(0);
    expect(lowSameGeo.score).toBe(0);
    expect(lowSameGeo.score).toBeLessThan(DUPLICATE_SIMILARITY_THRESHOLD);
  });

  test('computes Haversine GPS distance accurately in meters and incorporates nearby proximity', () => {
    // 0.01 deg latitude along meridian at equator ~= 1,111.95 m (Earth R = 6,371,000 m)
    const oneHundredthLatDeg = calculateHaversineDistanceMeters(0, 0, 0.01, 0);
    expect(oneHundredthLatDeg).toBeGreaterThan(1110);
    expect(oneHundredthLatDeg).toBeLessThan(1114);

    // Identical coordinates = 0 m
    expect(calculateHaversineDistanceMeters(28.6139, 77.209, 28.6139, 77.209)).toBe(0);

    // Known ~1.11 km vs ~100 m comparison with same partial text overlap
    const base: DuplicateComplaintInput = {
      id: 'c-base',
      title: 'Water leakage Main Road junction',
      description: 'Broken valve flooding footpath',
      latitude: 28.6139,
      longitude: 77.209,
    };
    const nearby: DuplicateComplaintInput = {
      id: 'c-near',
      title: 'Water leakage Main Road',
      description: 'Drain overflow traffic jam',
      latitude: 28.6148, // ~100 m north
      longitude: 77.209,
    };
    const farAway: DuplicateComplaintInput = {
      id: 'c-far',
      title: 'Water leakage Main Road',
      description: 'Drain overflow traffic jam',
      latitude: 28.7139, // ~11.12 km north
      longitude: 77.209,
    };

    const nearScore = scoreSimilarity(base, nearby);
    const farScore = scoreSimilarity(base, farAway);

    expect(nearScore.distanceMeters).not.toBeNull();
    expect(nearScore.distanceMeters!).toBeGreaterThan(95);
    expect(nearScore.distanceMeters!).toBeLessThan(105);
    expect(farScore.distanceMeters!).toBeGreaterThan(11000);
    expect(nearScore.score).toBeGreaterThan(farScore.score);
  });

  test('excludes terminal statuses and self, includes only active statuses', () => {
    const target: DuplicateComplaintInput = {
      id: 'target-1',
      ticketId: 'IC-500',
      title: 'Overflowing garbage bin Sector 9',
      description: 'Solid waste uncollected for three days',
      status: ComplaintStatus.SUBMITTED,
      departmentId: 'dept-sanitation',
    };

    const candidates: DuplicateComplaintInput[] = [
      { ...target }, // Self must be ignored
      {
        id: 'c-res',
        ticketId: 'IC-501',
        title: target.title,
        description: target.description,
        status: ComplaintStatus.RESOLVED,
        departmentId: 'dept-sanitation',
      },
      {
        id: 'c-closed',
        ticketId: 'IC-502',
        title: target.title,
        description: target.description,
        status: ComplaintStatus.CLOSED,
        departmentId: 'dept-sanitation',
      },
      {
        id: 'c-rej',
        ticketId: 'IC-503',
        title: target.title,
        description: target.description,
        status: ComplaintStatus.REJECTED,
        departmentId: 'dept-sanitation',
      },
      {
        id: 'c-dup',
        ticketId: 'IC-504',
        title: target.title,
        description: target.description,
        status: ComplaintStatus.DUPLICATE,
        departmentId: 'dept-sanitation',
      },
      {
        id: 'c-active',
        ticketId: 'IC-505',
        title: target.title,
        description: target.description,
        status: ComplaintStatus.IN_PROGRESS,
        departmentId: 'dept-sanitation',
      },
    ];

    const matches = findPossibleDuplicates(target, candidates);
    expect(matches.map((m) => m.ticketId)).toEqual(['IC-505']);
  });

  test('prefers same department and enforces hard cap of max 5 results', () => {
    const target: DuplicateComplaintInput = {
      id: 'target-2',
      ticketId: 'IC-600',
      title: 'Deep pothole near metro station gate',
      description: 'Road asphalt damaged causing two-wheeler accidents',
      status: ComplaintStatus.PENDING_DEPT_REVIEW,
      departmentId: 'dept-roads',
    };

    const crossDeptMatch: DuplicateComplaintInput = {
      id: 'c-other-dept',
      ticketId: 'IC-601',
      title: 'Deep pothole near metro station gate',
      description: 'Road asphalt damaged causing accidents',
      status: ComplaintStatus.SUBMITTED,
      departmentId: 'dept-transport',
      departmentName: 'Transport',
    };

    const sameDeptMatch: DuplicateComplaintInput = {
      id: 'c-same-dept',
      ticketId: 'IC-602',
      title: 'Deep pothole near metro station gate',
      description: 'Road asphalt damaged causing accidents',
      status: ComplaintStatus.SUBMITTED,
      departmentId: 'dept-roads',
      departmentName: 'Roads & Bridges',
    };

    const preferred = findPossibleDuplicates(target, [crossDeptMatch, sameDeptMatch]);
    expect(preferred).toHaveLength(2);
    expect(preferred[0].ticketId).toBe('IC-602');
    expect(preferred[0].sameDepartment).toBe(true);
    expect(preferred[0].similarityScore).toBeGreaterThan(preferred[1].similarityScore);

    // Generate 8 strong matches and verify hard cap of 5 even if caller asks for limit: 20
    const manyMatches: DuplicateComplaintInput[] = Array.from({ length: 8 }, (_, idx) => ({
      id: `c-bulk-${idx}`,
      ticketId: `IC-70${idx}`,
      title: 'Deep pothole near metro station gate',
      description: 'Road asphalt damaged causing two-wheeler accidents',
      status: ComplaintStatus.ASSIGNED,
      departmentId: 'dept-roads',
    }));

    const capped = findPossibleDuplicates(target, manyMatches, { limit: 20 });
    expect(MAX_DUPLICATE_RESULTS).toBe(5);
    expect(capped).toHaveLength(5);
  });

  test('lookup omits citizen PII, enforces DEPARTMENT_HEAD scoping, and never auto-merges', async () => {
    const targetRow: DuplicateLookupComplaintRow & Record<string, unknown> = {
      id: 'cmp-target',
      ticketId: 'IC-800',
      title: 'Broken storm drain cover outside hospital',
      description: 'Open drain cover poses hazard to pedestrians',
      status: ComplaintStatus.SUBMITTED,
      departmentId: 'dept-roads',
      createdAt: new Date('2026-11-10T08:00:00.000Z'),
      department: { name: 'Roads' },
      location: { latitude: 28.6139, longitude: 77.209 },
      // Extra citizen PII injected on raw mock to verify non-exposure
      citizenId: 'cit-secret-1',
      citizenName: 'Secret Citizen',
      citizenMobile: '9999999999',
    };

    const candidateRows: Array<DuplicateLookupComplaintRow & Record<string, unknown>> = [
      {
        id: 'cmp-match-1',
        ticketId: 'IC-801',
        title: 'Broken storm drain cover outside hospital',
        description: 'Open drain cover poses hazard to pedestrians',
        status: ComplaintStatus.ASSIGNED,
        departmentId: 'dept-roads',
        createdAt: new Date('2026-11-09T12:00:00.000Z'),
        department: { name: 'Roads' },
        location: { latitude: 28.614, longitude: 77.209 },
        citizenId: 'cit-secret-2',
        citizenName: 'Other Citizen',
        citizenMobile: '8888888888',
      },
      {
        id: 'cmp-match-other-dept',
        ticketId: 'IC-802',
        title: 'Broken storm drain cover outside hospital',
        description: 'Open drain cover poses hazard to pedestrians',
        status: ComplaintStatus.ASSIGNED,
        departmentId: 'dept-water',
        createdAt: new Date('2026-11-09T11:00:00.000Z'),
        department: { name: 'Water' },
        location: { latitude: 28.614, longitude: 77.209 },
      },
    ];

    const capturedSelects: Array<Record<string, unknown>> = [];
    const capturedWheres: Array<Record<string, unknown>> = [];

    const db: DuplicateLookupDbClient = {
      complaint: {
        findUnique: async (args) => {
          capturedSelects.push(args.select);
          return args.where.id === 'cmp-target' ? targetRow : null;
        },
        findMany: async (args) => {
          capturedSelects.push(args.select);
          capturedWheres.push(args.where);
          return candidateRows.filter((c) => {
            if (typeof args.where.departmentId === 'string') {
              return c.departmentId === args.where.departmentId;
            }
            return true;
          });
        },
      },
    };

    // DEPARTMENT_HEAD of different department gets 403
    const wrongDept = await findDuplicateCandidatesForComplaint(
      'cmp-target',
      { role: 'DEPARTMENT_HEAD', departmentId: 'dept-water' },
      {},
      db,
    );
    expect(wrongDept).toEqual({
      ok: false,
      statusCode: 403,
      error: 'Forbidden: complaint belongs to another department',
    });

    // Missing complaint gets 404
    const missing = await findDuplicateCandidatesForComplaint(
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

    // DEPARTMENT_HEAD of matching department succeeds and sees only own department candidates
    const deptHeadRes = await findDuplicateCandidatesForComplaint(
      'cmp-target',
      { role: 'DEPARTMENT_HEAD', departmentId: 'dept-roads' },
      {},
      db,
    );
    expect(deptHeadRes.ok).toBe(true);
    if (deptHeadRes.ok) {
      expect(deptHeadRes.duplicates.map((d) => d.ticketId)).toEqual(['IC-801']);
      const matchKeys = Object.keys(deptHeadRes.duplicates[0]);
      for (const piiKey of [
        'citizen',
        'citizenId',
        'citizenName',
        'citizenMobile',
        'email',
        'address',
      ]) {
        expect(matchKeys).not.toContain(piiKey);
      }
      expect(matchKeys).toContain('ticketId');
      expect(matchKeys).toContain('title');
      expect(matchKeys).toContain('status');
      expect(matchKeys).toContain('distanceMeters');
      expect(matchKeys).toContain('similarityScore');
    }

    // Verify Prisma selects omit citizen relation/PII and address
    for (const sel of capturedSelects) {
      expect(sel.citizen).toBeUndefined();
      expect(sel.citizenId).toBeUndefined();
      expect(sel.location).toEqual({ select: { latitude: true, longitude: true } });
    }
    expect(capturedWheres[0].departmentId).toBe('dept-roads');
  });
});
