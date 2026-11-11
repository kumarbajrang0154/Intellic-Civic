'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/admin/page-header';
import { EmptyState } from '@/components/admin/empty-state';
import {
  ShieldCheck,
  Users,
  Activity,
  FileSearch,
  KeyRound,
  Copy,
  Check,
  AlertCircle,
  Loader2,
  ShieldAlert,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  const [activeTab, setActiveTab] = useState<'overview' | 'accounts' | 'audit' | '2fa'>('overview');

  // 2FA management state
  const [twoFaLoading, setTwoFaLoading] = useState(false);
  const [twoFaBusy, setTwoFaBusy] = useState(false);
  const [twoFaError, setTwoFaError] = useState<string | null>(null);
  const [twoFaSuccess, setTwoFaSuccess] = useState<string | null>(null);
  const [twoFaStatus, setTwoFaStatus] = useState<{
    enabled: boolean;
    verifiedAt: string | null;
    remainingRecoveryCodes: number;
    hasPendingEnrollment: boolean;
    migrationPending: boolean;
  } | null>(null);
  const [enrollData, setEnrollData] = useState<{
    secretBase32: string;
    otpauthUri: string;
    qrDataUrl: string;
  } | null>(null);
  const [verifyCode, setVerifyCode] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [disableCode, setDisableCode] = useState('');
  const [disableUseRecovery, setDisableUseRecovery] = useState(false);
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [copiedRecovery, setCopiedRecovery] = useState(false);

  const loadTwoFactorStatus = useCallback(async () => {
    setTwoFaLoading(true);
    setTwoFaError(null);
    try {
      const res = await fetch('/api/admin/security/2fa');
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.message || 'Unable to load two-factor status.');
      }
      setTwoFaStatus({
        enabled: Boolean(data.enabled),
        verifiedAt: data.verifiedAt ?? null,
        remainingRecoveryCodes: data.remainingRecoveryCodes ?? 0,
        hasPendingEnrollment: Boolean(data.hasPendingEnrollment),
        migrationPending: Boolean(data.migrationPending),
      });
    } catch (err) {
      setTwoFaError(err instanceof Error ? err.message : 'Unable to load two-factor status.');
    } finally {
      setTwoFaLoading(false);
    }
  }, []);

  const handleStartEnroll = async () => {
    setTwoFaBusy(true);
    setTwoFaError(null);
    setTwoFaSuccess(null);
    setRecoveryCodes(null);
    try {
      const res = await fetch('/api/admin/security/2fa/enroll', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.message || 'Unable to start two-factor setup.');
      }
      setEnrollData({
        secretBase32: data.secretBase32,
        otpauthUri: data.otpauthUri,
        qrDataUrl: data.qrDataUrl,
      });
      setVerifyCode('');
    } catch (err) {
      setTwoFaError(err instanceof Error ? err.message : 'Unable to start two-factor setup.');
    } finally {
      setTwoFaBusy(false);
    }
  };

  const handleVerifyEnroll = async (e: React.FormEvent) => {
    e.preventDefault();
    setTwoFaBusy(true);
    setTwoFaError(null);
    setTwoFaSuccess(null);
    try {
      const res = await fetch('/api/admin/security/2fa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: verifyCode.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.message || 'Verification failed.');
      }
      setRecoveryCodes(Array.isArray(data.recoveryCodes) ? data.recoveryCodes : []);
      setEnrollData(null);
      setVerifyCode('');
      setTwoFaSuccess('Two-factor authentication is now active. Save your recovery codes offline.');
      await loadTwoFactorStatus();
    } catch (err) {
      setTwoFaError(err instanceof Error ? err.message : 'Verification failed.');
    } finally {
      setTwoFaBusy(false);
    }
  };

  const handleDisableTwoFa = async (e: React.FormEvent) => {
    e.preventDefault();
    setTwoFaBusy(true);
    setTwoFaError(null);
    setTwoFaSuccess(null);
    try {
      const res = await fetch('/api/admin/security/2fa/disable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: disableCode.trim(),
          useRecoveryCode: disableUseRecovery,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.message || 'Unable to disable two-factor authentication.');
      }
      setDisableCode('');
      setDisableUseRecovery(false);
      setRecoveryCodes(null);
      setTwoFaSuccess('Two-factor authentication has been disabled for your account.');
      await loadTwoFactorStatus();
    } catch (err) {
      setTwoFaError(err instanceof Error ? err.message : 'Unable to disable two-factor authentication.');
    } finally {
      setTwoFaBusy(false);
    }
  };

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
    if (activeTab === '2fa' && twoFaStatus === null && !twoFaLoading) {
      loadTwoFactorStatus();
    }
  }, [activeTab, auditLogs.length, loadTwoFactorStatus, twoFaLoading, twoFaStatus]);

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
        <div className="flex flex-wrap gap-2 border-b border-slate-200">
          {(['overview', 'accounts', 'audit', '2fa'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3468A1] ${
                activeTab === tab
                  ? 'border-ic-action text-ic-action'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab === 'overview'
                ? 'Role Overview'
                : tab === 'accounts'
                ? 'Admin Accounts'
                : tab === 'audit'
                ? 'Audit Logs'
                : 'Two-Factor Auth'}
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
                          {log.user?.name ||
                            (log.metadata as any)?.actorName ||
                            ((log.metadata as any)?.isSystem || (log.action && log.action.startsWith('SYSTEM'))
                              ? 'System User'
                              : 'Deleted User')}
                        </td>
                        <td className="px-4 py-3 text-xs">
                          <span className="inline-flex px-2 py-0.5 rounded-full font-medium bg-slate-100 text-slate-700">
                            {log.user?.role || (log.metadata as any)?.role || 'SYSTEM'}
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

        {/* Two-Factor Auth Tab */}
        {activeTab === '2fa' && (
          <section
            aria-labelledby="admin-2fa-heading"
            className="rounded-xl border border-[#E5E2D9] bg-white p-5 sm:p-6 shadow-sm space-y-5"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-[#E5E2D9] pb-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#F2EFE6] text-[#3468A1]">
                  <KeyRound className="h-5 w-5" aria-hidden="true" />
                </div>
                <div>
                  <h2 id="admin-2fa-heading" className="text-base font-semibold text-[#131E20]">
                    Administrator Two-Factor Authentication (TOTP)
                  </h2>
                  <p className="text-xs text-[#6E6B64]">
                    Protect ADMIN and SUPER_ADMIN sign-ins using RFC 6238 authenticator apps and single-use backup recovery codes.
                  </p>
                </div>
              </div>

              {twoFaStatus && (
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
                    twoFaStatus.enabled
                      ? 'bg-[#3B8F68]/15 text-[#131E20]'
                      : 'bg-amber-50 text-amber-800 border border-amber-200'
                  }`}
                >
                  {twoFaStatus.enabled ? (
                    <>
                      <ShieldCheck className="h-3.5 w-3.5 text-[#3B8F68]" aria-hidden="true" />
                      Active
                    </>
                  ) : (
                    <>
                      <ShieldAlert className="h-3.5 w-3.5 text-[#D98E2B]" aria-hidden="true" />
                      Not Enabled
                    </>
                  )}
                </span>
              )}
            </div>

            {twoFaError && (
              <div
                role="alert"
                className="flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-900"
              >
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 text-red-600" aria-hidden="true" />
                  <span>{twoFaError}</span>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={loadTwoFactorStatus}>
                  Retry
                </Button>
              </div>
            )}

            {twoFaSuccess && (
              <div
                role="status"
                className="flex items-center gap-2 rounded-lg border border-[#3B8F68]/30 bg-[#3B8F68]/10 px-4 py-3 text-xs font-medium text-[#131E20]"
              >
                <ShieldCheck className="h-4 w-4 shrink-0 text-[#3B8F68]" aria-hidden="true" />
                <span>{twoFaSuccess}</span>
              </div>
            )}

            {twoFaLoading ? (
              <div className="flex items-center justify-center gap-2 py-12 text-sm text-[#6E6B64]">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                <span>Checking two-factor configuration...</span>
              </div>
            ) : twoFaStatus?.migrationPending ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
                Database schema migration <code className="font-mono">20261112050000_admin_totp_2fa</code> has not been applied yet. Once applied to Postgres, TOTP enrollment is available immediately.
              </div>
            ) : (
              <div className="space-y-6">
                {recoveryCodes && recoveryCodes.length > 0 && (
                  <div className="rounded-xl border border-[#D98E2B]/40 bg-[#F2EFE6]/70 p-4 space-y-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h3 className="text-sm font-semibold text-[#131E20]">
                          Save Your One-Time Recovery Codes
                        </h3>
                        <p className="text-xs text-[#6E6B64]">
                          Each code works once if you lose your authenticator device. Store them securely — they will not be shown again.
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          await navigator.clipboard?.writeText(recoveryCodes.join('\n')).catch(() => {});
                          setCopiedRecovery(true);
                          setTimeout(() => setCopiedRecovery(false), 2000);
                        }}
                        className="border-[#E5E2D9] bg-white"
                      >
                        {copiedRecovery ? (
                          <>
                            <Check className="mr-1.5 h-3.5 w-3.5 text-[#3B8F68]" aria-hidden="true" />
                            Copied Codes
                          </>
                        ) : (
                          <>
                            <Copy className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                            Copy All
                          </>
                        )}
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {recoveryCodes.map((code) => (
                        <code
                          key={code}
                          className="rounded-md border border-[#E5E2D9] bg-white px-2.5 py-1.5 text-center font-mono text-xs font-semibold text-[#131E20]"
                        >
                          {code}
                        </code>
                      ))}
                    </div>
                  </div>
                )}

                {!twoFaStatus?.enabled && !enrollData && (
                  <div className="flex flex-col gap-4 rounded-xl border border-dashed border-[#E5E2D9] bg-[#F2EFE6]/40 p-6 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-1">
                      <h3 className="text-sm font-semibold text-[#131E20]">
                        Two-factor authentication is currently disabled
                      </h3>
                      <p className="text-xs text-[#6E6B64]">
                        Enroll any standard TOTP app (Google Authenticator, 1Password, Authy) and receive 8 backup recovery codes.
                      </p>
                    </div>
                    <Button
                      type="button"
                      onClick={handleStartEnroll}
                      disabled={twoFaBusy}
                      className="bg-[#3468A1] text-white hover:bg-[#3468A1]/90 shrink-0"
                    >
                      {twoFaBusy ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                          Generating QR...
                        </>
                      ) : (
                        <>
                          <KeyRound className="mr-2 h-4 w-4" aria-hidden="true" />
                          Setup Two-Factor Auth
                        </>
                      )}
                    </Button>
                  </div>
                )}

                {enrollData && (
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2 rounded-xl border border-[#E5E2D9] bg-[#F2EFE6]/30 p-5">
                    <div className="flex flex-col items-center justify-center rounded-lg border border-[#E5E2D9] bg-white p-4">
                      <Image
                        src={enrollData.qrDataUrl}
                        alt="Scan this QR code with your authenticator app"
                        width={200}
                        height={200}
                        unoptimized
                        className="rounded-md"
                      />
                      <p className="mt-2 text-[11px] text-[#6E6B64] text-center">
                        Generated locally on server (never sent to external QR services)
                      </p>
                    </div>

                    <div className="flex flex-col justify-between space-y-4">
                      <div className="space-y-2">
                        <h3 className="text-sm font-semibold text-[#131E20]">
                          1. Scan QR Code or Enter Setup Key
                        </h3>
                        <div className="flex items-center gap-2">
                          <code className="flex-1 truncate rounded-md border border-[#E5E2D9] bg-white px-3 py-2 font-mono text-xs font-semibold text-[#131E20]">
                            {enrollData.secretBase32}
                          </code>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={async () => {
                              await navigator.clipboard?.writeText(enrollData.secretBase32).catch(() => {});
                              setCopiedSecret(true);
                              setTimeout(() => setCopiedSecret(false), 2000);
                            }}
                          >
                            {copiedSecret ? (
                              <Check className="h-4 w-4 text-[#3B8F68]" aria-hidden="true" />
                            ) : (
                              <Copy className="h-4 w-4" aria-hidden="true" />
                            )}
                          </Button>
                        </div>
                      </div>

                      <form onSubmit={handleVerifyEnroll} className="space-y-3">
                        <div className="space-y-1.5">
                          <label
                            htmlFor="enroll-verify-code"
                            className="text-xs font-semibold text-[#131E20] block"
                          >
                            2. Enter 6-Digit Verification Code
                          </label>
                          <Input
                            id="enroll-verify-code"
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]{6}"
                            maxLength={6}
                            placeholder="123456"
                            value={verifyCode}
                            onChange={(e) => setVerifyCode(e.target.value)}
                            disabled={twoFaBusy}
                            className="font-mono tracking-widest bg-white border-[#E5E2D9]"
                            required
                          />
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="submit"
                            disabled={twoFaBusy}
                            className="bg-[#3468A1] text-white hover:bg-[#3468A1]/90"
                          >
                            {twoFaBusy ? 'Activating...' : 'Verify & Activate 2FA'}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                              setEnrollData(null);
                              setVerifyCode('');
                            }}
                            disabled={twoFaBusy}
                          >
                            Cancel
                          </Button>
                        </div>
                      </form>
                    </div>
                  </div>
                )}

                {twoFaStatus?.enabled && (
                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <div className="rounded-xl border border-[#E5E2D9] bg-[#F2EFE6]/40 p-4 space-y-2">
                      <h3 className="text-sm font-semibold text-[#131E20]">Protection Summary</h3>
                      <p className="text-xs text-[#6E6B64]">
                        Activated:{' '}
                        <span className="font-medium text-[#131E20]">
                          {twoFaStatus.verifiedAt
                            ? new Date(twoFaStatus.verifiedAt).toLocaleString()
                            : 'Verified'}
                        </span>
                      </p>
                      <p className="text-xs text-[#6E6B64]">
                        Unused backup recovery codes remaining:{' '}
                        <span className="font-semibold text-[#131E20]">
                          {twoFaStatus.remainingRecoveryCodes}
                        </span>
                      </p>
                    </div>

                    <form
                      onSubmit={handleDisableTwoFa}
                      className="rounded-xl border border-red-200 bg-red-50/40 p-4 space-y-3"
                    >
                      <h3 className="text-sm font-semibold text-red-900">
                        Disable Two-Factor Authentication
                      </h3>
                      <p className="text-xs text-red-800">
                        Confirm with your current 6-digit authenticator code or an unused recovery code.
                      </p>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <Input
                          type="text"
                          value={disableCode}
                          onChange={(e) => setDisableCode(e.target.value)}
                          placeholder={disableUseRecovery ? 'ABCD-EFGH-23' : '123456'}
                          disabled={twoFaBusy}
                          className="bg-white border-red-200 font-mono"
                          required
                        />
                        <Button
                          type="submit"
                          variant="destructive"
                          disabled={twoFaBusy}
                          className="shrink-0"
                        >
                          {twoFaBusy ? 'Disabling...' : 'Disable 2FA'}
                        </Button>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setDisableUseRecovery((prev) => !prev);
                          setDisableCode('');
                        }}
                        className="text-xs font-medium text-[#3468A1] hover:underline"
                      >
                        {disableUseRecovery
                          ? 'Use 6-digit authenticator code instead'
                          : 'Use a recovery code instead'}
                      </button>
                    </form>
                  </div>
                )}
              </div>
            )}
          </section>
        )}
      </div>
    </AppShell>
  );
}
