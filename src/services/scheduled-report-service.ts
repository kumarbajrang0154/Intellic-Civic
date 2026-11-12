import { z } from 'zod';
import {
  escapeCsvCell,
  getDepartmentPerformanceReport,
  resolveReportDateRange,
  type DepartmentPerformanceReport,
} from '@/services/department-report-service';
import {
  getDepartmentMaterialCostSummary,
  type DepartmentMaterialCostReport,
} from '@/services/material-cost-service';
import {
  listEscalatedComplaints,
  type SlaEscalationActor,
  type SlaEscalationListResult,
} from '@/services/sla-service';

export const MAX_SCHEDULED_REPORT_RANGE_DAYS = 366;

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 24 * 60 * 60 * 1000;

export const REPORT_IDS = [
  'department-performance',
  'material-cost',
  'sla-summary',
] as const;

export type ReportId = (typeof REPORT_IDS)[number];
export type ReportDefaultFormat = 'csv' | 'print-html';
export type ReportOutputFormat = 'csv' | 'html';

export interface ReportColumn {
  key: string;
  header: string;
}

export type ReportRow = Record<string, string | number | boolean | null | undefined>;

export interface ReportGeneratorDeps {
  getDepartmentPerformance?: (options: {
    from?: string;
    to?: string;
  }) => Promise<DepartmentPerformanceReport>;
  getMaterialCostSummary?: (
    query: { from?: string; to?: string },
    actor: { role: string },
  ) => Promise<DepartmentMaterialCostReport>;
  listEscalations?: (
    actor: SlaEscalationActor,
    query?: { page?: number; limit?: number },
  ) => Promise<SlaEscalationListResult>;
}

export interface GeneratedReportPayload {
  reportId: ReportId;
  title: string;
  range: { from: string; to: string };
  columns: ReportColumn[];
  rows: ReportRow[];
}

export interface ReportDefinition {
  id: ReportId;
  title: string;
  description: string;
  format: ReportDefaultFormat;
  columns: ReadonlyArray<ReportColumn>;
  generate: (
    range: { from: string; to: string },
    deps?: ReportGeneratorDeps,
  ) => Promise<GeneratedReportPayload>;
}

export interface ScheduledReportRule {
  reportId: ReportId;
  cadence: 'MONTHLY';
  dayOfMonth: number;
  outputFormat: ReportOutputFormat;
}

export interface ScheduledReportRunItem {
  reportId: ReportId;
  title: string;
  format: ReportOutputFormat;
  rowCount: number;
  byteLength: number;
}

export interface ScheduledReportRunSummary {
  ranAt: string;
  period: { from: string; to: string };
  generatedCount: number;
  reports: ScheduledReportRunItem[];
}

const DEPARTMENT_PERFORMANCE_COLUMNS: ReadonlyArray<ReportColumn> = [
  { key: 'departmentId', header: 'Department ID' },
  { key: 'departmentName', header: 'Department Name' },
  { key: 'periodFrom', header: 'Period From' },
  { key: 'periodTo', header: 'Period To' },
  { key: 'totalComplaints', header: 'Total Complaints' },
  { key: 'resolvedCount', header: 'Resolved Count' },
  { key: 'pendingCount', header: 'Pending Count' },
  { key: 'repeatComplaintsCount', header: 'Repeat Complaints' },
  { key: 'reopenedCount', header: 'Reopened Count' },
  { key: 'duplicateCount', header: 'Duplicate Count' },
  { key: 'avgResolutionTimeHours', header: 'Avg Resolution Time (Hours)' },
  { key: 'resolutionRatePct', header: 'Resolution Rate (%)' },
];

const MATERIAL_COST_COLUMNS: ReadonlyArray<ReportColumn> = [
  { key: 'departmentCode', header: 'Department Code' },
  { key: 'departmentName', header: 'Department Name' },
  { key: 'periodFrom', header: 'Period From' },
  { key: 'periodTo', header: 'Period To' },
  { key: 'entryCount', header: 'Material Entries' },
  { key: 'complaintCount', header: 'Complaints With Materials' },
  { key: 'totalInr', header: 'Total Cost (INR)' },
  { key: 'totalPaise', header: 'Total Cost (Paise)' },
];

