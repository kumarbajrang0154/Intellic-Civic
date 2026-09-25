'use client';

import React, { useEffect, useState } from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/admin/page-header';
import { EmptyState } from '@/components/admin/empty-state';
import { ShieldCheck, Users, Activity, FileSearch } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

interface StaffMember {
  id: string;
  name: string;
  email?: string;
  role: string;
  isActive?: boolean;
  isAuthorized: boolean;
  isSuspended?: boolean;
  department?: { name: string };
  createdAt: string;
}

interface AuditEntry {
  id: string;
  action: string;
  entityType: string;
  entityId?: string;
  metadata?: Record<string, any>;
  createdAt: string;
  user?: { name: string; role: string };
}

const ROLE_ACCESS: { role: string; access: string[] }[] = [
  {
    role: 'SUPER_ADMIN',
    access: [
      'Full platform access',
      'Organization Settings',
      'All complaint management',
      'All user management',
      'Security & audit logs',
      'System configuration',
    ],
  },
  {
    role: 'ADMIN',
    access: [
      'Complaint management',
      'Triage queue',
      'Department management',
      'User approvals',
      'Staff management',
    ],
  },
  {
    role: 'DEPARTMENT_HEAD',
    access: [
      'Department complaints',
      'AI suggestion review',
      'Team roster',
      'Department analytics',
    ],
  },
  {
    role: 'DEPARTMENT_OFFICER',
    access: ['Assigned complaints', 'Status updates', 'Evidence upload'],
  },
];

const ROLE_COLORS: Record<string, string> = {
  SUPER_ADMIN: 'bg-amber-50 border-amber-200 text-amber-800',
  ADMIN: 'bg-blue-50 border-blue-200 text-blue-800',
  DEPARTMENT_HEAD: 'bg-purple-50 border-purple-200 text-purple-800',
  DEPARTMENT_OFFICER: 'bg-indigo-50 border-indigo-200 text-indigo-800',
};

export default function SecurityPage() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [user, setUser] = useState({ name: 'Admin', role: 'ADMIN' });
  const [activeTab, setActiveTab] = useState<'overview' | 'accounts' | 'audit'>('overview');

  useEffect(() => {
    async function load() {
      try {
        const [staffRes, meRes] = await Promise.all([
          fetch('/api/admin/staff'),
          fetch('/api/auth/me'),
        ]);
        if (staffRes.ok) {
          const data = await staffRes.json();
          setStaff(data.items || data.staff || []);
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
    if (activeTab === 'audit' && auditLogs.length === 0) {
      setLoadingAudit(true);
      fetch('/api/admin/audit-logs')
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data && data.items) {
            setAuditLogs(data.items);
          }
        })
        .catch(console.error)
        .finally(() => setLoadingAudit(false));
    }
  }, [activeTab, auditLogs.length]);

  const authorizedCount = staff.filter((s) => s.isActive && s.isAuthorized).length;
  const suspendedCount = staff.filter((s) => !s.isActive).length;
  const pendingCount = staff.filter((s) => s.isActive && !s.isAuthorized).length;

  return (
    <AppShell user={{ name: user.name, role: user.role as any }}>
      <div className="space-y-6">
        <PageHeader
          title="Security & Access"
          description="Role-based access control, authorized admin accounts, and audit logs"
        />

        {/* Tabs */}
        <div className="flex gap-2 border-b border-slate-200">
          {(['overview', 'accounts', 'audit'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors capitalize ${
                activeTab === tab
                  ? 'border-ic-action text-ic-action'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab === 'overview' ? 'Role Overview' : tab === 'accounts' ? 'Admin Accounts' : 'Audit Logs'}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-5">
            {/* Summary stats */}
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: 'Authorized', value: authorizedCount, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                { label: 'Pending Auth', value: pendingCount, color: 'text-amber-600', bg: 'bg-amber-50' },
                { label: 'Suspended', value: suspendedCount, color: 'text-red-600', bg: 'bg-red-50' },
              ].map((item) => (
                <div
                  key={item.label}
                  className={`${item.bg} rounded-xl p-5 text-center border border-slate-200`}
                >
                  <div className={`text-3xl font-bold ${item.color}`}>
                    {loading ? '—' : item.value}
                  </div>
                  <div className="text-sm text-slate-600 mt-1">{item.label}</div>
                </div>
              ))}
            </div>

            {/* Role Access Matrix */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {ROLE_ACCESS.map((roleInfo) => (
                <div
                  key={roleInfo.role}
                  className={`rounded-xl border p-5 ${ROLE_COLORS[roleInfo.role] ?? 'bg-slate-50 border-slate-200 text-slate-800'}`}
                >
                  <div className="font-semibold mb-3 text-sm">{roleInfo.role}</div>
                  <ul className="space-y-1">
                    {roleInfo.access.map((item) => (
                      <li key={item} className="flex items-center gap-2 text-xs opacity-80">
                        <ShieldCheck className="w-3 h-3 shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Accounts Tab */}
        {activeTab === 'accounts' && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            {loading ? (
              <div className="py-20 text-center text-sm text-slate-400">Loading…</div>
            ) : staff.length === 0 ? (
              <EmptyState
                icon={Users}
                title="No admin accounts"
                description="No staff accounts have been created yet."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50">
                      {['Name', 'Email', 'Role', 'Status', 'Department', 'Actions'].map((h) => (
                        <th
                          key={h}
                          className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {staff.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 font-medium text-slate-800">{s.name}</td>
                        <td className="px-4 py-3 text-xs text-slate-500">{s.email ?? '—'}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border ${
                              ROLE_COLORS[s.role] ?? 'bg-slate-100 text-slate-600 border-slate-200'
                            }`}
                          >
                            {s.role}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                              !s.isActive
                                ? 'bg-red-50 text-red-700'
                                : s.isAuthorized
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-amber-50 text-amber-700'
                            }`}
                          >
                            {!s.isActive ? 'Inactive' : s.isAuthorized ? 'Active' : 'Pending'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500">
                          {s.department?.name ?? 'Unassigned'}
                        </td>
                        <td className="px-4 py-3">
                          <Link href={`/admin/staff/${s.id}/activity`}>
                            <Button variant="outline" size="sm" className="text-xs h-7">
                              Activity
                            </Button>
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Audit Logs Tab */}
        {activeTab === 'audit' && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            {loadingAudit ? (
              <div className="py-20 text-center text-sm text-slate-400">Loading audit logs…</div>
            ) : auditLogs.length === 0 ? (
              <div className="p-5">
                <EmptyState
                  icon={FileSearch}
                  title="No activity logged yet"
                  description="System events, administrative actions, and staff activity trails will appear here as they occur."
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50">
                      {['Timestamp', 'User / Actor', 'Role', 'Action', 'Entity Type', 'Target ID'].map((h) => (
                        <th
                          key={h}
                          className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {auditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 text-xs text-slate-500 font-mono whitespace-nowrap">
                          {new Date(log.createdAt).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-800">
                          {log.user?.name || 'System / Automated'}
                        </td>
                        <td className="px-4 py-3 text-xs">
                          <span className="inline-flex px-2 py-0.5 rounded-full font-medium bg-slate-100 text-slate-700">
                            {log.user?.role || 'SYSTEM'}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs font-semibold text-ic-action">
                          {log.action}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-600 font-mono">
                          {log.entityType}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-400 font-mono">
                          {log.entityId || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
