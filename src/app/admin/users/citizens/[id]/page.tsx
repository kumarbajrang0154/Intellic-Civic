'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileText,
  Mail,
  MapPin,
  Phone,
  Power,
  RefreshCw,
  ShieldAlert,
  Trash2,
  UserCheck,
  UserX,
  Users,
} from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { StatusBadge } from '@/components/admin/status-badge';
import { PriorityBadge } from '@/components/admin/priority-badge';
import { Button } from '@/components/ui/button';

interface CitizenDetail {
  id: string;
  name: string;
  email: string | null;
  mobileNumber: string | null;
  avatarUrl: string;
  isAuthorized: boolean;
  isSuspended: boolean;
  suspendedAt: string | null;
  deletedAt: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ComplaintItem {
  id: string;
  ticketId: string;
  title: string;
  status: string;
  priority: string | null;
  categoryName: string;
  departmentName: string;
  createdAt: string;
  updatedAt: string;
}

interface StatsSummary {
  totalComplaints: number;
  breakdown: Record<string, number>;
}

export default function CitizenDetailPage() {
  const params = useParams();
  const router = useRouter();
  const citizenId = params?.id as string;

  const [user, setUser] = useState({ name: 'Super Admin', role: 'SUPER_ADMIN' });
  const [citizen, setCitizen] = useState<CitizenDetail | null>(null);
  const [stats, setStats] = useState<StatsSummary | null>(null);
  const [complaints, setComplaints] = useState<ComplaintItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Modal State
  const [activeModal, setActiveModal] = useState<'suspend' | 'activate' | 'delete' | null>(null);
  const [suspendReason, setSuspendReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function loadUser() {
      try {
        const res = await fetch('/api/auth/me');
        if (res.ok) {
          const data = await res.json();
          if (data.user) {
            setUser({ name: data.user.name || 'Super Admin', role: data.user.role || 'SUPER_ADMIN' });
          }
        }
      } catch (err) {
        console.error(err);
      }
    }
    loadUser();
  }, []);

  async function fetchProfile() {
    if (!citizenId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/citizens/${citizenId}`);
      if (res.ok) {
        const json = await res.json();
        setCitizen(json.citizen || null);
        setStats(json.stats || null);
        setComplaints(json.complaints || []);
      } else {
        const errJson = await res.json().catch(() => ({}));
        setNotice({ type: 'error', message: errJson.message || 'Failed to load citizen profile.' });
      }
    } catch (err: any) {
      setNotice({ type: 'error', message: err.message || 'Error fetching citizen details' });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchProfile();
  }, [citizenId]);

  const handleSuspendConfirm = async () => {
    if (!citizen) return;
    setSubmitting(true);
    setNotice(null);
    try {
      const res = await fetch(`/api/admin/citizens/${citizen.id}/suspend`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: suspendReason || 'Administrative suspension' }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setNotice({ type: 'success', message: 'Citizen account suspended successfully.' });
        fetchProfile();
      } else {
        setNotice({ type: 'error', message: data.message || 'Failed to suspend citizen account' });
      }
    } catch (err: any) {
      setNotice({ type: 'error', message: err.message || 'Error suspending account' });
    } finally {
      setSubmitting(false);
      setActiveModal(null);
      setSuspendReason('');
    }
  };

  const handleActivateConfirm = async () => {
    if (!citizen) return;
    setSubmitting(true);
    setNotice(null);
    try {
      const res = await fetch(`/api/admin/citizens/${citizen.id}/activate`, {
        method: 'PATCH',
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setNotice({ type: 'success', message: 'Citizen account activated successfully.' });
        fetchProfile();
      } else {
        setNotice({ type: 'error', message: data.message || 'Failed to activate citizen account' });
      }
    } catch (err: any) {
      setNotice({ type: 'error', message: err.message || 'Error activating account' });
    } finally {
      setSubmitting(false);
      setActiveModal(null);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!citizen) return;
    setSubmitting(true);
    setNotice(null);
    try {
      const res = await fetch(`/api/admin/citizens/${citizen.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setNotice({ type: 'success', message: 'Citizen account soft-deleted successfully.' });
        fetchProfile();
      } else {
        setNotice({ type: 'error', message: data.message || 'Failed to delete citizen account' });
      }
    } catch (err: any) {
      setNotice({ type: 'error', message: err.message || 'Error deleting account' });
    } finally {
      setSubmitting(false);
      setActiveModal(null);
    }
  };

