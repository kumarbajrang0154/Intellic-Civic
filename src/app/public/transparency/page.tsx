'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  BarChart3,
  Building2,
  CheckCircle2,
  Clock,
  Filter,
  Inbox,
  MapPin,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { PublicTransparencyReport } from '@/services/transparency-service';

export default function PublicTransparencyPage() {
  const [report, setReport] = React.useState<PublicTransparencyReport | null>(null);
  const [departmentFilter, setDepartmentFilter] = React.useState<string>('');
  const [wardFilter, setWardFilter] = React.useState<string>('');
  const [loading, setLoading] = React.useState<boolean>(true);
  const [refreshing, setRefreshing] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string | null>(null);

  const loadReport = React.useCallback(
    async (dept: string, ward: string, isRefresh = false) => {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);
      try {
        const params = new URLSearchParams();
        if (dept) params.set('departmentId', dept);
        if (ward) params.set('ward', ward);
        const query = params.toString();
        const res = await fetch(`/api/public/transparency${query ? `?${query}` : ''}`);
        const json = await res.json().catch(() => null);
        if (!res.ok || !json?.data) {
          throw new Error(json?.message || 'Unable to load public transparency metrics.');
        }
        setReport(json.data);
      } catch (err: unknown) {
        setError(
          err instanceof Error
            ? err.message
            : 'Unable to load public transparency metrics. Please try again.',
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [],
  );

  React.useEffect(() => {
    loadReport(departmentFilter, wardFilter);
  }, [departmentFilter, wardFilter, loadReport]);

  const handleResetFilters = () => {
    setDepartmentFilter('');
    setWardFilter('');
  };

  const hasActiveFilters = Boolean(departmentFilter || wardFilter);
  const isEmpty = Boolean(report && report.summary.total === 0);

  return (
    <div className="min-h-screen bg-[#F2EFE6] text-[#131E20] font-sans">
      <header className="bg-white border-b border-[#E5E2D9] sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-[#C9DFDC] flex items-center justify-center text-[#131E20] shrink-0">
              <BarChart3 className="w-5 h-5 text-[#3468A1]" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] font-bold uppercase tracking-widest text-[#6E6B64]">
                IntelliCivic Open Civic Data
              </div>
              <h1 className="text-lg sm:text-xl font-extrabold text-[#131E20] truncate">
                Public Transparency Dashboard
              </h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="success" className="gap-1.5 py-1 px-3">
              <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
              Zero Citizen PII Exposed
            </Badge>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-11 sm:h-9 rounded-full border-[#E5E2D9] bg-white hover:bg-[#F2EFE6]"
              onClick={() => loadReport(departmentFilter, wardFilter, true)}
              disabled={loading || refreshing}
            >
              <RefreshCw
                className={`w-4 h-4 mr-1.5 ${refreshing ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
              Refresh
            </Button>
            <Link
              href="/login/citizen"
              className="inline-flex items-center justify-center h-11 sm:h-9 px-4 rounded-full bg-[#3468A1] hover:bg-[#2B5687] text-white text-xs font-bold transition-colors focus:outline-none focus:ring-2 focus:ring-[#3468A1] focus:ring-offset-2"
            >
              <ArrowLeft className="w-3.5 h-3.5 mr-1.5" aria-hidden="true" />
              Citizen Portal
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
        {/* Privacy & Filter Controls */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
              <div className="space-y-1 max-w-2xl">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#3468A1]">
                  <Filter className="w-3.5 h-3.5" aria-hidden="true" />
                  Read-Only Civic Metrics
                </div>
                <p className="text-sm text-[#6E6B64]">
                  Live aggregated complaint resolution counts across municipal departments and civic wards. No citizen names, phone numbers, emails, or street addresses are stored or returned here.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex lg:items-center gap-3 w-full lg:w-auto">
                <div className="flex flex-col gap-1 min-w-[180px]">
                  <label
                    htmlFor="transparency-department-filter"
                    className="text-xs font-semibold text-[#6E6B64]"
                  >
                    Department
                  </label>
                  <select
                    id="transparency-department-filter"
                    value={departmentFilter}
                    onChange={(e) => setDepartmentFilter(e.target.value)}
                    disabled={loading}
                    className="h-11 px-3 rounded-xl border border-[#E5E2D9] bg-white text-sm text-[#131E20] focus:outline-none focus:ring-2 focus:ring-[#3468A1]"
                  >
                    <option value="">All Departments</option>
                    {(report?.availableDepartments || []).map((dept) => (
                      <option key={dept.id} value={dept.id}>
                        {dept.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1 min-w-[180px]">
                  <label
                    htmlFor="transparency-ward-filter"
                    className="text-xs font-semibold text-[#6E6B64]"
                  >
                    Ward / Zone
                  </label>
                  <select
                    id="transparency-ward-filter"
                    value={wardFilter}
                    onChange={(e) => setWardFilter(e.target.value)}
                    disabled={loading}
                    className="h-11 px-3 rounded-xl border border-[#E5E2D9] bg-white text-sm text-[#131E20] focus:outline-none focus:ring-2 focus:ring-[#3468A1]"
                  >
                    <option value="">All Wards / Zones</option>
                    {(report?.availableWards || []).map((ward) => (
                      <option key={ward} value={ward}>
                        {ward}
                      </option>
                    ))}
                  </select>
                </div>

                {hasActiveFilters && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleResetFilters}
                    className="h-11 text-[#3468A1] hover:bg-[#F2EFE6]"
                  >
                    Clear Filters
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Error State */}
        {error && (
          <Card className="border-rose-200 bg-rose-50" role="alert">
            <CardContent className="pt-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" aria-hidden="true" />
                <div>
                  <h2 className="text-sm font-bold text-rose-900">Unable to load transparency data</h2>
                  <p className="text-xs text-rose-700 mt-0.5">{error}</p>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-11 sm:h-9 border-rose-300 text-rose-900 bg-white hover:bg-rose-100 shrink-0"
                onClick={() => loadReport(departmentFilter, wardFilter)}
              >
                Retry
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Loading State */}
        {loading && !error && (
          <div className="space-y-6" aria-busy="true" aria-label="Loading transparency metrics">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[0, 1, 2, 3].map((idx) => (
                <Card key={idx}>
                  <CardContent className="pt-6 space-y-3">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-8 w-20" />
                    <Skeleton className="h-3 w-36" />
                  </CardContent>
                </Card>
              ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardContent className="pt-6 space-y-3">
                  <Skeleton className="h-5 w-48" />
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6 space-y-3">
                  <Skeleton className="h-5 w-48" />
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && isEmpty && (
          <Card>
            <CardContent className="py-14 flex flex-col items-center justify-center text-center">
              <div className="w-12 h-12 rounded-2xl bg-[#F2EFE6] flex items-center justify-center text-[#6E6B64] mb-3">
                <Inbox className="w-6 h-6" aria-hidden="true" />
              </div>
              <h2 className="text-base font-bold text-[#131E20]">
                No Public Complaint Aggregates Available
              </h2>
              <p className="text-sm text-[#6E6B64] max-w-md mt-1">
                {hasActiveFilters
                  ? 'No civic complaints match the selected department or ward filters.'
                  : 'No civic complaint statistics have been recorded yet.'}
              </p>
              {hasActiveFilters && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-4 h-11 sm:h-9"
                  onClick={handleResetFilters}
                >
                  Show All Departments & Wards
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {/* Success State */}
        {!loading && !error && report && !isEmpty && (
          <>
            {/* KPI Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#6E6B64]">
                      Total Recorded
                    </span>
                    <Activity className="w-4 h-4 text-[#3468A1]" aria-hidden="true" />
                  </div>
                  <div className="text-3xl font-extrabold text-[#131E20] mt-2">
                    {report.summary.total}
                  </div>
                  <p className="text-xs text-[#6E6B64] mt-1">
                    Avg resolution:{' '}
                    {report.summary.avgResolutionHours !== null
                      ? `${report.summary.avgResolutionHours} hrs`
                      : 'N/A'}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#6E6B64]">
                      Resolved & Closed
                    </span>
                    <CheckCircle2 className="w-4 h-4 text-[#3B8F68]" aria-hidden="true" />
                  </div>
                  <div className="text-3xl font-extrabold text-[#3B8F68] mt-2">
                    {report.summary.resolved}
                  </div>
                  <p className="text-xs text-[#6E6B64] mt-1">
                    {report.summary.resolutionRatePct}% completion rate
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#6E6B64]">
                      Pending Triage / Queue
                    </span>
                    <Clock className="w-4 h-4 text-[#D98E2B]" aria-hidden="true" />
                  </div>
                  <div className="text-3xl font-extrabold text-[#D98E2B] mt-2">
                    {report.summary.pending}
                  </div>
                  <p className="text-xs text-[#6E6B64] mt-1">
                    Submitted, reviewing, or assigned
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#6E6B64]">
                      Work In Progress
                    </span>
                    <Building2 className="w-4 h-4 text-[#3468A1]" aria-hidden="true" />
                  </div>
                  <div className="text-3xl font-extrabold text-[#3468A1] mt-2">
                    {report.summary.inProgress}
                  </div>
                  <p className="text-xs text-[#6E6B64] mt-1">
                    Active field resolution
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Department & Ward Breakdowns */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Department-wise */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-[#3468A1]" aria-hidden="true" />
                        Department Resolution Breakdown
                      </CardTitle>
                      <CardDescription>
                        Resolved vs pending counts by municipal department
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead>
                        <tr className="border-b border-[#E5E2D9] text-xs font-bold uppercase tracking-wider text-[#6E6B64]">
                          <th className="py-2.5 pr-3">Department</th>
                          <th className="py-2.5 px-2 text-right">Resolved</th>
                          <th className="py-2.5 px-2 text-right">Pending</th>
                          <th className="py-2.5 px-2 text-right">Active</th>
                          <th className="py-2.5 pl-2 text-right">Rate</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E5E2D9]/60">
                        {report.byDepartment.map((dept) => (
                          <tr key={dept.departmentId} className="hover:bg-[#F2EFE6]/50">
                            <td className="py-3 pr-3 font-semibold text-[#131E20]">
                              {dept.departmentName}
                            </td>
                            <td className="py-3 px-2 text-right font-semibold text-[#3B8F68]">
                              {dept.resolved}
                            </td>
                            <td className="py-3 px-2 text-right font-semibold text-[#D98E2B]">
                              {dept.pending}
                            </td>
                            <td className="py-3 px-2 text-right text-[#3468A1] font-medium">
                              {dept.inProgress}
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

              {/* Ward-wise */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-[#3468A1]" aria-hidden="true" />
                    Ward & Zone Summary
                  </CardTitle>
                  <CardDescription>
                    Aggregated counts grouped strictly by coarse ward or locality zone
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead>
                        <tr className="border-b border-[#E5E2D9] text-xs font-bold uppercase tracking-wider text-[#6E6B64]">
                          <th className="py-2.5 pr-3">Ward / Zone</th>
                          <th className="py-2.5 px-2 text-right">Resolved</th>
                          <th className="py-2.5 px-2 text-right">Pending</th>
                          <th className="py-2.5 px-2 text-right">Active</th>
                          <th className="py-2.5 pl-2 text-right">Rate</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E5E2D9]/60">
                        {report.byWard.map((w) => (
                          <tr key={w.ward} className="hover:bg-[#F2EFE6]/50">
                            <td className="py-3 pr-3 font-semibold text-[#131E20]">{w.ward}</td>
                            <td className="py-3 px-2 text-right font-semibold text-[#3B8F68]">
                              {w.resolved}
                            </td>
                            <td className="py-3 px-2 text-right font-semibold text-[#D98E2B]">
                              {w.pending}
                            </td>
                            <td className="py-3 px-2 text-right text-[#3468A1] font-medium">
                              {w.inProgress}
                            </td>
                            <td className="py-3 pl-2 text-right">
                              <Badge variant="outline" className="border-[#E5E2D9]">
                                {w.resolutionRatePct}%
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="text-xs text-[#6E6B64] flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-6">
              <span>
                Last generated: {new Date(report.generatedAt).toLocaleString()}
              </span>
              <span>
                Staff members:{' '}
                <Link href="/login/staff" className="text-[#3468A1] font-semibold hover:underline">
                  Sign in to Municipal Portal
                </Link>
              </span>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

