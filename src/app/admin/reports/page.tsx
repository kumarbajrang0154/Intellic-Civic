'use client';

import * as React from 'react';
import {
  AlertCircle,
  BarChart3,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  Inbox,
  RefreshCw,
  Repeat,
} from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/admin/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import type { DepartmentPerformanceReport } from '@/services/department-report-service';

function getDefaultDates() {
  const end = new Date();
  const start = new Date(end.getTime() - 29 * 24 * 60 * 60 * 1000);
  return {
    from: start.toISOString().slice(0, 10),
    to: end.toISOString().slice(0, 10),
  };
}

export default function AdminDepartmentReportsPage() {
  const defaults = React.useMemo(() => getDefaultDates(), []);
  const [fromDate, setFromDate] = React.useState<string>(defaults.from);
  const [toDate, setToDate] = React.useState<string>(defaults.to);
  const [report, setReport] = React.useState<DepartmentPerformanceReport | null>(null);
  const [user, setUser] = React.useState<{ name: string; role: 'ADMIN' | 'SUPER_ADMIN' }>({
    name: 'Admin',
    role: 'ADMIN',
  });
  const [loading, setLoading] = React.useState<boolean>(true);
  const [error, setError] = React.useState<string | null>(null);

  const loadReport = React.useCallback(async (from: string, to: string) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (from) params.set('from', from);
      if (to) params.set('to', to);

      const [reportRes, meRes] = await Promise.all([
        fetch(`/api/admin/reports/department-performance?${params.toString()}`),
        fetch('/api/auth/me'),
      ]);

      if (meRes.ok) {
        const me = await meRes.json();
        if (me?.user?.role === 'ADMIN' || me?.user?.role === 'SUPER_ADMIN') {
          setUser({ name: me.user.name || 'Admin', role: me.user.role });
        }
      }

      const json = await reportRes.json().catch(() => null);
      if (!reportRes.ok || !json?.data) {
        throw new Error(json?.message || 'Unable to load department performance report.');
      }
      setReport(json.data);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'Unable to load department performance report.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadReport(fromDate, toDate);
  }, [fromDate, toDate, loadReport]);

  const handleApplyFilter = (e: React.FormEvent) => {
    e.preventDefault();
    loadReport(fromDate, toDate);
  };

  const handleDownloadCsv = () => {
    const params = new URLSearchParams();
    if (fromDate) params.set('from', fromDate);
    if (toDate) params.set('to', toDate);
    params.set('format', 'csv');
    window.location.href = `/api/admin/reports/department-performance?${params.toString()}`;
  };

  const isEmpty = Boolean(report && report.departments.length === 0);

  return (
    <AppShell user={{ name: user.name, role: user.role }}>
      <div className="space-y-6">
        <PageHeader
          title="Department Performance Report"
          description="Average resolution time, open pending volume, and repeat complaint rates per department (Admin & Super Admin only)"
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-11 sm:h-9"
                onClick={() => loadReport(fromDate, toDate)}
                disabled={loading}
              >
                <RefreshCw className={`w-4 h-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button
                type="button"
                size="sm"
                className="h-11 sm:h-9 bg-[#3468A1] hover:bg-[#2B5687] text-white"
                onClick={handleDownloadCsv}
                disabled={loading || Boolean(error)}
              >
                <Download className="w-4 h-4 mr-1.5" />
                Export CSV
              </Button>
            </div>
          }
        />

        {/* Date Range Filter */}
        <Card>
          <CardContent className="pt-6">
            <form
              onSubmit={handleApplyFilter}
              className="grid grid-cols-1 sm:grid-cols-2 lg:flex lg:items-end gap-4"
            >
              <div className="flex flex-col gap-1.5">
                <label htmlFor="report-from-date" className="text-xs font-semibold text-[#6E6B64] flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-[#3468A1]" aria-hidden="true" />
                  From Date (UTC)
                </label>
                <Input
                  id="report-from-date"
                  type="date"
                  value={fromDate}
                  max={toDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="h-11 rounded-xl border-[#E5E2D9]"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="report-to-date" className="text-xs font-semibold text-[#6E6B64] flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-[#3468A1]" aria-hidden="true" />
                  To Date (UTC)
                </label>
                <Input
                  id="report-to-date"
                  type="date"
                  value={toDate}
                  min={fromDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="h-11 rounded-xl border-[#E5E2D9]"
                />
              </div>

              <Button
                type="submit"
                variant="outline"
                className="h-11 rounded-xl border-[#E5E2D9]"
                disabled={loading}
              >
                Apply Date Range
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Error State */}
        {error && (
          <Card className="border-rose-200 bg-rose-50" role="alert">
            <CardContent className="pt-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" aria-hidden="true" />
                <div>
                  <h2 className="text-sm font-bold text-rose-900">Report Unavailable</h2>
                  <p className="text-xs text-rose-700 mt-0.5">{error}</p>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-11 sm:h-9 border-rose-300 bg-white text-rose-900"
                onClick={() => loadReport(fromDate, toDate)}
              >
                Retry
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Loading State */}
        {loading && !error && (
          <div className="space-y-4" aria-busy="true">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[0, 1, 2, 3].map((i) => (
                <Card key={i}>
                  <CardContent className="pt-6 space-y-3">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-8 w-16" />
                  </CardContent>
                </Card>
              ))}
            </div>
            <Card>
              <CardContent className="pt-6 space-y-3">
                <Skeleton className="h-6 w-52" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </CardContent>
            </Card>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && isEmpty && (
          <Card>
            <CardContent className="py-12 flex flex-col items-center text-center">
              <Inbox className="w-10 h-10 text-[#6E6B64] mb-3" aria-hidden="true" />
              <h2 className="text-base font-bold text-[#131E20]">No Department Data Found</h2>
              <p className="text-sm text-[#6E6B64] mt-1">
                No departments or complaints matched the selected window ({fromDate} to {toDate}).
              </p>
            </CardContent>
          </Card>
        )}

        {/* Success State */}
        {!loading && !error && report && !isEmpty && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-[#6E6B64]">
                    <span>Total Complaints</span>
                    <BarChart3 className="w-4 h-4 text-[#3468A1]" aria-hidden="true" />
                  </div>
                  <div className="text-3xl font-extrabold text-[#131E20] mt-2">
                    {report.totals.totalComplaints}
                  </div>
                  <p className="text-xs text-[#6E6B64] mt-1">
                    {report.range.from} to {report.range.to}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-[#6E6B64]">
                    <span>Avg Resolution Time</span>
                    <Clock className="w-4 h-4 text-[#3B8F68]" aria-hidden="true" />
                  </div>
                  <div className="text-3xl font-extrabold text-[#3B8F68] mt-2">
                    {report.totals.avgResolutionTimeHours !== null
                      ? `${report.totals.avgResolutionTimeHours}h`
                      : 'N/A'}
                  </div>
                  <p className="text-xs text-[#6E6B64] mt-1">
                    {report.totals.resolutionRatePct}% resolved ({report.totals.resolvedCount})
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-[#6E6B64]">
                    <span>Pending Volume</span>
                    <CheckCircle2 className="w-4 h-4 text-[#D98E2B]" aria-hidden="true" />
                  </div>
                  <div className="text-3xl font-extrabold text-[#D98E2B] mt-2">
                    {report.totals.pendingCount}
                  </div>
                  <p className="text-xs text-[#6E6B64] mt-1">
                    Open cases in active queue
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-[#6E6B64]">
                    <span>Repeat Complaints</span>
                    <Repeat className="w-4 h-4 text-rose-600" aria-hidden="true" />
                  </div>
                  <div className="text-3xl font-extrabold text-rose-600 mt-2">
                    {report.totals.repeatComplaintsCount}
                  </div>
                  <p className="text-xs text-[#6E6B64] mt-1">
                    Reopened or duplicate filings
                  </p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-[#3468A1]" aria-hidden="true" />
                  Department Breakdown
                </CardTitle>
                <CardDescription>
                  Generated {new Date(report.generatedAt).toLocaleString()}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead>
                      <tr className="border-b border-[#E5E2D9] text-xs font-bold uppercase tracking-wider text-[#6E6B64]">
                        <th className="py-3 pr-4">Department</th>
                        <th className="py-3 px-2 text-right">Total</th>
                        <th className="py-3 px-2 text-right">Resolved</th>
                        <th className="py-3 px-2 text-right">Pending</th>
                        <th className="py-3 px-2 text-right">Repeat</th>
                        <th className="py-3 px-2 text-right">Avg Res (hrs)</th>
                        <th className="py-3 pl-2 text-right">Rate</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E5E2D9]/60">
                      {report.departments.map((dept) => (
                        <tr key={dept.departmentId} className="hover:bg-[#F2EFE6]/50">
                          <td className="py-3 pr-4 font-semibold text-[#131E20]">
                            <div className="flex items-center gap-2">
                              <span>{dept.departmentName}</span>
                              {dept.isSuspended && <Badge variant="warning">Suspended</Badge>}
                            </div>
                          </td>
                          <td className="py-3 px-2 text-right font-medium">{dept.totalComplaints}</td>
                          <td className="py-3 px-2 text-right font-semibold text-[#3B8F68]">
                            {dept.resolvedCount}
                          </td>
                          <td className="py-3 px-2 text-right font-semibold text-[#D98E2B]">
                            {dept.pendingCount}
                          </td>
                          <td className="py-3 px-2 text-right font-semibold text-rose-600">
                            {dept.repeatComplaintsCount}
                          </td>
                          <td className="py-3 px-2 text-right text-[#131E20] font-mono text-xs">
                            {dept.avgResolutionTimeHours !== null
                              ? dept.avgResolutionTimeHours.toFixed(2)
                              : 'N/A'}
                          </td>
                          <td className="py-3 pl-2 text-right">
                            <Badge variant="outline" className="border-[#E5E2D9]">
                              {dept.resolutionRatePct}%
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </AppShell>
  );
}