  const formatPhone = (phone: string | null) => {
    if (!phone) return '—';
    if (phone.length === 10) return `+91 ${phone.slice(0, 5)} ${phone.slice(5)}`;
    return phone;
  };

  if (loading) {
    return (
      <AppShell user={{ name: user.name, role: user.role as any }}>
        <div className="py-24 text-center space-y-3">
          <RefreshCw className="w-8 h-8 text-[#1769AA] animate-spin mx-auto opacity-80" />
          <p className="text-sm font-medium text-slate-500">Loading citizen profile...</p>
        </div>
      </AppShell>
    );
  }

  if (!citizen) {
    return (
      <AppShell user={{ name: user.name, role: user.role as any }}>
        <div className="max-w-4xl mx-auto space-y-6">
          <Link
            href="/admin/users/citizens"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-[#1769AA] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Citizens
          </Link>
          <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center space-y-3">
            <Users className="w-12 h-12 text-slate-300 mx-auto" />
            <h3 className="text-lg font-bold text-slate-800">Citizen Profile Not Found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              The requested citizen profile does not exist or has been removed.
            </p>
          </div>
        </div>
      </AppShell>
    );
  }

  const isDeleted = Boolean(citizen.deletedAt);
  const isSuspended = citizen.isSuspended && !isDeleted;

  return (
    <AppShell user={{ name: user.name, role: user.role as any }}>
      <div className="space-y-6 max-w-7xl mx-auto pb-12">
        {/* Breadcrumb Header */}
        <div className="flex items-center justify-between">
          <Link
            href="/admin/users/citizens"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-[#1769AA] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Citizens Directory
          </Link>
        </div>

        {/* Global Action Banner */}
        {notice && (
          <div
            className={`p-4 rounded-xl border flex items-center justify-between transition-all duration-300 ${
              notice.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-red-50 border-red-200 text-red-800'
            }`}
          >
            <div className="flex items-center gap-2.5 text-sm font-medium">
              {notice.type === 'success' ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
              )}
              <span>{notice.message}</span>
            </div>
            <button
              onClick={() => setNotice(null)}
              className="text-xs font-semibold hover:underline opacity-80"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Citizen Profile Banner Card */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start md:items-center gap-4">
            <img
              src={citizen.avatarUrl}
              alt={citizen.name}
              className="w-16 h-16 rounded-2xl border border-slate-200 object-cover bg-slate-100 shrink-0"
            />
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-bold text-slate-900">{citizen.name}</h1>
                {isDeleted ? (
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                    <UserX className="w-3.5 h-3.5 text-slate-400" />
                    Deleted Account
                  </span>
                ) : isSuspended ? (
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200">
                    <ShieldAlert className="w-3.5 h-3.5 text-red-600" />
                    Suspended Account
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                    Active Citizen
                  </span>
                )}
              </div>
              <p className="text-xs font-mono text-slate-400">Citizen ID: {citizen.id}</p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            {!isDeleted && (
              isSuspended ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="border-emerald-200 text-emerald-700 hover:bg-emerald-50 text-xs font-semibold"
                  onClick={() => setActiveModal('activate')}
                >
                  <Power className="w-4 h-4 mr-1 text-emerald-600" />
                  Activate Account
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="border-red-200 text-red-700 hover:bg-red-50 text-xs font-semibold"
                  onClick={() => setActiveModal('suspend')}
                >
                  <ShieldAlert className="w-4 h-4 mr-1 text-red-600" />
                  Suspend Account
                </Button>
              )
            )}

            {!isDeleted && (
              <Button
                variant="outline"
                size="sm"
                className="border-slate-200 text-slate-700 hover:text-red-700 hover:border-red-200 hover:bg-red-50 text-xs font-semibold"
                onClick={() => setActiveModal('delete')}
              >
                <Trash2 className="w-4 h-4 mr-1" />
                Soft Delete
              </Button>
            )}
          </div>
        </div>

        {/* 2-Column Info Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Column 1: Personal & Account Details */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
            <h2 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
              <Users className="w-4 h-4 text-[#1769AA]" />
              Account Details
            </h2>

            <div className="space-y-4 text-xs">
              <div>
                <span className="text-slate-400 block mb-0.5">Mobile Phone</span>
                <span className="font-semibold text-slate-800 flex items-center gap-1.5 font-mono">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  {formatPhone(citizen.mobileNumber)}
                </span>
              </div>

              <div>
                <span className="text-slate-400 block mb-0.5">Email Address</span>
                <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  {citizen.email || 'Not provided'}
                </span>
              </div>

              <div>
                <span className="text-slate-400 block mb-0.5">Residential Zone</span>
                <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  Civic Metropolitan Zone
                </span>
              </div>

              <div>
                <span className="text-slate-400 block mb-0.5">Registration Date</span>
                <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  {new Date(citizen.createdAt).toLocaleString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>

              <div>
                <span className="text-slate-400 block mb-0.5">Last Login Activity</span>
                <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  {citizen.lastLoginAt
                    ? new Date(citizen.lastLoginAt).toLocaleString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })
                    : 'Recent activity'}
                </span>
              </div>

              {citizen.suspendedAt && (
                <div>
                  <span className="text-slate-400 block mb-0.5">Suspended Date</span>
                  <span className="font-semibold text-red-700 flex items-center gap-1.5">
                    <ShieldAlert className="w-3.5 h-3.5 text-red-600" />
                    {new Date(citizen.suspendedAt).toLocaleString('en-IN')}
                  </span>
                </div>
              )}

              {citizen.deletedAt && (
                <div>
                  <span className="text-slate-400 block mb-0.5">Soft Deleted Date</span>
                  <span className="font-semibold text-slate-600 flex items-center gap-1.5">
                    <UserX className="w-3.5 h-3.5 text-slate-400" />
                    {new Date(citizen.deletedAt).toLocaleString('en-IN')}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Column 2 & 3: Complaint Metrics & History */}
          <div className="lg:col-span-2 space-y-6">
            {/* Metrics Overview Grid */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <h2 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[#1769AA]" />
                  Complaint Activity Overview
                </span>
                <span className="text-xs font-medium text-slate-500">
                  Total Complaints: {stats?.totalComplaints || 0}
                </span>
              </h2>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-center">
                  <div className="text-xl font-extrabold text-slate-900">{stats?.totalComplaints || 0}</div>
                  <div className="text-[11px] font-medium text-slate-500 mt-0.5">Total Submitted</div>
                </div>

                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-center">
                  <div className="text-xl font-extrabold text-amber-800">
                    {(stats?.breakdown?.SUBMITTED || 0) + (stats?.breakdown?.PENDING_DEPT_REVIEW || 0)}
                  </div>
                  <div className="text-[11px] font-medium text-amber-700 mt-0.5">Pending Review</div>
                </div>

                <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-center">
                  <div className="text-xl font-extrabold text-[#1769AA]">
                    {(stats?.breakdown?.IN_PROGRESS || 0) + (stats?.breakdown?.ASSIGNED || 0)}
                  </div>
                  <div className="text-[11px] font-medium text-blue-700 mt-0.5">In Progress</div>
                </div>

                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-center">
                  <div className="text-xl font-extrabold text-emerald-800">
                    {(stats?.breakdown?.RESOLVED || 0) + (stats?.breakdown?.CLOSED || 0)}
                  </div>
                  <div className="text-[11px] font-medium text-emerald-700 mt-0.5">Resolved</div>
                </div>
              </div>
            </div>

            {/* Complaints History Table */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden space-y-4">
              <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900">Complaint History</h3>
                <span className="text-xs font-semibold text-slate-400">{complaints.length} Records</span>
              </div>

              {complaints.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400">
                  No complaints filed by this citizen yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider">
                        <th className="px-4 py-3">Ticket ID</th>
                        <th className="px-4 py-3">Title</th>
                        <th className="px-4 py-3">Department</th>
                        <th className="px-4 py-3">Priority</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3 text-right">View</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-normal">
                      {complaints.map((comp) => (
                        <tr key={comp.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3 font-mono font-semibold text-[#1769AA]">
                            {comp.ticketId}
                          </td>
                          <td className="px-4 py-3 font-medium text-slate-800 max-w-[180px] truncate">
                            {comp.title}
                          </td>
                          <td className="px-4 py-3 text-slate-600">{comp.departmentName}</td>
                          <td className="px-4 py-3">
                            <PriorityBadge priority={comp.priority} />
                          </td>
                          <td className="px-4 py-3">
                            <StatusBadge status={comp.status} />
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Link
                              href={`/admin/complaints/${comp.id}`}
                              className="inline-flex items-center gap-1 text-[#1769AA] hover:underline font-semibold"
                            >
                              Details
                              <ExternalLink className="w-3 h-3" />
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* SUSPEND CONFIRMATION MODAL */}
      {activeModal === 'suspend' && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3 text-red-600">
              <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center shrink-0">
                <ShieldAlert className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Suspend Citizen Account</h3>
                <p className="text-xs text-slate-500">{citizen.name}</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              This will suspend access to the Citizen Portal for this account immediately.
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Reason for Suspension (Optional)
              </label>
              <textarea
                className="w-full text-xs p-2.5 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-hidden"
                rows={3}
                placeholder="Specify reason..."
                value={suspendReason}
                onChange={(e) => setSuspendReason(e.target.value)}
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <Button
                variant="outline"
                size="sm"
                className="border-slate-200 text-xs"
                disabled={submitting}
                onClick={() => setActiveModal(null)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="bg-red-600 hover:bg-red-700 text-white text-xs font-semibold"
                disabled={submitting}
                onClick={handleSuspendConfirm}
              >
                {submitting ? 'Suspending...' : 'Confirm Suspension'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ACTIVATE CONFIRMATION MODAL */}
      {activeModal === 'activate' && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3 text-emerald-600">
              <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center shrink-0">
                <UserCheck className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Activate Citizen Account</h3>
                <p className="text-xs text-slate-500">{citizen.name}</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Restore full citizen access and enable OTP login verification for this user?
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <Button
                variant="outline"
                size="sm"
                className="border-slate-200 text-xs"
                disabled={submitting}
                onClick={() => setActiveModal(null)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
                disabled={submitting}
                onClick={handleActivateConfirm}
              >
                {submitting ? 'Activating...' : 'Confirm Activation'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {activeModal === 'delete' && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3 text-slate-800">
              <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-slate-700" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Soft Delete Citizen</h3>
                <p className="text-xs text-slate-500">{citizen.name}</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              This will soft-delete the citizen account and revoke access while preserving all historical complaint records and audit history intact.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <Button
                variant="outline"
                size="sm"
                className="border-slate-200 text-xs"
                disabled={submitting}
                onClick={() => setActiveModal(null)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold"
                disabled={submitting}
                onClick={handleDeleteConfirm}
              >
                {submitting ? 'Deleting...' : 'Confirm Soft Delete'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
