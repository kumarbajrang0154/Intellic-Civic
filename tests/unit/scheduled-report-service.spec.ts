import { test, expect } from '@playwright/test';
import { ComplaintStatus, PriorityLevel } from '@prisma/client';
import {
  buildPrintHtml,
  buildReportCsv,
  generateFormattedReport,
  getPreviousCalendarMonthRange,
  MAX_SCHEDULED_REPORT_RANGE_DAYS,
  REPORT_DEFINITIONS,
  runDueScheduledReports,
  scheduledReportQuerySchema,
  type ReportColumn,
} from '@/services/scheduled-report-service';

test.describe('Scheduled Report Service — CSV, Print HTML, Allowlist & Cron Runner', () => {
  test('buildReportCsv escapes quotes, commas, newlines, and formula-injection characters', () => {
    const columns: ReportColumn[] = [
      { key: 'dept', header: 'Department' },
      { key: 'note', header: 'Note' },
    ];
    const csv = buildReportCsv(
      [
        { dept: 'Roads, "North"\nZone', note: '=SUM(A1:A2)' },
        { dept: 'Water', note: '+1234' },
        { dept: 'Lighting', note: '-cmd|calc' },
        { dept: 'Sanitation', note: '@RISK()' },
      ],
      columns,
    );

    const lines = csv.split('\n');
    expect(lines[0]).toBe('"Department","Note"');
    expect(csv).toContain('"Roads, ""North""\nZone"');
    expect(csv).toContain("\"'=SUM(A1:A2)\"");
    expect(csv).toContain("\"'+1234\"");
    expect(csv).toContain("\"'-cmd|calc\"");
    expect(csv).toContain("\"'@RISK()\"");
  });

  test('buildPrintHtml escapes script tags and HTML special characters', () => {
    const columns: ReportColumn[] = [
      { key: 'dept', header: 'Department <hdr>' },
      { key: 'value', header: 'Value' },
    ];
    const html = buildPrintHtml(
      'Quarterly Report <script>alert(1)</script>',
      [{ dept: '<script>steal()</script>', value: 'A & B "quoted"' }],
      columns,
      { from: '2026-10-01', to: '2026-10-31', generatedAt: '2026-11-01' },
    );

    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).not.toContain('<script>steal()</script>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).toContain('&lt;script&gt;steal()&lt;/script&gt;');
    expect(html).toContain('Department &lt;hdr&gt;');
    expect(html).toContain('A &amp; B &quot;quoted&quot;');
    expect(html).toContain('@media print');
  });

  test('scheduledReportQuerySchema enforces reportId allowlist and 366-day range cap', () => {
    expect(MAX_SCHEDULED_REPORT_RANGE_DAYS).toBe(366);

    for (const def of REPORT_DEFINITIONS) {
      const ok = scheduledReportQuerySchema.safeParse({
        reportId: def.id,
        format: 'csv',
        from: '2024-01-01',
        to: '2024-12-31',
      });
      expect(ok.success).toBe(true);
    }

    const unknownId = scheduledReportQuerySchema.safeParse({
      reportId: 'citizen-directory',
      format: 'csv',
    });
    expect(unknownId.success).toBe(false);

    const traversalId = scheduledReportQuerySchema.safeParse({
      reportId: '../secret',
      format: 'html',
    });
    expect(traversalId.success).toBe(false);

    const overCap = scheduledReportQuerySchema.safeParse({
      reportId: 'department-performance',
      format: 'csv',
      from: '2024-01-01',
      to: '2025-01-01',
    });
    expect(overCap.success).toBe(false);

    const inverted = scheduledReportQuerySchema.safeParse({
      reportId: 'material-cost',
      format: 'html',
      from: '2026-11-10',
      to: '2026-11-01',
    });
    expect(inverted.success).toBe(false);
  });

  test('getPreviousCalendarMonthRange handles normal, leap-year, and January rollovers', () => {
    expect(getPreviousCalendarMonthRange(new Date('2026-11-12T04:00:00.000Z'))).toEqual({
      from: '2026-10-01',
      to: '2026-10-31',
    });
    expect(getPreviousCalendarMonthRange(new Date('2024-03-05T04:00:00.000Z'))).toEqual({
      from: '2024-02-01',
      to: '2024-02-29',
    });
    expect(getPreviousCalendarMonthRange(new Date('2026-01-10T04:00:00.000Z'))).toEqual({
      from: '2025-12-01',
      to: '2025-12-31',
    });
  });

  test('runDueScheduledReports uses previous month period and summarizes all scheduled reports', async () => {
    const fakeDeps = {
      getDepartmentPerformance: async ({ from, to }: { from?: string; to?: string }) => ({
        generatedAt: '2026-11-12T04:00:00.000Z',
        range: { from: from!, to: to! },
        departmentFilter: null,
        departments: [
          {
            departmentId: 'dept-roads',
            departmentName: 'Roads',
            isSuspended: false,
            totalComplaints: 10,
            resolvedCount: 8,
            pendingCount: 2,
            repeatComplaintsCount: 1,
            reopenedCount: 0,
            duplicateCount: 1,
            avgResolutionTimeHours: 14.5,
            resolutionRatePct: 80,
          },
        ],
        totals: {
          totalComplaints: 10,
          resolvedCount: 8,
          pendingCount: 2,
          repeatComplaintsCount: 1,
          reopenedCount: 0,
          duplicateCount: 1,
          avgResolutionTimeHours: 14.5,
          resolutionRatePct: 80,
        },
      }),
      getMaterialCostSummary: async (query: { from?: string; to?: string }) => ({
        range: { from: query.from!, to: query.to! },
        totalPaise: 450000,
        entryCount: 3,
        departments: [
          {
            departmentId: 'dept-roads',
            departmentCode: 'ROADS',
            departmentName: 'Roads',
            totalPaise: 450000,
            entryCount: 3,
            complaintCount: 2,
          },
        ],
      }),
      listEscalations: async () => ({
        items: [
          {
            id: 'cmp-1',
            ticketId: 'IC-2026-001',
            title: 'Drain cover missing',
            status: ComplaintStatus.IN_PROGRESS,
            priority: PriorityLevel.CRITICAL,
            department: { id: 'dept-roads', name: 'Roads' },
            escalatedAt: new Date('2026-10-15T12:00:00.000Z'),
          },
          {
            id: 'cmp-2',
            ticketId: 'IC-2026-002',
            title: 'Older September breach',
            status: ComplaintStatus.ASSIGNED,
            priority: PriorityLevel.HIGH,
            department: { id: 'dept-water', name: 'Water' },
            escalatedAt: new Date('2026-09-20T12:00:00.000Z'),
          },
        ],
        pagination: { page: 1, limit: 50, total: 2, totalPages: 1 },
      }),
    };

    const summary = await runDueScheduledReports(
      new Date('2026-11-12T04:00:00.000Z'),
      fakeDeps,
    );

    expect(summary.period).toEqual({ from: '2026-10-01', to: '2026-10-31' });
    expect(summary.generatedCount).toBe(3);
    expect(summary.reports.map((r) => r.reportId)).toEqual([
      'department-performance',
      'material-cost',
      'sla-summary',
    ]);
    for (const item of summary.reports) {
      expect(item.rowCount).toBe(1);
      expect(item.byteLength).toBeGreaterThan(0);
    }

    const slaHtml = await generateFormattedReport(
      { reportId: 'sla-summary', format: 'html', from: '2026-10-01', to: '2026-10-31' },
      fakeDeps,
      () => new Date('2026-11-12T04:00:00.000Z'),
    );
    expect(slaHtml.content).toContain('Roads');
    expect(slaHtml.content).not.toContain('Older September breach');
    expect(slaHtml.content).not.toContain('Water');
  });

  test('REPORT_DEFINITIONS exclude citizen PII and exact coordinate columns', () => {
    const forbiddenSubstrings = [
      'email',
      'mobile',
      'phone',
      'citizen',
      'address',
      'latitude',
      'longitude',
      'coord',
      'password',
      'token',
    ];
    const forbiddenExactTokens = /\b(lat|lng|gps)\b/i;

    for (const def of REPORT_DEFINITIONS) {
      for (const col of def.columns) {
        const keyLower = col.key.toLowerCase();
        const headerLower = col.header.toLowerCase();
        for (const token of forbiddenSubstrings) {
          expect(keyLower).not.toContain(token);
          expect(headerLower).not.toContain(token);
        }
        expect(col.key).not.toMatch(forbiddenExactTokens);
        expect(col.header).not.toMatch(forbiddenExactTokens);
      }
    }
  });
});
