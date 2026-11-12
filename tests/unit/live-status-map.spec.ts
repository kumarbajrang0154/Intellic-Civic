import { test, expect } from '@playwright/test';
import { ComplaintStatus, PriorityLevel } from '@prisma/client';
import {
  aggregateAreaStatusCounts,
  getAreaStatusCounts,
  getCitizenOwnStatusPins,
  liveStatusMapQuerySchema,
  MIN_AREA_GROUP_SIZE,
  OTHER_AREA_LABEL,
  type LiveStatusMapDbClient,
} from '@/services/live-status-map-service';

test.describe('Citizen Live Status Map Service — Ownership, Aggregation & Privacy', () => {
  test('own pins query strictly filters by citizenId and never leaks another citizen coordinates', async () => {
    const records = [
      {
        id: 'cmp-a1',
        ticketId: 'IC-2026-001',
        status: ComplaintStatus.IN_PROGRESS,
        priority: PriorityLevel.HIGH,
        citizenId: 'cit-1',
        updatedAt: new Date('2026-11-11T10:00:00.000Z'),
        location: { latitude: 12.9716, longitude: 77.5946, address: '10 Private Street' },
        citizenName: 'Alice Citizen',
        citizenMobile: '9999999991',
      },
      {
        id: 'cmp-a2-zero',
        ticketId: 'IC-2026-002',
        status: ComplaintStatus.SUBMITTED,
        priority: PriorityLevel.LOW,
        citizenId: 'cit-1',
        updatedAt: new Date('2026-11-10T10:00:00.000Z'),
        location: { latitude: 0, longitude: 0, address: 'Null Island' },
      },
      {
        id: 'cmp-b1-other-citizen',
        ticketId: 'IC-2026-003',
        status: ComplaintStatus.ASSIGNED,
        priority: PriorityLevel.CRITICAL,
        citizenId: 'cit-2',
        updatedAt: new Date('2026-11-11T12:00:00.000Z'),
        location: { latitude: 13.01, longitude: 77.62, address: '99 Other Home Road' },
        citizenName: 'Bob Citizen',
      },
    ];

    const capturedQueries: Array<{ where?: Record<string, unknown>; select: Record<string, unknown> }> = [];
    const db: LiveStatusMapDbClient = {
      complaint: {
        findMany: async (args) => {
          capturedQueries.push({ where: args.where, select: args.select });
          return records.filter((r) => {
            if (args.where?.citizenId && r.citizenId !== args.where.citizenId) return false;
            if (args.where?.location && !r.location) return false;
            return true;
          });
        },
      },
    };

    const emptyCitizenPins = await getCitizenOwnStatusPins('   ', {}, db);
    expect(emptyCitizenPins).toEqual([]);
    expect(capturedQueries).toHaveLength(0);

    const pins = await getCitizenOwnStatusPins('cit-1', {}, db);
    expect(capturedQueries).toHaveLength(1);
    expect(capturedQueries[0].where).toEqual({
      citizenId: 'cit-1',
      location: { isNot: null },
    });

    // Strictly own valid coordinates only; cit-2 and (0,0) excluded
    expect(pins).toHaveLength(1);
    expect(pins[0]).toEqual({
      id: 'cmp-a1',
      ticketId: 'IC-2026-001',
      status: 'IN_PROGRESS',
      priority: 'HIGH',
      lat: 12.9716,
      lng: 77.5946,
      updatedAt: '2026-11-11T10:00:00.000Z',
    });

    // Verify Prisma select & returned pin contain zero PII fields
    const sel = capturedQueries[0].select;
    expect(sel.citizenId).toBeUndefined();
    expect(sel.citizen).toBeUndefined();
    expect(sel.location).toEqual({ select: { latitude: true, longitude: true } });
    for (const piiKey of [
      'citizenId',
      'citizen',
      'citizenName',
      'citizenMobile',
      'email',
      'phone',
      'address',
    ]) {
      expect((pins[0] as unknown as Record<string, unknown>)[piiKey]).toBeUndefined();
    }
  });

  test('area counts enforce min group size 5 by merging smaller wards into Other without coordinates or PII', async () => {
    expect(MIN_AREA_GROUP_SIZE).toBe(5);
    expect(OTHER_AREA_LABEL).toBe('Other');

    const sourceRecords = [
      // 6 records in Ward 4 (>= 5 -> kept as named group)
      ...Array.from({ length: 4 }, () => ({
        status: ComplaintStatus.SUBMITTED,
        location: { address: '14 Elm Street, Ward 4, Bengaluru' },
        municipality: { name: 'Bengaluru Civic', city: 'Bengaluru', state: 'Karnataka' },
      })),
      {
        status: ComplaintStatus.IN_PROGRESS,
        location: { address: 'Ward No. 4 Market' },
        municipality: { name: 'Bengaluru Civic', city: 'Bengaluru', state: 'Karnataka' },
      },
      {
        status: ComplaintStatus.RESOLVED,
        location: { address: 'East Market, Ward 4' },
        municipality: { name: 'Bengaluru Civic', city: 'Bengaluru', state: 'Karnataka' },
      },
      // 3 records in Ward 9 (< 5 -> must merge into Other)
      ...Array.from({ length: 3 }, () => ({
        status: ComplaintStatus.ASSIGNED,
        location: { address: 'Ward 9 Main Road' },
        municipality: { name: 'Bengaluru Civic', city: 'Bengaluru', state: 'Karnataka' },
      })),
      // 1 record with raw coordinate-like label (< 5 -> merged into Other)
      {
        status: ComplaintStatus.CLOSED,
        location: { address: 'Location at (12.9716, 77.5946)' },
        municipality: null,
      },
    ];

    const aggregated = aggregateAreaStatusCounts(sourceRecords);
    expect(aggregated).toEqual([
      {
        area: 'Ward 4',
        total: 6,
        pending: 4,
        inProgress: 1,
        resolved: 1,
        other: 0,
      },
      {
        area: 'Other',
        total: 4,
        pending: 3,
        inProgress: 0,
        resolved: 1,
        other: 0,
      },
    ]);

    // Ensure getAreaStatusCounts never requests coordinates or citizen fields
    const capturedSelects: Array<Record<string, unknown>> = [];
    const mockDb: LiveStatusMapDbClient = {
      complaint: {
        findMany: async (args) => {
          capturedSelects.push(args.select);
          return sourceRecords;
        },
      },
    };

    const areas = await getAreaStatusCounts(mockDb);
    expect(areas).toEqual(aggregated);
    expect(capturedSelects).toHaveLength(1);
    expect(capturedSelects[0].citizenId).toBeUndefined();
    expect(capturedSelects[0].citizen).toBeUndefined();
    expect(capturedSelects[0].location).toEqual({ select: { address: true } });

    for (const row of areas) {
      for (const forbiddenKey of [
        'lat',
        'lng',
        'latitude',
        'longitude',
        'citizenId',
        'citizenName',
        'citizenMobile',
        'email',
        'address',
        'ticketId',
      ]) {
        expect((row as unknown as Record<string, unknown>)[forbiddenKey]).toBeUndefined();
      }
    }
  });

  test('query schema validates optional status and rejects unknown params or invalid enum values', () => {
    expect(liveStatusMapQuerySchema.safeParse({}).success).toBe(true);
    expect(liveStatusMapQuerySchema.safeParse({ status: 'IN_PROGRESS' }).success).toBe(true);
    expect(liveStatusMapQuerySchema.safeParse({ status: 'INVALID_STATUS' }).success).toBe(false);
    expect(liveStatusMapQuerySchema.safeParse({ citizenId: 'cit-other' }).success).toBe(false);
  });
});
