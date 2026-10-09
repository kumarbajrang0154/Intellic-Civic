'use client';

import React, { useEffect, useState } from 'react';
import { CheckCircle2, RefreshCw, ShieldAlert, UserX } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Select } from '@/components/ui/select';
import { showGlobalError } from '@/lib/api-client';

interface Department {
  id: string;
  name: string;
}

interface PendingUser {
  id: string;
  name: string;
  email: string;
  role: string | null;
  departmentId: string | null;
  createdAt: string;
}

export default function AdminPendingUsersPage() {
  const [users, setUsers] = useState<PendingUser[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);

  // Single Approve dialog state
  const [approveUser, setApproveUser] = useState<PendingUser | null>(null);
  const [selectedRole, setSelectedRole] = useState<string>('DEPARTMENT_OFFICER');
  const [selectedDeptId, setSelectedDeptId] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  // Bulk state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const [showBulkApproveDialog, setShowBulkApproveDialog] = useState(false);
  const [showBulkRejectConfirm, setShowBulkRejectConfirm] = useState(false);
  const [bulkRole, setBulkRole] = useState<string>('DEPARTMENT_OFFICER');
  const [bulkDeptId, setBulkDeptId] = useState<string>('');

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const [uRes, dRes] = await Promise.all([
        fetch('/api/users?pendingOnly=true'),
        fetch('/api/departments'),
      ]);

      if (uRes.ok) {
        const uData = await uRes.json();
        setUsers(uData.data || []);
      }
      if (dRes.ok) {
        const dData = await dRes.json();
        const deptList = Array.isArray(dData) ? dData : dData.data || [];
        setDepartments(deptList);
        if (deptList.length > 0) {
          setSelectedDeptId(deptList[0].id);
          setBulkDeptId(deptList[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to load pending users:', err);
    } finally {
      setLoading(false);
    }
  }

  // ── Bulk Handlers ──────────────────────────────────────────────────────────
  const allSelected = users.length > 0 && selectedIds.length === users.length;

  function toggleSelectAll() {
    if (allSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(users.map((u) => u.id));
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }

  async function handleBulkAction(action: 'APPROVE' | 'REJECT', extra: Record<string, any> = {}) {
    if (selectedIds.length === 0) return;
    setBulkSubmitting(true);
    try {
      const res = await fetch('/api/admin/users/pending/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          ids: selectedIds,
          ...extra,
        }),
      });
      const result = await res.json();
      if (!res.ok) {
        showGlobalError({
          title: 'Bulk Action Failed',
          message: result.message || 'Operation failed',
          statusCode: res.status,
        });
        return;
      }
      const perIdReasons = result.results
        ?.filter((r: any) => !r.ok)
        ?.map((r: any) => `• ID ${r.id.slice(0, 8)}: ${r.error}`)
        ?.join('\n');

      showGlobalError({
        title: 'Bulk Action Results',
        message: `${result.succeeded} succeeded, ${result.failed} failed`,
        hint: perIdReasons || (result.failed === 0 ? 'All selected pending users processed successfully.' : undefined),
      });

      setSelectedIds([]);
      fetchData();
    } catch (err: any) {
      showGlobalError({
        title: 'Bulk Action Error',
        message: err.message || 'Network error occurred',
      });
    } finally {
      setBulkSubmitting(false);
    }
  }

  // ── Single Handlers ────────────────────────────────────────────────────────
  async function handleConfirmApprove() {
    if (!approveUser) return;
    setSubmitting(true);
    try {
      const needsDept = selectedRole === 'DEPARTMENT_OFFICER' || selectedRole === 'FIELD_WORKER';
      const res = await fetch(`/api/users/${approveUser.id}/approve`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: selectedRole,
          departmentId: needsDept ? selectedDeptId : null,
        }),
      });

      if (res.ok) {
        setUsers((prev) => prev.filter((u) => u.id !== approveUser.id));
        setApproveUser(null);
      }
    } catch (err) {
      console.error('Failed to approve user:', err);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReject(id: string) {
    try {
      const res = await fetch(`/api/users/${id}/reject`, {
        method: 'PATCH',
      });
      if (res.ok) {
        setUsers((prev) => prev.filter((u) => u.id !== id));
      }
    } catch (err) {
      console.error('Failed to reject user:', err);
    }
  }

  return (
    <AppShell user={{ name: 'Super Admin', role: 'ADMIN' }}>
      <div className="space-y-6 p-6 max-w-7xl mx-auto">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Pending Staff Approvals
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Authorize staff Google OAuth registrations and assign role/department credentials
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-500">Loading pending signups...</div>
        ) : users.length === 0 ? (
          <Card className="border p-12 text-center">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-slate-800">All Signups Reviewed</h3>
            <p className="text-slate-500 text-sm mt-1">
              No staff accounts are currently awaiting approval.
            </p>
          </Card>
        ) : (
          <div className="space-y-3">
            {/* Select all header */}
            <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-lg border border-slate-200">
              <input
                type="checkbox"
                aria-label="Select all pending registrations"
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                checked={allSelected}
                onChange={toggleSelectAll}
              />
              <span className="text-xs font-semibold text-slate-700">Select All On Page ({users.length})</span>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {users.map((u) => (
                <Card key={u.id} className="border shadow-xs bg-white hover:border-slate-300 transition-colors">
                  <CardContent className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        aria-label={`Select ${u.name}`}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer mt-1"
                        checked={selectedIds.includes(u.id)}
                        onChange={() => toggleSelect(u.id)}
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 text-base">{u.name}</span>
                          <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-medium">
                            Pending Authorization
                          </span>
                        </div>
                        <div className="text-sm text-slate-600 mt-0.5">{u.email}</div>
                        <div className="text-xs text-slate-400 mt-1">
                          Signup requested: {new Date(u.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto self-end sm:self-center">
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-rose-600 border-rose-200 hover:bg-rose-50 text-xs"
                        onClick={() => handleReject(u.id)}
                      >
                        <UserX className="w-3.5 h-3.5 mr-1.5" />
                        Reject
                      </Button>
                      <Button
                        size="sm"
                        className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
                        onClick={() => setApproveUser(u)}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                        Approve Staff
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Single Approval Modal */}
        <Dialog open={!!approveUser} onOpenChange={(open) => !open && setApproveUser(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Approve Staff Account</DialogTitle>
              <DialogDescription>
                Set role and department assignment for {approveUser?.name} ({approveUser?.email}).
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Assign System Role
                </label>
                <Select value={selectedRole} onChange={(e) => setSelectedRole(e.target.value)}>
                  <option value="DEPARTMENT_HEAD">Department Head</option>
                  <option value="DEPARTMENT_OFFICER">Department Officer</option>
                  <option value="ADMIN">Super Admin</option>
                </Select>
              </div>

              {['DEPARTMENT_OFFICER', 'FIELD_WORKER'].includes(selectedRole) && (
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Assign Department
                  </label>
                  <Select value={selectedDeptId} onChange={(e) => setSelectedDeptId(e.target.value)}>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </Select>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setApproveUser(null)}>
                Cancel
              </Button>
              <Button
                className="bg-gradient-to-r from-[#2563EB] to-[#0891B2] text-white hover:opacity-95 shadow-sm"
                onClick={handleConfirmApprove}
                disabled={submitting}
              >
                {submitting ? 'Approving...' : 'Confirm Approval'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Bulk Approval Modal */}
        <Dialog open={showBulkApproveDialog} onOpenChange={setShowBulkApproveDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Bulk Approve Staff Accounts</DialogTitle>
              <DialogDescription>
                Assign role and department credentials for <strong className="text-slate-900">{selectedIds.length}</strong> selected account(s).
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Assign System Role
                </label>
                <Select value={bulkRole} onChange={(e) => setBulkRole(e.target.value)}>
                  <option value="DEPARTMENT_HEAD">Department Head</option>
                  <option value="DEPARTMENT_OFFICER">Department Officer</option>
                  <option value="ADMIN">Super Admin</option>
                </Select>
              </div>

              {['DEPARTMENT_OFFICER', 'FIELD_WORKER'].includes(bulkRole) && (
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Assign Department
                  </label>
                  <Select value={bulkDeptId} onChange={(e) => setBulkDeptId(e.target.value)}>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </Select>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowBulkApproveDialog(false)}>
                Cancel
              </Button>
              <Button
                className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                disabled={bulkSubmitting}
                onClick={() => {
                  setShowBulkApproveDialog(false);
                  const needsDept = ['DEPARTMENT_OFFICER', 'FIELD_WORKER'].includes(bulkRole);
                  handleBulkAction('APPROVE', { role: bulkRole, departmentId: needsDept ? bulkDeptId : null });
                }}
              >
                {bulkSubmitting ? 'Approving...' : `Approve ${selectedIds.length} Staff`}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Bulk Reject Confirmation Modal */}
        <Dialog open={showBulkRejectConfirm} onOpenChange={setShowBulkRejectConfirm}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirm Bulk Rejection</DialogTitle>
              <DialogDescription>
                Are you sure you want to reject and remove <strong className="text-slate-900">{selectedIds.length}</strong> pending staff registration(s)?
              </DialogDescription>
            </DialogHeader>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowBulkRejectConfirm(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                disabled={bulkSubmitting}
                onClick={() => {
                  setShowBulkRejectConfirm(false);
                  handleBulkAction('REJECT');
                }}
              >
                {bulkSubmitting ? 'Rejecting...' : `Reject ${selectedIds.length} Registrations`}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Sticky Bulk Action Bar */}
        {selectedIds.length > 0 && (
          <div
            data-testid="bulk-action-bar"
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-slate-900 text-white px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3 border border-slate-800"
          >
            <span className="text-sm font-semibold whitespace-nowrap">
              {selectedIds.length} selected
            </span>
            <div className="h-4 w-px bg-slate-700" />
            <Button
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
              disabled={bulkSubmitting}
              onClick={() => setShowBulkApproveDialog(true)}
            >
              Approve Selected
            </Button>
            <Button
              size="sm"
              variant="destructive"
              className="text-xs"
              disabled={bulkSubmitting}
              onClick={() => setShowBulkRejectConfirm(true)}
            >
              Reject Selected
            </Button>
            <button
              type="button"
              className="text-xs text-slate-400 hover:text-white underline ml-2"
              onClick={() => setSelectedIds([])}
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </AppShell>
  );
}
