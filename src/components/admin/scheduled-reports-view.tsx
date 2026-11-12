'use client';

import * as React from 'react';
import {
  AlertCircle,
  Calendar,
  Download,
  FileText,
  Printer,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/admin/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  getPreviousCalendarMonthRange,
  listReportDefinitionMetadata,
  MAX_SCHEDULED_REPORT_RANGE_DAYS,
} from '@/services/scheduled-report-service';

const DAY_MS = 24 * 60 * 60 * 1000;

function validateDateRange(from: string, to: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return 'Select both start and end dates in YYYY-MM-DD format.';
  }
  const startMs = Date.parse(`${from}T00:00:00.000Z`);
  const endMs = Date.parse(`${to}T00:00:00.000Z`);
  if (Number.isNaN(startMs) || Number.isNaN(endMs)) {
    return 'Selected dates are invalid.';
  }
  if (startMs > endMs) {
    return 'Start date must be on or before end date.';
  }
  const inclusiveDays = Math.floor((endMs - startMs) / DAY_MS) + 1;
  if (inclusiveDays > MAX_SCHEDULED_REPORT_RANGE_DAYS) {
    return `Reporting period cannot exceed ${MAX_SCHEDULED_REPORT_RANGE_DAYS} days.`;
  }
  return null;
}

