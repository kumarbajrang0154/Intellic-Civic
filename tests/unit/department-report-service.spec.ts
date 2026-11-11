import { test, expect } from '@playwright/test';
import {
  computeDepartmentPerformanceReport,
  departmentReportQuerySchema,
  escapeCsvCell,
  formatDepartmentPerformanceCsv,
  resolveReportDateRange,
  type ReportComplaintSource,
  type ReportDepartmentSource,
} from '@/services/department-report-service';

test.describe('Department Performance Report Service & CSV Export', () => {
  const departments: ReportDepartmentSource[] = [
    { id: 'dept_roads', name: 'Roads & Bridges', isSuspended: false },
    { id: 'dept_water', name: 'Water Supply', isSuspended: false },
  ];

  const complaints: ReportComplaintSource[] = [
    {
      id: 'c_1',
      status: 'RESOLVED',
      departmentId: 'dept_roads',
      createdAt: '2026-11-01T00:00:00.000Z',
      resolvedAt: '2026-11-01T10:00:00.000Z',
      reopenCount: 0,
    },
    {
      id: 'c_2',
      status: 'CLOSED',
      departmentId: 'dept_roads',
      createdAt: '2026-11-02T00:00:00.000Z',
      closedAt: '2026-11-03T02:00:00.000Z', // 26h
      reopenCount: 1, // reopened repeat complaint
    },
    {
      id: 'c_3',
      status: 'IN_PROGRESS',
      departmentId: 'dept_roads',
      createdAt: '2026-11-05T12:00:00.000Z',
      reopenCount: 0,
    },
    {
      id: 'c_4',
      status: 'DUPLICATE',
      departmentId: 'dept_water',
      createdAt: '2026-11-06T09:00:00.000Z',
      reopenCount: 0,
    },
    {
      id: 'c_out_of_range',
      status: 'RESOLVED',
      departmentId: 'dept_water',
      createdAt: '2026-10-15T00:00:00.000Z',
      resolvedAt: '2026-10-15T05:00:00.000Z',
      reopenCount: 0,
    },
  ];

  test('computes average resolution time, pending count, and repeat complaints within date range', () => {
    const fixedClock = () => new Date('2026-11-12T00:00:00.000Z');
    const report = computeDepartmentPerformanceReport(departments, complaints, {
      from: '2026-11-01',
      to: '2026-11-10',
      clock: fixedClock,
    });

    expect(report.range).toEqual({ from: '2026-11-01', to: '2026-11-10' });
    expect(report.totals.totalComplaints).toBe(4);
    expect(report.totals.resolvedCount).toBe(2);
    expect(report.totals.pendingCount).toBe(1);
    expect(report.totals.repeatComplaintsCount).toBe(2);
    // Average of 10h and 26h = 18h
    expect(report.totals.avgResolutionTimeHours).toBe(18);
    expect(report.totals.resolutionRatePct).toBe(50);

    const roads = report.departments.find((d) => d.departmentId === 'dept_roads');
    expect(roads).toEqual({
      departmentId: 'dept_roads',
      departmentName: 'Roads & Bridges',
      isSuspended: false,
      totalComplaints: 3,
      resolvedCount: 2,
      pendingCount: 1,
      repeatComplaintsCount: 1,
      reopenedCount: 1,
      duplicateCount: 0,
      avgResolutionTimeHours: 18,
      resolutionRatePct: 67,
    });

    const water = report.departments.find((d) => d.departmentId === 'dept_water');
    expect(water?.totalComplaints).toBe(1);
    expect(water?.repeatComplaintsCount).toBe(1);
    expect(water?.duplicateCount).toBe(1);
    expect(water?.avgResolutionTimeHours).toBeNull();
  });

  test('validates calendar dates, rejects invalid ranges, and resolves 30-day default window', () => {
    expect(
      departmentReportQuerySchema.safeParse({ from: '2026-02-30', to: '2026-03-01' }).success,
    ).toBe(false);
    expect(
      departmentReportQuerySchema.safeParse({ from: '2026-11-10', to: '2026-11-01' }).success,
    ).toBe(false);
    expect(
      departmentReportQuerySchema.safeParse({ from: '2026-11-01', to: '2026-11-10', format: 'csv' }).success,
    ).toBe(true);

    const range = resolveReportDateRange(undefined, undefined, () => new Date('2026-11-30T15:00:00.000Z'));
    expect(range.toIso).toBe('2026-11-30');
    expect(range.fromIso).toBe('2026-11-01');
  });

  test('formatDepartmentPerformanceCsv neutralizes formula injection payloads', () => {
    expect(escapeCsvCell('=CMD("calc")')).toBe('"\'=CMD(""calc"")"');
    expect(escapeCsvCell('+1+1')).toBe('"\'+1+1"');
    expect(escapeCsvCell('@SUM(A1:A2)')).toBe('"\'@SUM(A1:A2)"');

    const report = computeDepartmentPerformanceReport(
      [{ id: 'dept_inj', name: '=HYPERLINK("http://evil")', isSuspended: false }],
      [],
      { from: '2026-11-01', to: '2026-11-10' },
    );
    const csv = formatDepartmentPerformanceCsv(report);
    const lines = csv.split('\n');
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain('"Department Name"');
    expect(lines[1]).toContain('"\'=HYPERLINK(""http://evil"")"');
  });
});

