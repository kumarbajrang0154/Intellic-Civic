'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/admin/page-header';
import { StatCard } from '@/components/admin/stat-card';
import { ComplaintsMap, type ComplaintMapItem } from '@/components/complaints-map';
import type { HeatClusterCell } from '@/lib/gis-heatmap';
import {
  AlertCircle,
  BarChart3,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  Flame,
  MapPin,
  RefreshCw,
  TrendingUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Complaint {
  id: string;
  status: string;
  priority: string | null;
  createdAt: string;
  resolvedAt?: string | null;
  category?: { name: string };
  department?: { name: string };
}

function BarMini({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-xs font-semibold text-slate-600 w-8 text-right">{value}</span>
    </div>
  );
}

export default function AnalyticsPage() {
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState({ name: 'Admin', role: 'ADMIN' });
  const [gisComplaints, setGisComplaints] = useState<ComplaintMapItem[]>([]);
  const [gisClusters, setGisClusters] = useState<HeatClusterCell[]>([]);
  const [gisTotal, setGisTotal] = useState(0);
  const [gisStatusFilter, setGisStatusFilter] = useState('');
  const [gisPriorityFilter, setGisPriorityFilter] = useState('');
  const [gisLoading, setGisLoading] = useState(true);
  const [gisError, setGisError] = useState<string | null>(null);

  const loadGisHeatmap = useCallback(async (statusFilter: string, priorityFilter: string) => {
    setGisLoading(true);
    setGisError(null);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      if (priorityFilter) params.set('priority', priorityFilter);
      const query = params.toString();
      const res = await fetch(`/api/admin/gis/heatmap${query ? `?${query}` : ''}`);
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload?.message || 'Unable to load GIS heatmap coordinates.');
      }
      setGisComplaints(payload.complaints || []);
      setGisClusters(payload.clusters || []);
      setGisTotal(typeof payload.totalGeotagged === 'number' ? payload.totalGeotagged : 0);
    } catch (err) {
      setGisError(err instanceof Error ? err.message : 'Unable to load GIS heatmap coordinates.');
    } finally {
      setGisLoading(false);
    }
  }, []);

  useEffect(() => {
    async function load() {
      try {
        const [cRes, meRes] = await Promise.all([
          fetch('/api/complaints?limit=500'),
          fetch('/api/auth/me'),
        ]);
        if (cRes.ok) {
          const data = await cRes.json();
          setComplaints(data.data || data.complaints || []);
        }
        if (meRes.ok) {
          const me = await meRes.json();
          setUser({ name: me.user?.name || 'Admin', role: me.user?.role || 'ADMIN' });
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  useEffect(() => {
    loadGisHeatmap(gisStatusFilter, gisPriorityFilter);
  }, [gisStatusFilter, gisPriorityFilter, loadGisHeatmap]);

  // Derived analytics
  const total = complaints.length;
  const resolved = complaints.filter((c) =>
    ['RESOLVED', 'CLOSED'].includes(c.status),
  ).length;
  const pending = complaints.filter((c) =>
    ['SUBMITTED', 'PENDING_DEPT_REVIEW'].includes(c.status),
  ).length;
  const inProgress = complaints.filter((c) => c.status === 'IN_PROGRESS').length;

  // Category breakdown
  const catMap: Record<string, number> = {};
  complaints.forEach((c) => {
    const k = c.category?.name ?? 'Uncategorized';
    catMap[k] = (catMap[k] || 0) + 1;
  });
  const catData = Object.entries(catMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);
  const catMax = catData[0]?.[1] ?? 1;

  // Department breakdown
  const deptMap: Record<string, { total: number; resolved: number; pending: number }> = {};
  complaints.forEach((c) => {
    const k = c.department?.name ?? 'Unassigned';
    if (!deptMap[k]) deptMap[k] = { total: 0, resolved: 0, pending: 0 };
    deptMap[k].total++;
    if (['RESOLVED', 'CLOSED'].includes(c.status)) deptMap[k].resolved++;
    if (['SUBMITTED', 'PENDING_DEPT_REVIEW', 'ASSIGNED'].includes(c.status))
      deptMap[k].pending++;
  });
  const deptData = Object.entries(deptMap)
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 8);

  // Priority breakdown
  const priorityMap: Record<string, number> = {};
  complaints.forEach((c) => {
    const k = c.priority ?? 'UNSET';
    priorityMap[k] = (priorityMap[k] || 0) + 1;
  });

  // Monthly trend (last 6 months)
  const monthlyMap: Record<string, number> = {};
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
    monthlyMap[key] = 0;
  }
  complaints.forEach((c) => {
    const d = new Date(c.createdAt);
    const key = d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
    if (key in monthlyMap) monthlyMap[key]++;
  });
  const monthlyData = Object.entries(monthlyMap);
  const monthMax = Math.max(...monthlyData.map((d) => d[1]), 1);

  const resolvedRate = total > 0 ? Math.round((resolved / total) * 100) : 0;

  return (
    <AppShell user={{ name: user.name, role: user.role as any }}>
      <div className="space-y-6">
        <PageHeader
          title="Analytics & Reports"
          description="Comprehensive complaint analytics and department performance insights"
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href="/admin/reports"
                className="inline-flex items-center justify-center h-9 px-3 rounded-lg border border-[#E5E2D9] bg-white hover:bg-[#F2EFE6] text-xs font-semibold text-[#131E20] transition-colors"
              >
                <BarChart3 className="w-4 h-4 mr-1.5 text-[#3468A1]" />
                Department Performance
              </Link>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  window.location.href = '/api/admin/reports/export';
                }}
              >
                <Download className="w-4 h-4 mr-2" />
                Export Report
              </Button>
            </div>
          }
        />

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Complaints"
            value={loading ? '—' : total}
            description="All time"
            icon={FileText}
            iconColor="text-ic-action"
            iconBg="bg-blue-50"
          />
          <StatCard
            title="Resolved"
            value={loading ? '—' : resolved}
            description={`${resolvedRate}% resolution rate`}
            icon={CheckCircle2}
            iconColor="text-emerald-600"
            iconBg="bg-emerald-50"
          />
          <StatCard
            title="Pending"
            value={loading ? '—' : pending}
            description="Need attention"
            icon={Clock}
            iconColor="text-amber-600"
            iconBg="bg-amber-50"
          />
          <StatCard
            title="In Progress"
            value={loading ? '—' : inProgress}
            description="Active field work"
            icon={TrendingUp}
            iconColor="text-indigo-600"
            iconBg="bg-indigo-50"
          />
        </div>

        {/* Monthly Trend + Category Breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Monthly Trend */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-base font-semibold text-slate-800">Monthly Complaint Trend</h2>
                <p className="text-xs text-slate-400 mt-0.5">Last 6 months</p>
              </div>
              <BarChart3 className="w-5 h-5 text-slate-300" />
            </div>
            <div className="flex items-end gap-2 h-32">
              {monthlyData.map(([month, count]) => (
                <div key={month} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full flex items-end justify-center" style={{ height: '96px' }}>
                    <div
                      className="w-full rounded-t transition-all duration-500"
                      style={{
                        height: `${Math.round((count / monthMax) * 96)}px`,
                        backgroundColor: '#3A83BD',
                        minHeight: count > 0 ? '4px' : '0',
                      }}
                    />
                  </div>
                  <span className="text-[9px] text-slate-400 font-medium text-center truncate w-full">
                    {month}
                  </span>
                  <span className="text-[10px] font-semibold text-slate-600">{count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Category Breakdown */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <div className="mb-4">
              <h2 className="text-base font-semibold text-slate-800">By Category</h2>
              <p className="text-xs text-slate-400 mt-0.5">Complaint distribution</p>
            </div>
            {loading ? (
              <div className="text-center text-sm text-slate-400 py-8">Loading…</div>
            ) : catData.length === 0 ? (
              <div className="text-center text-sm text-slate-400 py-8">No data</div>
            ) : (
              <div className="space-y-3">
                {catData.map(([name, count]) => (
                  <div key={name}>
                    <div className="flex justify-between text-xs text-slate-600 mb-1">
                      <span className="truncate max-w-[200px]">{name}</span>
                    </div>
                    <BarMini value={count} max={catMax} color="#3A83BD" />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Department Performance Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100">
            <h2 className="text-base font-semibold text-slate-800">Department Performance</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Complaint handling summary per department
            </p>
          </div>
          {loading ? (
            <div className="py-12 text-center text-sm text-slate-400">Loading…</div>
          ) : deptData.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-400">No department data</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    {['Department', 'Total Assigned', 'Resolved', 'Pending', 'Resolution Rate'].map(
                      (h) => (
                        <th
                          key={h}
                          className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide"
                        >
                          {h}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {deptData.map(([dept, counts]) => {
                    const rate =
                      counts.total > 0
                        ? Math.round((counts.resolved / counts.total) * 100)
                        : 0;
                    return (
                      <tr key={dept} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 font-medium text-slate-800">{dept}</td>
                        <td className="px-4 py-3 text-slate-600">{counts.total}</td>
                        <td className="px-4 py-3">
                          <span className="text-emerald-700 font-medium">{counts.resolved}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-amber-600 font-medium">{counts.pending}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-2 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-emerald-400 rounded-full"
                                style={{ width: `${rate}%` }}
                              />
                            </div>
                            <span className="text-xs font-semibold text-slate-700">{rate}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Priority Breakdown */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <h2 className="text-base font-semibold text-slate-800 mb-4">Priority Distribution</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { key: 'CRITICAL', label: 'Critical', color: '#ef4444', bg: 'bg-red-50' },
              { key: 'HIGH', label: 'High', color: '#f97316', bg: 'bg-orange-50' },
              { key: 'MEDIUM', label: 'Medium', color: '#f59e0b', bg: 'bg-amber-50' },
              { key: 'LOW', label: 'Low', color: '#10b981', bg: 'bg-emerald-50' },
            ].map((p) => {
              const count = priorityMap[p.key] ?? 0;
              return (
                <div key={p.key} className={`${p.bg} rounded-lg p-4 text-center`}>
                  <div
                    className="text-2xl font-bold mb-1"
                    style={{ color: p.color }}
                  >
                    {loading ? '—' : count}
                  </div>
                  <div className="text-xs font-medium text-slate-600">{p.label}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    {total > 0 ? Math.round((count / total) * 100) : 0}% of total
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* GIS Complaint Density Heatmap */}
        <section
          aria-labelledby="gis-heatmap-heading"
          className="rounded-xl border border-[#E5E2D9] bg-white p-4 sm:p-5 shadow-sm"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
            <div className="flex items-start gap-2.5">
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#F2EFE6] text-[#D98E2B]">
                <Flame className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <h2
                  id="gis-heatmap-heading"
                  className="text-base font-semibold text-[#131E20]"
                >
                  GIS Complaint Density Heatmap
                </h2>
                <p className="text-xs text-[#6E6B64]">
                  Spatial hotspot concentration weighted by complaint priority ({gisTotal}{' '}
                  geotagged records)
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <label className="sr-only" htmlFor="gis-status-filter">
                Filter heatmap by status
              </label>
              <select
                id="gis-status-filter"
                value={gisStatusFilter}
                onChange={(e) => setGisStatusFilter(e.target.value)}
                className="h-9 rounded-lg border border-[#E5E2D9] bg-[#F2EFE6]/60 px-2.5 text-xs font-medium text-[#131E20] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3468A1]"
              >
                <option value="">All Statuses</option>
                <option value="SUBMITTED">Submitted</option>
                <option value="PENDING_DEPT_REVIEW">Pending Review</option>
                <option value="ASSIGNED">Assigned</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="RESOLVED">Resolved</option>
              </select>

              <label className="sr-only" htmlFor="gis-priority-filter">
                Filter heatmap by priority
              </label>
              <select
                id="gis-priority-filter"
                value={gisPriorityFilter}
                onChange={(e) => setGisPriorityFilter(e.target.value)}
                className="h-9 rounded-lg border border-[#E5E2D9] bg-[#F2EFE6]/60 px-2.5 text-xs font-medium text-[#131E20] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3468A1]"
              >
                <option value="">All Priorities</option>
                <option value="CRITICAL">Critical</option>
                <option value="HIGH">High</option>
                <option value="MEDIUM">Medium</option>
                <option value="LOW">Low</option>
              </select>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => loadGisHeatmap(gisStatusFilter, gisPriorityFilter)}
                disabled={gisLoading}
                className="border-[#E5E2D9] text-[#131E20] hover:bg-[#F2EFE6]"
              >
                <RefreshCw
                  className={`mr-1.5 h-3.5 w-3.5 ${gisLoading ? 'animate-spin' : ''}`}
                  aria-hidden="true"
                />
                Refresh
              </Button>
            </div>
          </div>

          {gisLoading ? (
            <div
              role="status"
              aria-live="polite"
              className="flex h-[360px] items-center justify-center rounded-xl border border-dashed border-[#E5E2D9] bg-[#F2EFE6]/40 text-sm text-[#6E6B64]"
            >
              Loading GIS hotspot layer...
            </div>
          ) : gisError ? (
            <div
              role="alert"
              className="flex flex-col items-center justify-center gap-3 rounded-xl border border-red-200 bg-red-50/70 p-6 text-center"
            >
              <AlertCircle className="h-6 w-6 text-red-600" aria-hidden="true" />
              <p className="text-sm font-medium text-red-900">{gisError}</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => loadGisHeatmap(gisStatusFilter, gisPriorityFilter)}
              >
                Retry Heatmap
              </Button>
            </div>
          ) : gisComplaints.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[#E5E2D9] bg-[#F2EFE6]/40 p-8 text-center">
              <MapPin className="h-7 w-7 text-[#6E6B64]" aria-hidden="true" />
              <p className="text-sm font-semibold text-[#131E20]">
                No geotagged complaints match the current filter
              </p>
              <p className="text-xs text-[#6E6B64]">
                Try clearing status or priority filters to view citywide hotspots.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <ComplaintsMap
                  complaints={gisComplaints}
                  detailRoutePrefix="/admin/complaints"
                  initialViewMode="both"
                  showLayerToggle={true}
                  className="h-[380px] sm:h-[420px] w-full rounded-xl overflow-hidden shadow-sm border border-[#E5E2D9]"
                />
              </div>

              <div className="flex flex-col rounded-xl border border-[#E5E2D9] bg-[#F2EFE6]/40 p-3.5">
                <div className="mb-2.5 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-[#131E20]">
                    Top Hotspot Grid Cells
                  </h3>
                  <span className="text-[11px] font-medium text-[#6E6B64]">
                    Top {Math.min(6, gisClusters.length)} zones
                  </span>
                </div>

                {gisClusters.length === 0 ? (
                  <p className="text-xs text-[#6E6B64]">No cluster cells computed.</p>
                ) : (
                  <ul className="space-y-2 overflow-y-auto max-h-[360px]">
                    {gisClusters.slice(0, 6).map((cluster, idx) => (
                      <li
                        key={cluster.cellKey}
                        className="rounded-lg border border-[#E5E2D9] bg-white p-2.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#131E20]">
                            <span
                              className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: cluster.color }}
                              aria-hidden="true"
                            />
                            Zone #{idx + 1}
                          </span>
                          <span className="rounded-full bg-[#F2EFE6] px-2 py-0.5 text-[11px] font-semibold text-[#131E20]">
                            {cluster.count} complaints
                          </span>
                        </div>
                        <div className="mt-1.5 flex items-center justify-between text-[11px] text-[#6E6B64]">
                          <span className="font-mono">
                            {cluster.centerLat.toFixed(4)}, {cluster.centerLng.toFixed(4)}
                          </span>
                          <span>
                            {cluster.criticalOrHighCount} High/Critical
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
