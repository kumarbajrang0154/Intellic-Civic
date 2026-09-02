'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  AlertCircle,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Plus,
  RefreshCw,
  Search,
  UserCheck,
  UserX,
  Users,
} from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Department {
  id: string;
  name: string;
}

interface StaffMember {
  id: string;
  name: string;
  email: string;
  role: string | null;
  departmentId: string | null;
  departmentName: string | null;
  isActive: boolean;
  isAuthorized: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

interface StaffListResponse {
  items: StaffMember[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ROLES = [
  { value: 'ALL', label: 'All Roles' },
  { value: 'ADMIN', label: 'Super Admin' },
  { value: 'DEPARTMENT_HEAD', label: 'Department Head' },
  { value: 'DEPARTMENT_OFFICER', label: 'Department Officer' },
  { value: 'FIELD_WORKER', label: 'Field Worker' },
];

const STATUSES = [
  { value: 'all', label: 'All Status' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
];

function roleBadge(role: string | null) {
  const map: Record<string, string> = {
    ADMIN: 'bg-purple-100 text-purple-800 border-purple-200',
    DEPARTMENT_HEAD: 'bg-blue-100 text-blue-800 border-blue-200',
    DEPARTMENT_OFFICER: 'bg-sky-100 text-sky-800 border-sky-200',
    FIELD_WORKER: 'bg-amber-100 text-amber-800 border-amber-200',
  };
  const labels: Record<string, string> = {
    ADMIN: 'Super Admin',
    DEPARTMENT_HEAD: 'Dept Head',
    DEPARTMENT_OFFICER: 'Officer',
    FIELD_WORKER: 'Field Worker',
  };
  const cls = role ? (map[role] ?? 'bg-slate-100 text-slate-600 border-slate-200') : 'bg-slate-100 text-slate-400 border-slate-200';
  return (
    <span className={`inline-block text-[11px] font-semibold border px-2 py-0.5 rounded-full ${cls}`}>
      {role ? (labels[role] ?? role) : 'Unassigned'}
    </span>
  );
}

function formatDate(iso: string | null) {
  if (!iso) return <span className="text-slate-400 text-xs">Never</span>;
  return (
    <span className="text-xs text-slate-600">
      {new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
    </span>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AdminStaffPage() {
  const [data, setData] = useState<StaffListResponse | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [deptFilter, setDeptFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);

  // Create Staff Modal
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createEmail, setCreateEmail] = useState('');
  const [createRole, setCreateRole] = useState('DEPARTMENT_OFFICER');
  const [createDept, setCreateDept] = useState('');
  const [createError, setCreateError] = useState('');
  const [creating, setCreating] = useState(false);

  // Reassign Modal
  const [reassignTarget, setReassignTarget] = useState<StaffMember | null>(null);
  const [reassignRole, setReassignRole] = useState('');
  const [reassignDept, setReassignDept] = useState('');
  const [reassigning, setReassigning] = useState(false);
  const [reassignError, setReassignError] = useState('');

  // Deactivate confirmation
  const [deactivateTarget, setDeactivateTarget] = useState<StaffMember | null>(null);
  const [deactivating, setDeactivating] = useState(false);

  // ── Load departments once ────────────────────────────────────────────────────

  useEffect(() => {
    fetch('/api/departments')
      .then((r) => r.json())
      .then((d) => setDepartments(Array.isArray(d) ? d : d.data || []))
      .catch(console.error);
  }, []);

  // ── Fetch staff list ─────────────────────────────────────────────────────────

  const fetchStaff = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '15',
        ...(search && { search }),
        ...(roleFilter !== 'ALL' && { role: roleFilter }),
        ...(deptFilter !== 'ALL' && { departmentId: deptFilter }),
        ...(statusFilter !== 'all' && { status: statusFilter }),
      });
      const res = await fetch(`/api/admin/staff?${params}`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Failed to load staff');
      }
      setData(await res.json());
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [search, roleFilter, deptFilter, statusFilter, page]);

  useEffect(() => { fetchStaff(); }, [fetchStaff]);

  // Reset to page 1 when filters change
  useEffect(() => { setPage(1); }, [search, roleFilter, deptFilter, statusFilter]);

  // ── Create Staff ─────────────────────────────────────────────────────────────

  function openCreate() {
    setCreateName(''); setCreateEmail(''); setCreateRole('DEPARTMENT_OFFICER');
    setCreateDept(''); setCreateError(''); setCreateOpen(true);
  }

  async function handleCreate() {
    if (!createName.trim() || !createEmail.trim()) {
      setCreateError('Name and email are required.'); return;
    }
    setCreating(true); setCreateError('');
    try {
      const res = await fetch('/api/admin/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: createName.trim(), email: createEmail.trim(),
          role: createRole, departmentId: createDept || null,
        }),
      });
      const d = await res.json();
      if (!res.ok) { setCreateError(d.message || 'Failed to create staff.'); return; }
      setCreateOpen(false);
      fetchStaff();
    } catch {
      setCreateError('Network error. Please try again.');
    } finally {
      setCreating(false);
    }
  }

