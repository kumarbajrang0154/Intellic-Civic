import { test, expect } from '@playwright/test';
import { NextRequest } from 'next/server';
import { middleware } from '@/middleware';
import {
  aggregatePublicTransparencyStats,
  extractWardLabel,
  transparencyQuerySchema,
  type TransparencySourceRecord,
} from '@/services/transparency-service';

test.describe('Public Transparency Dashboard Service & Privacy Guarantees', () => {
  test('extractWardLabel strips street numbers, emails, and phones while normalizing ward labels', () => {
    expect(
      extractWardLabel('14/2 Patel Nagar, Ward 12, Coimbatore, Tamil Nadu', {
        city: 'Coimbatore',
        state: 'Tamil Nadu',
      }),
    ).toBe('Ward 12');

    expect(
      extractWardLabel('No. 45, 9876543210, citizen@example.com, RS Puram, Coimbatore, Tamil Nadu', {
        city: 'Coimbatore',
        state: 'Tamil Nadu',
      }),
    ).toBe('RS Puram');

    expect(
      extractWardLabel('9876543210, citizen@example.com', {
        name: 'Coimbatore Municipal Corp',
        city: 'Coimbatore',
      }),
    ).toBe('Coimbatore');
  });

  test('aggregatePublicTransparencyStats computes department and ward resolved/pending counts with zero PII', () => {
    const fixedNow = new Date('2026-11-12T00:00:00.000Z');
    const records: TransparencySourceRecord[] = [
      {
        status: 'RESOLVED',
        priority: 'HIGH',
        createdAt: '2026-11-01T00:00:00.000Z',
        resolvedAt: '2026-11-01T12:00:00.000Z',
        departmentId: 'dept_water',
        department: { id: 'dept_water', name: 'Water Supply' },
        municipality: { id: 'm_1', name: 'City Corp', city: 'Coimbatore', state: 'Tamil Nadu' },
        location: { address: '42B Gandhi Street, Ward 5, Coimbatore' },
      },
      {
        status: 'PENDING_DEPT_REVIEW',
        priority: 'CRITICAL',
        createdAt: '2026-11-05T00:00:00.000Z',
        resolvedAt: null,
        departmentId: 'dept_water',
        department: { id: 'dept_water', name: 'Water Supply' },
        municipality: { id: 'm_1', name: 'City Corp', city: 'Coimbatore', state: 'Tamil Nadu' },
        location: { address: 'Ward No. 5, near tank' },
      },
      {
        status: 'IN_PROGRESS',
        priority: 'MEDIUM',
        createdAt: '2026-11-06T00:00:00.000Z',
        resolvedAt: null,
        departmentId: 'dept_roads',
        department: { id: 'dept_roads', name: 'Roads' },
        municipality: { id: 'm_1', name: 'City Corp', city: 'Coimbatore', state: 'Tamil Nadu' },
        location: { address: 'Door 19, Race Course, Coimbatore' },
      },
      {
        status: 'CLOSED',
        priority: 'LOW',
        createdAt: '2026-11-02T00:00:00.000Z',
        closedAt: '2026-11-03T12:00:00.000Z',
        departmentId: 'dept_roads',
        department: { id: 'dept_roads', name: 'Roads' },
        municipality: { id: 'm_1', name: 'City Corp', city: 'Coimbatore', state: 'Tamil Nadu' },
        location: { address: 'Race Course, Coimbatore' },
      },
    ];

    const report = aggregatePublicTransparencyStats(records, {
      clock: () => fixedNow,
    });

    expect(report.generatedAt).toBe('2026-11-12T00:00:00.000Z');
    expect(report.summary.total).toBe(4);
    expect(report.summary.resolved).toBe(2);
    expect(report.summary.pending).toBe(1);
    expect(report.summary.inProgress).toBe(1);
    expect(report.summary.resolutionRatePct).toBe(50);
    // Average of 12h and 36h = 24h
    expect(report.summary.avgResolutionHours).toBe(24);

    const water = report.byDepartment.find((d) => d.departmentId === 'dept_water');
    expect(water).toEqual({
      departmentId: 'dept_water',
      departmentName: 'Water Supply',
      total: 2,
      resolved: 1,
      pending: 1,
      inProgress: 0,
      other: 0,
      resolutionRatePct: 50,
    });

    const ward5 = report.byWard.find((w) => w.ward === 'Ward 5');
    expect(ward5).toEqual({
      ward: 'Ward 5',
      total: 2,
      resolved: 1,
      pending: 1,
      inProgress: 0,
      other: 0,
      resolutionRatePct: 50,
    });

    // Privacy check: raw street numbers and non-aggregate fields must not leak
    const serialized = JSON.stringify(report);
    expect(serialized).not.toContain('42B Gandhi Street');
    expect(serialized).not.toContain('Door 19');
    expect(serialized).not.toContain('citizen');

    // Filter test by department
    const filteredWater = aggregatePublicTransparencyStats(records, {
      departmentId: 'dept_water',
      clock: () => fixedNow,
    });
    expect(filteredWater.summary.total).toBe(2);
    expect(filteredWater.availableDepartments).toHaveLength(2);
  });

  test('transparencyQuerySchema validates inputs strictly and rejects malformed filters', () => {
    expect(
      transparencyQuerySchema.safeParse({ departmentId: 'dept_water', ward: 'Ward 12' }).success,
    ).toBe(true);
    expect(
      transparencyQuerySchema.safeParse({ departmentId: 'bad; DROP TABLE complaints' }).success,
    ).toBe(false);
    expect(
      transparencyQuerySchema.safeParse({ ward: '<script>alert(1)</script>' }).success,
    ).toBe(false);
  });

  test('middleware allows unauthenticated access to /public/transparency without redirect', () => {
    const req = new NextRequest('https://smartaicity.vercel.app/public/transparency');
    const res = middleware(req);
    expect(res.status).toBe(200);
    expect(res.headers.get('location')).toBeNull();
  });
});

