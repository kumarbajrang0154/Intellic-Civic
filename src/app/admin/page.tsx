'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Building2,
  CheckCircle2,
  Clock,
  FileText,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { StatCard } from '@/components/admin/stat-card';
import { StatusBadge } from '@/components/admin/status-badge';
import { PriorityBadge } from '@/components/admin/priority-badge';
import { PageHeader } from '@/components/admin/page-header';
import { Button } from '@/components/ui/button';

interface SystemStats {
  totalComplaints: number;
  statusBreakdown: Record<string, number>;
  needsTriageCount: number;
  pendingUserApprovalsCount: number;
  departmentCount: number;
  totalStaffCount: number;
}

interface RecentComplaint {
  id: string;
  ticketId: string;
  title: string;
  status: string;
  priority: string | null;
  createdAt: string;
  citizen?: { name: string };
  category?: { name: string };
}

// ─── Inline SVG Bar Chart ────────────────────────────────────────────────────

function MiniBarChart({ data }: { data: { label: string; value: number; color: string }[] }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="flex items-end gap-2 h-24 w-full">
      {data.map((item) => (
        <div key={item.label} className="flex-1 flex flex-col items-center gap-1">
          <div className="w-full flex items-end justify-center" style={{ height: '80px' }}>
            <div
              className="w-full rounded-t-sm transition-all duration-500"
              style={{
                height: `${Math.round((item.value / max) * 80)}px`,
                backgroundColor: item.color,
                minHeight: item.value > 0 ? '4px' : '0',
              }}
            />
          </div>
          <span className="text-[9px] text-slate-500 font-medium truncate w-full text-center">
            {item.label}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Donut-style ring ────────────────────────────────────────────────────────

function RingChart({
  segments,
}: {
  segments: { label: string; value: number; color: string }[];
}) {
  const total = segments.reduce((s, d) => s + d.value, 0) || 1;
  let cumulativePercent = 0;

  const createConicStyle = () => {
    const parts: string[] = [];
    for (const seg of segments) {
      const pct = (seg.value / total) * 100;
      parts.push(`${seg.color} ${cumulativePercent}% ${cumulativePercent + pct}%`);
      cumulativePercent += pct;
    }
    return `conic-gradient(${parts.join(', ')})`;
  };

  return (
    <div className="flex items-center gap-5">
      <div
        className="w-24 h-24 rounded-full shrink-0"
        style={{
          background: createConicStyle(),
          WebkitMask: 'radial-gradient(circle at center, transparent 36%, black 37%)',
          mask: 'radial-gradient(circle at center, transparent 36%, black 37%)',
        }}
      />
      <div className="space-y-1.5 min-w-0">
        {segments.map((seg) => (
          <div key={seg.label} className="flex items-center gap-2">
            <div
              className="w-2.5 h-2.5 rounded-sm shrink-0"
              style={{ backgroundColor: seg.color }}
            />
            <span className="text-xs text-slate-600 truncate">{seg.label}</span>
            <span className="text-xs font-semibold text-slate-800 ml-auto pl-2">
              {seg.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Dashboard Page ──────────────────────────────────────────────────────────

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [recentComplaints, setRecentComplaints] = useState<RecentComplaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<{ name: string; role: string }>({
    name: 'Admin',
    role: 'ADMIN',
  });

  useEffect(() => {
    async function fetchAll() {
      try {
        const [statsRes, meRes, complaintsRes] = await Promise.all([
          fetch('/api/admin/stats'),
          fetch('/api/auth/me'),
          fetch('/api/complaints?limit=8&sort=createdAt&order=desc'),
        ]);

        if (statsRes.ok) setStats(await statsRes.json());
        if (meRes.ok) {
          const me = await meRes.json();
          setUser({ name: me.name || 'Admin', role: me.role || 'ADMIN' });
        }
        if (complaintsRes.ok) {
          const data = await complaintsRes.json();
          setRecentComplaints(data.data || data.complaints || []);
        }
      } catch (err) {
        console.error('Dashboard fetch error:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchAll();
  }, []);

  const sb = stats?.statusBreakdown ?? {};

  const statusChartData = [
    { label: 'Submitted', value: sb.SUBMITTED ?? 0, color: '#94a3b8' },
    { label: 'Pending', value: sb.PENDING_DEPT_REVIEW ?? 0, color: '#f59e0b' },
    { label: 'Assigned', value: sb.ASSIGNED ?? 0, color: '#3b82f6' },
    { label: 'In Progress', value: sb.IN_PROGRESS ?? 0, color: '#6366f1' },
    { label: 'Resolved', value: sb.RESOLVED ?? 0, color: '#10b981' },
    { label: 'Closed', value: sb.CLOSED ?? 0, color: '#64748b' },
    { label: 'Rejected', value: sb.REJECTED ?? 0, color: '#ef4444' },
    { label: 'Duplicate', value: sb.DUPLICATE ?? 0, color: '#f97316' },
  ];

  const priorityData = [
    { label: 'Critical', value: recentComplaints.filter((c) => c.priority === 'CRITICAL').length, color: '#ef4444' },
    { label: 'High', value: recentComplaints.filter((c) => c.priority === 'HIGH').length, color: '#f97316' },
    { label: 'Medium', value: recentComplaints.filter((c) => c.priority === 'MEDIUM').length, color: '#f59e0b' },
    { label: 'Low', value: recentComplaints.filter((c) => c.priority === 'LOW').length, color: '#10b981' },
  ];

  const totalResolved = (sb.RESOLVED ?? 0) + (sb.CLOSED ?? 0);
  const resolvedRate =
    stats && stats.totalComplaints > 0
      ? Math.round((totalResolved / stats.totalComplaints) * 100)
      : 0;

  return (
    <AppShell user={{ name: user.name, role: user.role as any }}>
      <div className="space-y-6 sm:space-y-8">
        {/* Page Header */}
        <PageHeader
          title="Admin Dashboard"
          description="System-wide overview of complaints, departments, and governance operations"
          actions={
            <>
              <Link href="/admin/complaints/pending">
                <Button
                  size="sm"
                  className="bg-amber-500 hover:bg-amber-600 text-white border-0"
                >
                  <AlertTriangle className="w-4 h-4 mr-2" />
                  Triage ({(sb.SUBMITTED ?? 0) + (sb.PENDING_DEPT_REVIEW ?? 0)})
                </Button>
              </Link>
              <Link href="/admin/users/admin-accounts">
                <Button variant="outline" size="sm">
                  <ShieldAlert className="w-4 h-4 mr-2" />
                  Approvals ({stats?.pendingUserApprovalsCount ?? 0})
                </Button>
              </Link>
            </>
          }
        />

        {/* ── Stats Grid ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard
            title="Total Complaints"
            value={loading ? '—' : (stats?.totalComplaints ?? 0)}
            description="All-time system-wide"
            icon={FileText}
            iconColor="text-ic-action"
            iconBg="bg-blue-50"
          />
          <StatCard
            title="Needs Attention"
            value={loading ? '—' : (stats?.needsTriageCount ?? 0)}
            description="Submitted + pending review"
            icon={AlertTriangle}
            iconColor="text-amber-600"
            iconBg="bg-amber-50"
          />
          <StatCard
            title="Pending Approvals"
            value={loading ? '—' : (stats?.pendingUserApprovalsCount ?? 0)}
            description="Staff accounts awaiting auth"
            icon={ShieldAlert}
            iconColor="text-indigo-600"
            iconBg="bg-indigo-50"
          />
          <StatCard
            title="In Progress"
            value={loading ? '—' : (sb.IN_PROGRESS ?? 0)}
            description="Active field work"
            icon={Zap}
            iconColor="text-emerald-600"
            iconBg="bg-emerald-50"
          />
          <StatCard
            title="Resolved"
            value={loading ? '—' : totalResolved}
            description={`${resolvedRate}% resolution rate`}
            icon={CheckCircle2}
            iconColor="text-emerald-600"
            iconBg="bg-emerald-50"
          />
          <StatCard
            title="Departments"
            value={loading ? '—' : (stats?.departmentCount ?? 0)}
            description="Active departments"
            icon={Building2}
            iconColor="text-purple-600"
            iconBg="bg-purple-50"
          />
          <StatCard
            title="Authorized Staff"
            value={loading ? '—' : (stats?.totalStaffCount ?? 0)}
            description="Active staff accounts"
            icon={Users}
            iconColor="text-ic-blue"
            iconBg="bg-blue-50"
          />
          <StatCard
            title="Assigned"
            value={loading ? '—' : (sb.ASSIGNED ?? 0)}
            description="Awaiting field work"
            icon={Clock}
            iconColor="text-blue-600"
            iconBg="bg-blue-50"
          />
        </div>

        {/* ── Charts Row ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Status Distribution */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-semibold text-slate-800">
                  Complaint Status Distribution
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">All-time breakdown by status</p>
              </div>
              <BarChart3 className="w-5 h-5 text-slate-300" />
            </div>
            <MiniBarChart data={statusChartData} />
          </div>

          {/* Priority Distribution */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-semibold text-slate-800">Priority Split</h2>
                <p className="text-xs text-slate-400 mt-0.5">Recent 8 complaints</p>
              </div>
              <Sparkles className="w-5 h-5 text-slate-300" />
            </div>
            <RingChart segments={priorityData} />
          </div>
        </div>

        {/* ── Resolution Rate Progress ── */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-slate-800">Resolution Overview</h2>
              <p className="text-xs text-slate-400 mt-0.5">Complaint resolution breakdown</p>
            </div>
            <TrendingUp className="w-5 h-5 text-ic-action" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Submitted', value: sb.SUBMITTED ?? 0, color: 'bg-slate-200', pct: stats?.totalComplaints ? Math.round(((sb.SUBMITTED ?? 0) / stats.totalComplaints) * 100) : 0 },
              { label: 'In Progress', value: (sb.ASSIGNED ?? 0) + (sb.IN_PROGRESS ?? 0), color: 'bg-blue-400', pct: stats?.totalComplaints ? Math.round((((sb.ASSIGNED ?? 0) + (sb.IN_PROGRESS ?? 0)) / stats.totalComplaints) * 100) : 0 },
              { label: 'Resolved', value: sb.RESOLVED ?? 0, color: 'bg-emerald-400', pct: stats?.totalComplaints ? Math.round(((sb.RESOLVED ?? 0) / stats.totalComplaints) * 100) : 0 },
              { label: 'Closed', value: sb.CLOSED ?? 0, color: 'bg-slate-400', pct: stats?.totalComplaints ? Math.round(((sb.CLOSED ?? 0) / stats.totalComplaints) * 100) : 0 },
            ].map((item) => (
              <div key={item.label} className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">{item.label}</span>
                  <span className="font-semibold text-slate-700">{item.value}</span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${item.color}`}
                    style={{ width: `${item.pct}%` }}
                  />
                </div>
                <div className="text-[10px] text-slate-400">{item.pct}%</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Bottom Row: Recent Complaints + Quick Actions ── */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
          {/* Recent Complaints Table */}
          <div className="xl:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-800">Recent Complaints</h2>
                <p className="text-xs text-slate-400 mt-0.5">Latest 8 submitted complaints</p>
              </div>
              <Link href="/admin/complaints">
                <Button variant="outline" size="sm" className="text-xs">
                  View All
                  <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </Button>
              </Link>
            </div>

            {loading ? (
              <div className="p-8 text-center text-sm text-slate-400">Loading...</div>
            ) : recentComplaints.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-400">
                No complaints yet
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/50">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                        Ticket
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide hidden sm:table-cell">
                        Category
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                        Priority
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                        Status
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide hidden md:table-cell">
                        Date
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {recentComplaints.map((c) => (
                      <tr
                        key={c.id}
                        className="hover:bg-slate-50 transition-colors cursor-pointer"
                      >
                        <td className="px-4 py-3">
                          <Link
                            href={`/admin/complaints/${c.id}`}
                            className="flex flex-col"
                          >
                            <span className="font-mono text-xs text-ic-action font-semibold">
                              #{c.ticketId}
                            </span>
                            <span className="text-slate-600 text-xs truncate max-w-[140px] mt-0.5">
                              {c.title}
                            </span>
                          </Link>
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell">
                          <span className="text-xs text-slate-500">
                            {c.category?.name ?? '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <PriorityBadge priority={c.priority} />
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={c.status} />
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          <span className="text-xs text-slate-400">
                            {new Date(c.createdAt).toLocaleDateString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                            })}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <h2 className="text-base font-semibold text-slate-800 mb-4">Quick Actions</h2>
            <div className="space-y-2">
              {[
                {
                  href: '/admin/complaints/pending',
                  icon: AlertTriangle,
                  iconClass: 'text-amber-500',
                  bgClass: 'bg-amber-50',
                  label: 'Review Pending',
                  sub: 'Assign unreviewed issues',
                },
                {
                  href: '/admin/users/admin-accounts',
                  icon: ShieldAlert,
                  iconClass: 'text-indigo-600',
                  bgClass: 'bg-indigo-50',
                  label: 'Staff Approvals',
                  sub: 'Authorize Google signups',
                },
                {
                  href: '/admin/departments',
                  icon: Building2,
                  iconClass: 'text-purple-600',
                  bgClass: 'bg-purple-50',
                  label: 'Departments',
                  sub: 'Create & manage departments',
                },
                {
                  href: '/admin/ai/logs',
                  icon: Sparkles,
                  iconClass: 'text-blue-600',
                  bgClass: 'bg-blue-50',
                  label: 'AI Logs',
                  sub: 'Review AI classifications',
                },
                {
                  href: '/admin/analytics',
                  icon: BarChart3,
                  iconClass: 'text-ic-action',
                  bgClass: 'bg-ic-light',
                  label: 'Analytics',
                  sub: 'View performance reports',
                },
                {
                  href: '/admin/settings',
                  icon: Users,
                  iconClass: 'text-slate-600',
                  bgClass: 'bg-slate-100',
                  label: 'Organization Settings',
                  sub: 'Manage platform config',
                },
              ].map((action) => {
                const Icon = action.icon;
                return (
                  <Link
                    key={action.href}
                    href={action.href}
                    className="flex items-center gap-3 p-3 rounded-lg border border-transparent hover:border-slate-200 hover:bg-slate-50 transition-all group"
                  >
                    <div
                      className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${action.bgClass}`}
                    >
                      <Icon className={`w-4 h-4 ${action.iconClass}`} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-slate-700 group-hover:text-ic-action transition-colors">
                        {action.label}
                      </div>
                      <div className="text-xs text-slate-400">{action.sub}</div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-ic-action ml-auto shrink-0 transition-colors" />
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