  // ── Deactivate ───────────────────────────────────────────────────────────────

  async function handleDeactivate() {
    if (!deactivateTarget) return;
    setDeactivating(true);
    try {
      const res = await fetch(`/api/admin/staff/${deactivateTarget.id}/deactivate`, { method: 'PATCH' });
      if (res.ok) { setDeactivateTarget(null); fetchStaff(); }
      else { const d = await res.json(); alert(d.message || 'Failed to deactivate.'); }
    } catch { alert('Network error.'); }
    finally { setDeactivating(false); }
  }

  async function handleReactivate(staff: StaffMember) {
    try {
      const res = await fetch(`/api/admin/staff/${staff.id}/reactivate`, { method: 'PATCH' });
      if (res.ok) fetchStaff();
      else { const d = await res.json(); alert(d.message || 'Failed to reactivate.'); }
    } catch { alert('Network error.'); }
  }

  // ── Reassign ─────────────────────────────────────────────────────────────────

  function openReassign(staff: StaffMember) {
    setReassignTarget(staff);
    setReassignRole(staff.role ?? 'DEPARTMENT_OFFICER');
    setReassignDept(staff.departmentId ?? '');
    setReassignError('');
  }

  async function handleReassign() {
    if (!reassignTarget) return;
    setReassigning(true); setReassignError('');
    try {
      const res = await fetch(`/api/admin/staff/${reassignTarget.id}/reassign`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newRole: reassignRole, newDepartmentId: reassignDept || null }),
      });
      const d = await res.json();
      if (!res.ok) { setReassignError(d.message || 'Failed to reassign.'); return; }
      setReassignTarget(null);
      fetchStaff();
    } catch {
      setReassignError('Network error.');
    } finally {
      setReassigning(false);
    }
  }

  const needsDept = ['DEPARTMENT_HEAD', 'DEPARTMENT_OFFICER', 'FIELD_WORKER'].includes(createRole);
  const reassignNeedsDept = ['DEPARTMENT_HEAD', 'DEPARTMENT_OFFICER', 'FIELD_WORKER'].includes(reassignRole);

  return (
    <AppShell user={{ name: 'Super Admin', role: 'ADMIN' }}>
      <div className="space-y-6 min-w-0">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b pb-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              Staff &amp; User Management
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              Create, deactivate, reassign and audit all platform staff accounts
            </p>
          </div>
          <div className="flex flex-wrap gap-2 w-full sm:w-auto">
            <Link href="/admin/staff/workload">
              <Button variant="outline" size="sm">
                <BarChart3 className="w-4 h-4 mr-2" /> Workload
              </Button>
            </Link>
            <Button variant="outline" size="sm" onClick={fetchStaff} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </Button>
            <Button className="bg-blue-600 hover:bg-blue-700 text-white" onClick={openCreate}>
              <Plus className="w-4 h-4 mr-2" /> Create Staff
            </Button>
          </div>
        </div>

        {/* ── Filters ────────────────────────────────────────────────────── */}
        <Card className="border shadow-sm">
          <CardContent className="pt-4 pb-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  className="pl-9"
                  placeholder="Search by name or email..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="h-10 px-3 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
              <select
                value={deptFilter}
                onChange={(e) => setDeptFilter(e.target.value)}
                className="h-10 px-3 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="ALL">All Departments</option>
                {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-10 px-3 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
          </CardContent>
        </Card>

        {/* ── Table ──────────────────────────────────────────────────────── */}
        {error && (
          <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" /> {error}
          </div>
        )}

        <Card className="border shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b">
                  <th className="text-left px-4 py-3 font-semibold text-slate-700 text-xs uppercase tracking-wider">Name / Email</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-700 text-xs uppercase tracking-wider">Role</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-700 text-xs uppercase tracking-wider hidden md:table-cell">Department</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-700 text-xs uppercase tracking-wider">Status</th>
                  <th className="text-left px-4 py-3 font-semibold text-slate-700 text-xs uppercase tracking-wider hidden lg:table-cell">Last Login</th>
                  <th className="text-right px-4 py-3 font-semibold text-slate-700 text-xs uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-slate-400">
                      <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
                      Loading staff...
                    </td>
                  </tr>
                ) : !data || data.items.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-slate-400">
                      <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
                      No staff members found
                    </td>
                  </tr>
                ) : (
                  data.items.map((staff) => (
                    <tr key={staff.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900 text-sm">{staff.name}</div>
                        <div className="text-xs text-slate-500 mt-0.5">{staff.email}</div>
                      </td>
                      <td className="px-4 py-3">{roleBadge(staff.role)}</td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <span className="text-xs text-slate-600">{staff.departmentName ?? <span className="text-slate-400">—</span>}</span>
                      </td>
                      <td className="px-4 py-3">
                        {staff.isActive ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-full">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-rose-100 text-rose-800 border border-rose-200 px-2 py-0.5 rounded-full">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span> Inactive
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">{formatDate(staff.lastLoginAt)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Link href={`/admin/staff/${staff.id}/activity`}>
                            <Button variant="ghost" size="sm" title="View Activity">
                              <Activity className="w-4 h-4 text-slate-500" />
                            </Button>
                          </Link>
                          <Button variant="ghost" size="sm" title="Reassign" onClick={() => openReassign(staff)}>
                            <Users className="w-4 h-4 text-blue-600" />
                          </Button>
                          {staff.isActive ? (
                            <Button variant="ghost" size="sm" title="Deactivate" onClick={() => setDeactivateTarget(staff)}>
                              <UserX className="w-4 h-4 text-rose-600" />
                            </Button>
                          ) : (
                            <Button variant="ghost" size="sm" title="Reactivate" onClick={() => handleReactivate(staff)}>
                              <UserCheck className="w-4 h-4 text-emerald-600" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {data && data.totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t bg-slate-50">
              <p className="text-xs text-slate-500">
                Showing {((data.page - 1) * data.limit) + 1}–{Math.min(data.page * data.limit, data.total)} of {data.total} staff
              </p>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-xs px-2 text-slate-600">Page {data.page} / {data.totalPages}</span>
                <Button variant="outline" size="sm" disabled={page >= data.totalPages} onClick={() => setPage(p => p + 1)}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </Card>

        {/* ── Create Staff Modal ──────────────────────────────────────────── */}
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Staff Account</DialogTitle>
              <DialogDescription>
                Add a new staff member. They can sign in via Google using this email.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              {createError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded">{createError}</div>
              )}
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Full Name <span className="text-rose-500">*</span></label>
                <Input placeholder="e.g. Amit Sharma" value={createName} onChange={(e) => setCreateName(e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Work Email <span className="text-rose-500">*</span></label>
                <Input type="email" placeholder="e.g. amit.sharma@smartcity.gov.in" value={createEmail} onChange={(e) => setCreateEmail(e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Role <span className="text-rose-500">*</span></label>
                <select
                  value={createRole}
                  onChange={(e) => { setCreateRole(e.target.value); setCreateDept(''); }}
                  className="w-full h-10 px-3 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="DEPARTMENT_HEAD">Department Head</option>
                  <option value="DEPARTMENT_OFFICER">Department Officer</option>
                  <option value="FIELD_WORKER">Field Worker</option>
                </select>
              </div>
              {needsDept && (
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Department <span className="text-rose-500">*</span></label>
                  <select
                    value={createDept}
                    onChange={(e) => setCreateDept(e.target.value)}
                    className="w-full h-10 px-3 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">— Select Department —</option>
                    {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button className="bg-blue-600 hover:bg-blue-700 text-white" onClick={handleCreate} disabled={creating}>
                {creating ? 'Creating...' : 'Create Staff'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ── Deactivate Confirmation Modal ──────────────────────────────── */}
        <Dialog open={!!deactivateTarget} onOpenChange={(o) => !o && setDeactivateTarget(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="text-rose-600">Deactivate Staff Account</DialogTitle>
              <DialogDescription>
                Are you sure you want to deactivate <strong className="text-slate-900">{deactivateTarget?.name}</strong>?
                They will no longer be able to access the platform until reactivated.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="mt-4">
              <Button variant="outline" onClick={() => setDeactivateTarget(null)}>Cancel</Button>
              <Button className="bg-rose-600 hover:bg-rose-700 text-white" onClick={handleDeactivate} disabled={deactivating}>
                {deactivating ? 'Deactivating...' : 'Confirm Deactivate'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ── Reassign Modal ─────────────────────────────────────────────── */}
        <Dialog open={!!reassignTarget} onOpenChange={(o) => !o && setReassignTarget(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reassign Staff</DialogTitle>
              <DialogDescription>
                Change role or department for <strong className="text-slate-900">{reassignTarget?.name}</strong>.
                Current: <span className="text-blue-700">{reassignTarget?.role}</span>
                {reassignTarget?.departmentName && ` · ${reassignTarget.departmentName}`}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              {reassignError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded">{reassignError}</div>
              )}
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">New Role</label>
                <select
                  value={reassignRole}
                  onChange={(e) => { setReassignRole(e.target.value); setReassignDept(''); }}
                  className="w-full h-10 px-3 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="DEPARTMENT_HEAD">Department Head</option>
                  <option value="DEPARTMENT_OFFICER">Department Officer</option>
                  <option value="FIELD_WORKER">Field Worker</option>
                </select>
              </div>
              {reassignNeedsDept && (
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Department</label>
                  <select
                    value={reassignDept}
                    onChange={(e) => setReassignDept(e.target.value)}
                    className="w-full h-10 px-3 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">— Select Department —</option>
                    {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setReassignTarget(null)}>Cancel</Button>
              <Button className="bg-blue-600 hover:bg-blue-700 text-white" onClick={handleReassign} disabled={reassigning}>
                {reassigning ? 'Reassigning...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      </div>
    </AppShell>
  );
}