const SLA_SUMMARY_COLUMNS: ReadonlyArray<ReportColumn> = [
  { key: 'departmentName', header: 'Department Name' },
  { key: 'periodFrom', header: 'Period From' },
  { key: 'periodTo', header: 'Period To' },
  { key: 'escalatedCount', header: 'Escalated Complaints' },
  { key: 'criticalCount', header: 'Critical' },
  { key: 'highCount', header: 'High' },
  { key: 'mediumCount', header: 'Medium' },
  { key: 'lowCount', header: 'Low' },
  { key: 'latestEscalatedDate', header: 'Latest Escalated Date' },
];

function formatPaiseAsInr(paise: number): string {
  return (paise / 100).toFixed(2);
}

/**
 * Escapes HTML special characters so untrusted strings cannot inject markup or scripts.
 */
export function escapeHtml(value: unknown): string {
  const raw = value === null || value === undefined ? '' : String(value);
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Builds an RFC 4180 CSV string with formula-injection neutralization (=, +, -, @, \t, \r).
 */
export function buildReportCsv(
  rows: ReadonlyArray<ReportRow>,
  columns: ReadonlyArray<ReportColumn>,
): string {
  const headerLine = columns.map((col) => escapeCsvCell(col.header)).join(',');
  const dataLines = rows.map((row) =>
    columns.map((col) => escapeCsvCell(row[col.key])).join(','),
  );
  return [headerLine, ...dataLines].join('\n');
}

/**
 * Builds a self-contained print-ready HTML document for browser Save-as-PDF printing.
 */
export function buildPrintHtml(
  title: string,
  rows: ReadonlyArray<ReportRow>,
  columns: ReadonlyArray<ReportColumn>,
  meta?: { from?: string; to?: string; generatedAt?: string },
): string {
  const safeTitle = escapeHtml(title);
  const periodText =
    meta?.from && meta?.to
      ? `Reporting Period: ${escapeHtml(meta.from)} to ${escapeHtml(meta.to)}`
      : '';
  const generatedText = meta?.generatedAt
    ? `Generated: ${escapeHtml(meta.generatedAt)}`
    : '';

  const headerCells = columns
    .map((col) => `<th scope="col">${escapeHtml(col.header)}</th>`)
    .join('');

  const bodyRows =
    rows.length === 0
      ? `<tr><td colspan="${Math.max(1, columns.length)}" class="empty">No aggregate records found for this reporting period.</td></tr>`
      : rows
          .map((row) => {
            const cells = columns
              .map((col) => {
                const raw = row[col.key];
                return `<td>${escapeHtml(raw === null || raw === undefined || raw === '' ? '-' : raw)}</td>`;
              })
              .join('');
            return `<tr>${cells}</tr>`;
          })
          .join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${safeTitle} - IntelliCivic</title>
  <style>
    @page { size: A4 landscape; margin: 14mm; }
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      color: #131e20;
      background: #ffffff;
      margin: 0;
      padding: 24px;
      line-height: 1.45;
    }
    .header {
      border-bottom: 2px solid #3468a1;
      padding-bottom: 12px;
      margin-bottom: 16px;
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      align-items: flex-end;
      gap: 12px;
    }
    h1 {
      margin: 0 0 4px 0;
      font-size: 20px;
      color: #131e20;
    }
    .meta {
      font-size: 12px;
      color: #55524b;
    }
    .hint {
      font-size: 12px;
      color: #3468a1;
      background: #f2efe6;
      padding: 6px 10px;
      border-radius: 6px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
    }
    th, td {
      border: 1px solid #d5d0c5;
      padding: 8px 10px;
      text-align: left;
      vertical-align: top;
    }
    th {
      background: #f2efe6;
      font-weight: 600;
      color: #131e20;
    }
    tr:nth-child(even) td {
      background: #faf9f6;
    }
    tr {
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .empty {
      text-align: center;
      color: #6e6b64;
      padding: 20px;
    }
    .footer {
      margin-top: 16px;
      font-size: 11px;
      color: #6e6b64;
    }
    @media print {
      body { padding: 0; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1>${safeTitle}</h1>
      <div class="meta">${[periodText, generatedText].filter(Boolean).join(' &middot; ')}</div>
    </div>
    <div class="hint no-print">Use your browser&apos;s Print dialog (Ctrl+P / Cmd+P) and choose Save as PDF.</div>
  </div>
  <table>
    <thead>
      <tr>${headerCells}</tr>
    </thead>
    <tbody>
      ${bodyRows}
    </tbody>
  </table>
  <div class="footer">IntelliCivic Administrative Report &middot; Aggregate metrics only (no citizen PII or exact coordinates).</div>
</body>
</html>`;
}

async function generateDepartmentPerformanceRows(
  range: { from: string; to: string },
  deps?: ReportGeneratorDeps,
): Promise<GeneratedReportPayload> {
  const fetcher = deps?.getDepartmentPerformance ?? getDepartmentPerformanceReport;
  const report: DepartmentPerformanceReport = await fetcher({
    from: range.from,
    to: range.to,
  });

  const rows: ReportRow[] = report.departments.map((d) => ({
    departmentId: d.departmentId,
    departmentName: d.departmentName,
    periodFrom: report.range.from,
    periodTo: report.range.to,
    totalComplaints: d.totalComplaints,
    resolvedCount: d.resolvedCount,
    pendingCount: d.pendingCount,
    repeatComplaintsCount: d.repeatComplaintsCount,
    reopenedCount: d.reopenedCount,
    duplicateCount: d.duplicateCount,
    avgResolutionTimeHours: d.avgResolutionTimeHours ?? 'N/A',
    resolutionRatePct: d.resolutionRatePct,
  }));

  return {
    reportId: 'department-performance',
    title: 'Department Performance Report',
    range: report.range,
    columns: [...DEPARTMENT_PERFORMANCE_COLUMNS],
    rows,
  };
}

async function generateMaterialCostRows(
  range: { from: string; to: string },
  deps?: ReportGeneratorDeps,
): Promise<GeneratedReportPayload> {
  const fetcher = deps?.getMaterialCostSummary ?? getDepartmentMaterialCostSummary;
  const report: DepartmentMaterialCostReport = await fetcher(
    { from: range.from, to: range.to },
    { role: 'ADMIN' },
  );

  const rows: ReportRow[] = report.departments.map((d) => ({
    departmentCode: d.departmentCode,
    departmentName: d.departmentName,
    periodFrom: report.range.from,
    periodTo: report.range.to,
    entryCount: d.entryCount,
    complaintCount: d.complaintCount,
    totalInr: formatPaiseAsInr(d.totalPaise),
    totalPaise: d.totalPaise,
  }));

  return {
    reportId: 'material-cost',
    title: 'Material Cost Summary by Department',
    range: report.range,
    columns: [...MATERIAL_COST_COLUMNS],
    rows,
  };
}

function normalizeEscalateDateIso(value: Date | string | null): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

async function generateSlaSummaryRows(
  range: { from: string; to: string },
  deps?: ReportGeneratorDeps,
): Promise<GeneratedReportPayload> {
  const fetcher = deps?.listEscalations ?? listEscalatedComplaints;

  const allItems: SlaEscalationListResult['items'] = [];
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages && page <= 10) {
    const result = await fetcher(
      { role: 'ADMIN', departmentId: null },
      { page, limit: 50 },
    );
    allItems.push(...result.items);
    totalPages = Math.max(1, result.pagination.totalPages);
    page += 1;
  }

  const buckets = new Map<
    string,
    {
      departmentName: string;
      escalatedCount: number;
      criticalCount: number;
      highCount: number;
      mediumCount: number;
      lowCount: number;
      latestEscalatedDate: string;
    }
  >();

  for (const item of allItems) {
    const escalatedDate = normalizeEscalateDateIso(item.escalatedAt);
    if (!escalatedDate || escalatedDate < range.from || escalatedDate > range.to) {
      continue;
    }
    const departmentName = item.department?.name || 'Unassigned Department';
    const existing = buckets.get(departmentName) ?? {
      departmentName,
      escalatedCount: 0,
      criticalCount: 0,
      highCount: 0,
      mediumCount: 0,
      lowCount: 0,
      latestEscalatedDate: escalatedDate,
    };

    existing.escalatedCount += 1;
    const priority = String(item.priority || 'MEDIUM').toUpperCase();
    if (priority === 'CRITICAL') existing.criticalCount += 1;
    else if (priority === 'HIGH') existing.highCount += 1;
    else if (priority === 'LOW') existing.lowCount += 1;
    else existing.mediumCount += 1;

    if (escalatedDate > existing.latestEscalatedDate) {
      existing.latestEscalatedDate = escalatedDate;
    }
    buckets.set(departmentName, existing);
  }

  const rows: ReportRow[] = Array.from(buckets.values())
    .sort((a, b) => {
      if (b.escalatedCount !== a.escalatedCount) {
        return b.escalatedCount - a.escalatedCount;
      }
      return a.departmentName.localeCompare(b.departmentName);
    })
    .map((bucket) => ({
      departmentName: bucket.departmentName,
      periodFrom: range.from,
      periodTo: range.to,
      escalatedCount: bucket.escalatedCount,
      criticalCount: bucket.criticalCount,
      highCount: bucket.highCount,
      mediumCount: bucket.mediumCount,
      lowCount: bucket.lowCount,
      latestEscalatedDate: bucket.latestEscalatedDate,
    }));

  return {
    reportId: 'sla-summary',
    title: 'SLA Escalation Summary by Department',
    range,
    columns: [...SLA_SUMMARY_COLUMNS],
    rows,
  };
}

export const REPORT_DEFINITIONS: ReadonlyArray<ReportDefinition> = [
  {
    id: 'department-performance',
    title: 'Department Performance Report',
    description:
      'Department-level complaint volumes, resolution rates, repeat counts, and average turnaround hours.',
    format: 'csv',
    columns: DEPARTMENT_PERFORMANCE_COLUMNS,
    generate: generateDepartmentPerformanceRows,
  },
  {
    id: 'material-cost',
    title: 'Material Cost Summary by Department',
    description:
      'Per-department repair material log counts and total recorded spend in INR/paise.',
    format: 'csv',
    columns: MATERIAL_COST_COLUMNS,
    generate: generateMaterialCostRows,
  },
  {
    id: 'sla-summary',
    title: 'SLA Escalation Summary by Department',
    description:
      'Printable aggregate summary of SLA-breached escalations broken down by department and priority.',
    format: 'print-html',
    columns: SLA_SUMMARY_COLUMNS,
    generate: generateSlaSummaryRows,
  },
];

export const SCHEDULED_REPORT_CADENCE: ReadonlyArray<ScheduledReportRule> = [
  {
    reportId: 'department-performance',
    cadence: 'MONTHLY',
    dayOfMonth: 1,
    outputFormat: 'csv',
  },
  {
    reportId: 'material-cost',
    cadence: 'MONTHLY',
    dayOfMonth: 1,
    outputFormat: 'csv',
  },
  {
    reportId: 'sla-summary',
    cadence: 'MONTHLY',
    dayOfMonth: 1,
    outputFormat: 'html',
  },
];

export function getReportDefinition(reportId: string): ReportDefinition | null {
  return REPORT_DEFINITIONS.find((def) => def.id === reportId) ?? null;
}

export function listReportDefinitionMetadata() {
  return REPORT_DEFINITIONS.map((def) => ({
    id: def.id,
    title: def.title,
    description: def.description,
    format: def.format,
    columns: def.columns,
  }));
}

export const scheduledReportQuerySchema = z
  .object({
    reportId: z.enum(REPORT_IDS, {
      message: `Report ID must be one of: ${REPORT_IDS.join(', ')}`,
    }),
    format: z.enum(['csv', 'html']).optional(),
    from: z.string().regex(ISO_DATE_RE, 'Invalid from date; expected YYYY-MM-DD').optional(),
    to: z.string().regex(ISO_DATE_RE, 'Invalid to date; expected YYYY-MM-DD').optional(),
  })
  .superRefine((value, ctx) => {
    let resolved: ReturnType<typeof resolveReportDateRange>;
    try {
      resolved = resolveReportDateRange(value.from, value.to);
    } catch (error) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['from'],
        message: error instanceof Error ? error.message : 'Invalid date range',
      });
      return;
    }

    const fromDayMs = Date.parse(`${resolved.fromIso}T00:00:00.000Z`);
    const toDayMs = Date.parse(`${resolved.toIso}T00:00:00.000Z`);
    const inclusiveDays = Math.floor((toDayMs - fromDayMs) / DAY_MS) + 1;
    if (inclusiveDays > MAX_SCHEDULED_REPORT_RANGE_DAYS) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['to'],
        message: `Date range cannot exceed ${MAX_SCHEDULED_REPORT_RANGE_DAYS} days`,
      });
    }
  });

/**
 * Returns the full previous UTC calendar month window (from YYYY-MM-01 to YYYY-MM-lastDay).
 */
export function getPreviousCalendarMonthRange(now: Date = new Date()): {
  from: string;
  to: string;
} {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth(); // 0..11
  const prevMonthStart = new Date(Date.UTC(year, month - 1, 1));
  const prevMonthEnd = new Date(Date.UTC(year, month, 0));
  return {
    from: prevMonthStart.toISOString().slice(0, 10),
    to: prevMonthEnd.toISOString().slice(0, 10),
  };
}

/**
 * Renders any allowlisted report in either CSV or print-ready HTML for a validated range.
 */
export async function generateFormattedReport(
  params: {
    reportId: ReportId;
    format?: ReportOutputFormat;
    from?: string;
    to?: string;
  },
  deps?: ReportGeneratorDeps,
  clock?: () => Date,
): Promise<{
  reportId: ReportId;
  title: string;
  format: ReportOutputFormat;
  contentType: string;
  filename: string;
  content: string;
  range: { from: string; to: string };
  rowCount: number;
}> {
  const definition = getReportDefinition(params.reportId);
  if (!definition) {
    throw new Error(`Unknown report id: ${params.reportId}`);
  }

  const resolvedRange = resolveReportDateRange(params.from, params.to, clock);
  const range = { from: resolvedRange.fromIso, to: resolvedRange.toIso };
  const payload = await definition.generate(range, deps);
  const resolvedFormat: ReportOutputFormat =
    params.format ?? (definition.format === 'print-html' ? 'html' : 'csv');

  if (resolvedFormat === 'html') {
    const content = buildPrintHtml(payload.title, payload.rows, payload.columns, {
      from: payload.range.from,
      to: payload.range.to,
      generatedAt: (clock ? clock() : new Date()).toISOString().slice(0, 10),
    });
    return {
      reportId: definition.id,
      title: payload.title,
      format: 'html',
      contentType: 'text/html; charset=utf-8',
      filename: `${definition.id}-${payload.range.from}-to-${payload.range.to}.html`,
      content,
      range: payload.range,
      rowCount: payload.rows.length,
    };
  }

  const content = buildReportCsv(payload.rows, payload.columns);
  return {
    reportId: definition.id,
    title: payload.title,
    format: 'csv',
    contentType: 'text/csv; charset=utf-8',
    filename: `${definition.id}-${payload.range.from}-to-${payload.range.to}.csv`,
    content,
    range: payload.range,
    rowCount: payload.rows.length,
  };
}

/**
 * Generates all scheduled monthly reports for the previous calendar month and returns a summary.
 * Email delivery is intentionally omitted in this phase.
 */
export async function runDueScheduledReports(
  now: Date = new Date(),
  deps?: ReportGeneratorDeps,
): Promise<ScheduledReportRunSummary> {
  const period = getPreviousCalendarMonthRange(now);
  const reports: ScheduledReportRunItem[] = [];

  for (const rule of SCHEDULED_REPORT_CADENCE) {
    const generated = await generateFormattedReport(
      {
        reportId: rule.reportId,
        format: rule.outputFormat,
        from: period.from,
        to: period.to,
      },
      deps,
      () => now,
    );
    reports.push({
      reportId: generated.reportId,
      title: generated.title,
      format: generated.format,
      rowCount: generated.rowCount,
      byteLength: Buffer.byteLength(generated.content, 'utf8'),
    });
  }

  return {
    ranAt: now.toISOString(),
    period,
    generatedCount: reports.length,
    reports,
  };
}
