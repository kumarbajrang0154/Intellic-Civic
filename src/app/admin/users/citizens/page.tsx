'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Eye,
  MoreHorizontal,
  Phone,
  Power,
  RefreshCw,
  Search,
  ShieldAlert,
  Trash2,
  UserCheck,
  UserX,
  Users,
} from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/admin/page-header';
import { EmptyState } from '@/components/admin/empty-state';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface Citizen {
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
  totalComplaints: number;
}

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function CitizensListPage() {
  const router = useRouter();
  const [user, setUser] = useState({ name: 'Super Admin', role: 'SUPER_ADMIN' });
  const [citizens, setCitizens] = useState<Citizen[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'SUSPENDED' | 'DELETED'>('ALL');
  const [actionNotice, setActionNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Modal State
  const [selectedCitizen, setSelectedCitizen] = useState<Citizen | null>(null);
  const [activeModal, setActiveModal] = useState<'suspend' | 'activate' | 'delete' | null>(null);
  const [suspendReason, setSuspendReason] = useState('');
  const [submittingAction, setSubmittingAction] = useState(false);

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

  async function fetchCitizens(page = 1, currentSearch = search, currentStatus = statusFilter) {
    setLoading(true);
    setActionNotice(null);
    try {
      const query = new URLSearchParams({
        page: String(page),
        limit: '20',
        status: currentStatus,
      });
      if (currentSearch.trim()) {
        query.set('search', currentSearch.trim());
      }

      const res = await fetch(`/api/admin/citizens?${query.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setCitizens(json.data || []);
        if (json.pagination) {
          setPagination(json.pagination);
        }
      } else {
        const errJson = await res.json().catch(() => ({}));
        setActionNotice({
          type: 'error',
          message: errJson.message || 'Failed to load citizens data.',
        });
      }
    } catch (err: any) {
      setActionNotice({ type: 'error', message: err.message || 'Network error fetching citizens' });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchCitizens(1, search, statusFilter);
    }, 300);
    return () => clearTimeout(timer);
  }, [search, statusFilter]);

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      fetchCitizens(newPage);
    }
  };

  const handleSuspendConfirm = async () => {
    if (!selectedCitizen) return;
    setSubmittingAction(true);
    setActionNotice(null);
    try {
      const res = await fetch(`/api/admin/citizens/${selectedCitizen.id}/suspend`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: suspendReason || 'Administrative suspension' }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setActionNotice({ type: 'success', message: `Citizen "${selectedCitizen.name}" has been suspended.` });
        fetchCitizens(pagination.page);
      } else {
        setActionNotice({ type: 'error', message: data.message || 'Failed to suspend citizen account' });
      }
    } catch (err: any) {
      setActionNotice({ type: 'error', message: err.message || 'Error executing action' });
    } finally {
      setSubmittingAction(false);
      setActiveModal(null);
      setSelectedCitizen(null);
      setSuspendReason('');
    }
  };

  const handleActivateConfirm = async () => {
    if (!selectedCitizen) return;
    setSubmittingAction(true);
    setActionNotice(null);
    try {
      const res = await fetch(`/api/admin/citizens/${selectedCitizen.id}/activate`, {
        method: 'PATCH',
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setActionNotice({ type: 'success', message: `Citizen "${selectedCitizen.name}" account is now Active.` });
        fetchCitizens(pagination.page);
      } else {
        setActionNotice({ type: 'error', message: data.message || 'Failed to activate citizen account' });
      }
    } catch (err: any) {
      setActionNotice({ type: 'error', message: err.message || 'Error executing action' });
    } finally {
      setSubmittingAction(false);
      setActiveModal(null);
      setSelectedCitizen(null);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!selectedCitizen) return;
    setSubmittingAction(true);
    setActionNotice(null);
    try {
      const res = await fetch(`/api/admin/citizens/${selectedCitizen.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setActionNotice({ type: 'success', message: `Citizen "${selectedCitizen.name}" soft-deleted successfully.` });
        fetchCitizens(pagination.page);
      } else {
        setActionNotice({ type: 'error', message: data.message || 'Failed to delete citizen account' });
      }
    } catch (err: any) {
      setActionNotice({ type: 'error', message: err.message || 'Error executing action' });
    } finally {
      setSubmittingAction(false);
      setActiveModal(null);
      setSelectedCitizen(null);
    }
  };

  const formatPhone = (phone: string | null) => {
    if (!phone) return '—';
    if (phone.length === 10) {
      return `+91 ${phone.slice(0, 5)} ${phone.slice(5)}`;
    }
    return phone;
  };

  return (
    <AppShell user={{ name: user.name, role: user.role as any }}>
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Page Header */}
        <PageHeader
          title="Citizen Management"
          description="View, monitor, suspend, and manage citizen accounts across the platform"
          badge={
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#1769AA]/10 text-[#1769AA] border border-[#1769AA]/20">
              <Users className="w-3.5 h-3.5" />
              {pagination.total} Total Registered Citizens
            </span>
          }
        />

        {/* Global Action Banner */}
        {actionNotice && (
          <div
            className={`p-4 rounded-xl border flex items-center justify-between transition-all duration-300 ${
              actionNotice.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-red-50 border-red-200 text-red-800'
            }`}
          >
            <div className="flex items-center gap-2.5 text-sm font-medium">
              {actionNotice.type === 'success' ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
              )}
              <span>{actionNotice.message}</span>
            </div>
            <button
              onClick={() => setActionNotice(null)}
              className="text-xs font-semibold hover:underline opacity-80"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Filter & Search Bar */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-4 sm:space-y-0 sm:flex sm:items-center sm:justify-between gap-4">
          {/* Status Tabs */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs font-medium shrink-0 overflow-x-auto">
            {(['ALL', 'ACTIVE', 'SUSPENDED', 'DELETED'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setStatusFilter(tab)}
                className={`px-3 py-1.5 rounded-md transition-all ${
                  statusFilter === tab
                    ? 'bg-[#0F2747] text-white font-semibold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                {tab === 'ALL' ? 'All Citizens' : tab}
              </button>
            ))}
          </div>

          {/* Search & Refresh */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                className="pl-9 text-sm bg-slate-50 border-slate-200 focus:bg-white transition-colors"
                placeholder="Search name, phone, email or ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <Button
              variant="outline"
              size="icon"
              className="shrink-0 border-slate-200 hover:bg-slate-50"
              onClick={() => fetchCitizens(pagination.page)}
              title="Refresh List"
            >
              <RefreshCw className={`w-4 h-4 text-slate-600 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {/* Data Table Container */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {loading ? (
            <div className="py-24 text-center space-y-3">
              <RefreshCw className="w-8 h-8 text-[#1769AA] animate-spin mx-auto opacity-80" />
              <p className="text-sm font-medium text-slate-500">Loading citizens directory...</p>
            </div>
          ) : citizens.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No citizens found"
              description={
                search
                  ? `No citizen matches "${search}" in filter mode ${statusFilter}.`
                  : `No citizen accounts exist under status ${statusFilter}.`
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    <th className="px-5 py-3.5">Citizen Profile</th>
                    <th className="px-5 py-3.5">Contact Details</th>
                    <th className="px-5 py-3.5">Account Status</th>
                    <th className="px-5 py-3.5 text-center">Complaints</th>
                    <th className="px-5 py-3.5">Registered</th>
                    <th className="px-5 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-normal">
                  {citizens.map((c) => {
                    const isDeleted = Boolean(c.deletedAt);
                    const isSuspended = c.isSuspended && !isDeleted;
                    const isActive = !c.isSuspended && !isDeleted;

                    return (
                      <tr key={c.id} className="hover:bg-slate-50/80 transition-colors">
                        {/* Avatar & Name */}
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <img
                              src={c.avatarUrl}
                              alt={c.name}
                              className="w-10 h-10 rounded-full border border-slate-200 object-cover bg-slate-100 shrink-0"
                            />
                            <div>
                              <Link
                                href={`/admin/users/citizens/${c.id}`}
                                className="font-semibold text-slate-900 hover:text-[#1769AA] transition-colors"
                              >
                                {c.name}
                              </Link>
                              <div className="text-xs text-slate-400 font-mono tracking-tight">
                                ID: {c.id.length > 18 ? c.id.slice(0, 18) + '...' : c.id}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Contact */}
                        <td className="px-5 py-4">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5 text-xs text-slate-700 font-medium">
                              <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              {formatPhone(c.mobileNumber)}
                            </div>
                            <div className="text-xs text-slate-500 truncate max-w-[200px]">
                              {c.email || 'No email associated'}
                            </div>
                          </div>
                        </td>

                        {/* Status */}
                        <td className="px-5 py-4">
                          {isDeleted ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                              <UserX className="w-3 h-3 text-slate-400" />
                              Deleted
                            </span>
                          ) : isSuspended ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200">
                              <ShieldAlert className="w-3 h-3 text-red-600" />
                              Suspended
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <UserCheck className="w-3 h-3 text-emerald-600" />
                              Active
                            </span>
                          )}
                        </td>

                        {/* Complaints Count */}
                        <td className="px-5 py-4 text-center">
                          <Link
                            href={`/admin/users/citizens/${c.id}`}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-[#1769AA]/10 hover:text-[#1769AA] border border-slate-200 transition-colors"
                          >
                            <ClipboardList className="w-3 h-3" />
                            {c.totalComplaints}
                          </Link>
                        </td>

                        {/* Registered Date */}
                        <td className="px-5 py-4 text-xs text-slate-500">
                          {new Date(c.createdAt).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </td>

                        {/* Action Buttons */}
                        <td className="px-5 py-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* View Profile */}
                            <Link href={`/admin/users/citizens/${c.id}`}>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 text-xs font-medium border-slate-200 text-slate-700 hover:bg-slate-100"
                                title="View Complete Profile & Complaints"
                              >
                                <Eye className="w-3.5 h-3.5 mr-1 text-slate-500" />
                                Profile
                              </Button>
                            </Link>

                            {/* Suspend / Activate Toggle */}
                            {!isDeleted && (
                              isSuspended ? (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8 text-xs font-medium border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                                  onClick={() => {
                                    setSelectedCitizen(c);
                                    setActiveModal('activate');
                                  }}
                                  title="Activate Account"
                                >
                                  <Power className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                                  Activate
                                </Button>
                              ) : (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8 text-xs font-medium border-red-200 text-red-700 hover:bg-red-50"
                                  onClick={() => {
                                    setSelectedCitizen(c);
                                    setActiveModal('suspend');
                                  }}
                                  title="Suspend Account"
                                >
                                  <ShieldAlert className="w-3.5 h-3.5 mr-1 text-red-600" />
                                  Suspend
                                </Button>
                              )
                            )}

                            {/* Delete Soft Button */}
                            {!isDeleted && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 px-2 text-xs border-slate-200 text-slate-500 hover:text-red-700 hover:border-red-200 hover:bg-red-50"
                                onClick={() => {
                                  setSelectedCitizen(c);
                                  setActiveModal('delete');
                                }}
                                title="Soft Delete Account"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination Footer */}
          {!loading && citizens.length > 0 && (
            <div className="p-4 border-t border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
              <div>
                Showing <span className="font-semibold text-slate-800">{(pagination.page - 1) * pagination.limit + 1}</span> to{' '}
                <span className="font-semibold text-slate-800">
                  {Math.min(pagination.page * pagination.limit, pagination.total)}
                </span>{' '}
                of <span className="font-semibold text-slate-800">{pagination.total}</span> citizens
              </div>

              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 border-slate-200 text-xs text-slate-700"
                  disabled={pagination.page <= 1}
                  onClick={() => handlePageChange(pagination.page - 1)}
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Previous
                </Button>

                <div className="px-3 py-1 font-medium bg-white rounded border border-slate-200 text-slate-700">
                  Page {pagination.page} of {pagination.totalPages}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 border-slate-200 text-xs text-slate-700"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => handlePageChange(pagination.page + 1)}
                >
                  Next
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* SUSPEND CONFIRMATION MODAL */}
      {activeModal === 'suspend' && selectedCitizen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3 text-red-600">
              <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center shrink-0">
                <ShieldAlert className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Suspend Citizen Account</h3>
                <p className="text-xs text-slate-500">{selectedCitizen.name}</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              This will suspend the citizen's access to the IntelliCivic Citizen Portal. They will not be able to log in or submit new complaints until reactivated.
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Reason for Suspension (Optional)
              </label>
              <textarea
                className="w-full text-xs p-2.5 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#1769AA]"
                rows={3}
                placeholder="Specify reason for administrative record..."
                value={suspendReason}
                onChange={(e) => setSuspendReason(e.target.value)}
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <Button
                variant="outline"
                size="sm"
                className="border-slate-200 text-xs"
                disabled={submittingAction}
                onClick={() => {
                  setActiveModal(null);
                  setSelectedCitizen(null);
                }}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="bg-red-600 hover:bg-red-700 text-white text-xs font-semibold"
                disabled={submittingAction}
                onClick={handleSuspendConfirm}
              >
                {submittingAction ? 'Suspending...' : 'Confirm Suspension'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ACTIVATE CONFIRMATION MODAL */}
      {activeModal === 'activate' && selectedCitizen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3 text-emerald-600">
              <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center shrink-0">
                <UserCheck className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Activate Citizen Account</h3>
                <p className="text-xs text-slate-500">{selectedCitizen.name}</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to restore full access for this citizen? They will immediately be able to log in using OTP verification.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <Button
                variant="outline"
                size="sm"
                className="border-slate-200 text-xs"
                disabled={submittingAction}
                onClick={() => {
                  setActiveModal(null);
                  setSelectedCitizen(null);
                }}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
                disabled={submittingAction}
                onClick={handleActivateConfirm}
              >
                {submittingAction ? 'Activating...' : 'Confirm Activation'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {activeModal === 'delete' && selectedCitizen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3 text-slate-800">
              <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-slate-700" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Soft Delete Citizen</h3>
                <p className="text-xs text-slate-500">{selectedCitizen.name}</p>
              </div>
            </div>

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs leading-relaxed space-y-1">
              <div className="font-semibold flex items-center gap-1 text-amber-800">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                Data Integrity Safe
              </div>
              <p>
                This soft-deletes the account and revokes access. All historical complaints, resolution records, and audit logs will be permanently preserved.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <Button
                variant="outline"
                size="sm"
                className="border-slate-200 text-xs"
                disabled={submittingAction}
                onClick={() => {
                  setActiveModal(null);
                  setSelectedCitizen(null);
                }}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold"
                disabled={submittingAction}
                onClick={handleDeleteConfirm}
              >
                {submittingAction ? 'Deleting...' : 'Confirm Soft Delete'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