export function ScheduledReportsView() {
  const defaultPeriod = React.useMemo(() => getPreviousCalendarMonthRange(new Date()), []);
  const definitions = React.useMemo(() => listReportDefinitionMetadata(), []);

  const [fromDate, setFromDate] = React.useState<string>(defaultPeriod.from);
  const [toDate, setToDate] = React.useState<string>(defaultPeriod.to);
  const [user, setUser] = React.useState<{
    name: string;
    role: 'ADMIN' | 'SUPER_ADMIN';
  } | null>(null);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [error, setError] = React.useState<string | null>(null);

  const loadSession = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/me', { cache: 'no-store' });
      const data = await res.json().catch(() => null);
      const role = data?.user?.role;
      if (!res.ok || (role !== 'ADMIN' && role !== 'SUPER_ADMIN')) {
        throw new Error('Administrator access (Admin or Super Admin) is required to export reports.');
      }
      setUser({
        name: data.user.name || 'Administrator',
        role,
      });
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'Unable to verify administrator session.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadSession();
  }, [loadSession]);

  const rangeError = validateDateRange(fromDate, toDate);
  const shellUser = user ?? { name: 'Administrator', role: 'ADMIN' as const };

  return (
    <AppShell user={shellUser}>
      <div className="space-y-6">
        <PageHeader
          title="Scheduled Report Exports"
          description="Download Excel-compatible CSV exports or open print-ready PDF views using aggregate departmental data only."
          actions={
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-11 sm:h-9"
              onClick={loadSession}
              disabled={loading}
            >
              <RefreshCw className={`w-4 h-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          }
        />

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#3468A1]" aria-hidden="true" />
              Reporting Period
            </CardTitle>
            <CardDescription>
              Defaults to the previous calendar month ({defaultPeriod.from} to {defaultPeriod.to}).
              Maximum range is {MAX_SCHEDULED_REPORT_RANGE_DAYS} days.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex lg:items-end gap-4">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="export-from-date" className="text-xs font-semibold text-[#6E6B64]">
                  From Date
                </label>
                <Input
                  id="export-from-date"
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="h-11 sm:h-9 w-full lg:w-44"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="export-to-date" className="text-xs font-semibold text-[#6E6B64]">
                  To Date
                </label>
                <Input
                  id="export-to-date"
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="h-11 sm:h-9 w-full lg:w-44"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-11 sm:h-9"
                onClick={() => {
                  setFromDate(defaultPeriod.from);
                  setToDate(defaultPeriod.to);
                }}
              >
                Previous Month
              </Button>
            </div>
            {rangeError && (
              <p role="alert" className="mt-3 text-sm text-[#B42318] flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
                {rangeError}
              </p>
            )}
          </CardContent>
        </Card>

        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4" aria-busy="true">
            {[1, 2, 3].map((item) => (
              <Card key={item}>
                <CardHeader>
                  <Skeleton className="h-5 w-48" />
                  <Skeleton className="h-4 w-full mt-2" />
                </CardHeader>
                <CardContent className="space-y-3">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-10 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {!loading && error && (
          <Card className="border-[#F5C2C7] bg-[#FFF5F5]">
            <CardContent className="pt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-[#B42318] mt-0.5 shrink-0" aria-hidden="true" />
                <div>
                  <p className="text-sm font-semibold text-[#7A1812]">Unable to load export tools</p>
                  <p className="text-sm text-[#8F2822] mt-0.5">{error}</p>
                </div>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={loadSession}>
                Try Again
              </Button>
            </CardContent>
          </Card>
        )}

        {!loading && !error && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {definitions.map((def) => {
                const baseParams = new URLSearchParams({
                  from: fromDate,
                  to: toDate,
                });
                const csvHref = `/api/admin/reports/${def.id}?${baseParams.toString()}&format=csv`;
                const printHref = `/api/admin/reports/${def.id}?${baseParams.toString()}&format=html&inline=1`;
                const disabled = Boolean(rangeError);

                return (
                  <Card key={def.id} className="flex flex-col justify-between">
                    <CardHeader>
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-base flex items-center gap-2">
                          <FileText className="w-4 h-4 text-[#3468A1] shrink-0" aria-hidden="true" />
                          <span>{def.title}</span>
                        </CardTitle>
                        <Badge variant="outline" className="shrink-0 text-[11px]">
                          {def.format === 'print-html' ? 'Print PDF' : 'CSV'}
                        </Badge>
                      </div>
                      <CardDescription className="pt-1">{def.description}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="text-xs text-[#6E6B64]">
                        Includes {def.columns.length} aggregate columns &middot; No citizen PII
                      </div>
                      <div className="flex flex-col sm:flex-row gap-2">
                        {disabled ? (
                          <Button type="button" size="sm" disabled className="h-11 sm:h-9 flex-1">
                            <Download className="w-4 h-4 mr-1.5" aria-hidden="true" />
                            Download CSV
                          </Button>
                        ) : (
                          <a
                            href={csvHref}
                            download
                            aria-label={`Download CSV for ${def.title}`}
                            className="inline-flex items-center justify-center rounded-lg px-3 text-sm font-medium bg-[#3468A1] hover:bg-[#2B5687] text-white h-11 sm:h-9 flex-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3468A1] focus-visible:ring-offset-2 transition-colors"
                          >
                            <Download className="w-4 h-4 mr-1.5 shrink-0" aria-hidden="true" />
                            Download CSV
                          </a>
                        )}

                        {disabled ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled
                            className="h-11 sm:h-9 flex-1"
                          >
                            <Printer className="w-4 h-4 mr-1.5" aria-hidden="true" />
                            Open printable view
                          </Button>
                        ) : (
                          <a
                            href={printHref}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={`Open printable view for ${def.title}`}
                            className="inline-flex items-center justify-center rounded-lg px-3 text-sm font-medium border border-[#D8D3C8] bg-white hover:bg-[#F7F4EC] text-[#131E20] h-11 sm:h-9 flex-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3468A1] focus-visible:ring-offset-2 transition-colors"
                          >
                            <Printer className="w-4 h-4 mr-1.5 shrink-0" aria-hidden="true" />
                            Open printable view
                          </a>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            <Card className="bg-[#FAF8F3]">
              <CardContent className="pt-5 flex items-start gap-3 text-xs text-[#6E6B64]">
                <ShieldCheck className="w-4 h-4 text-[#3468A1] mt-0.5 shrink-0" aria-hidden="true" />
                <div>
                  Automated schedule runs daily at 04:00 UTC (<code className="font-mono">0 4 * * *</code>)
                  to prepare previous calendar month aggregate summaries. All downloads are sanitized
                  against spreadsheet formula injection and HTML script injection.
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </AppShell>
  );
}

