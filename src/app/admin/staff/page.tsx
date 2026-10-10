'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  AlertCircle,
  BarChart3,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  KeyRound,
  Plus,
  RefreshCw,
  Search,
  Trash2,
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
import { showGlobalError } from '@/lib/api-client';

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
  assignedOfficerId: string | null;
  assignedOfficerName: string | null;
  municipalityId: string | null;
  isActive: boolean;
  isAuthorized: boolean;
  lastLoginAt: string | null;
  loginId?: string | null;
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
    ADMIN: 'bg-indigo-100 text-indigo-950 border-indigo-300',
    SUPER_ADMIN: 'bg-indigo-100 text-indigo-950 border-indigo-300',
    DEPARTMENT_HEAD: 'bg-purple-100 text-purple-950 border-purple-300',
    DEPARTMENT_OFFICER: 'bg-emerald-100 text-emerald-950 border-emerald-300',
    FIELD_WORKER: 'bg-cyan-100 text-cyan-950 border-cyan-300',
  };
  const labels: Record<string, string> = {
    ADMIN: 'Super Admin',
    SUPER_ADMIN: 'Super Admin',
    DEPARTMENT_HEAD: 'Dept Head',
    DEPARTMENT_OFFICER: 'Officer',
    FIELD_WORKER: 'Field Worker',
  };
  const cls = role ? (map[role] ?? 'bg-slate-100 text-slate-900 border-slate-300') : 'bg-slate-100 text-slate-600 border-slate-300';
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
  const [createAssignedOfficer, setCreateAssignedOfficer] = useState('');
  const [deptOfficers, setDeptOfficers] = useState<{ id: string; name: string; email: string }[]>([]);
  const [loadingOfficers, setLoadingOfficers] = useState(false);
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

  // Credentials generation & reset state
  const [credentialsTarget, setCredentialsTarget] = useState<StaffMember | null>(null);
  const [isResetMode, setIsResetMode] = useState(false);
  const [credentialsGenerating, setCredentialsGenerating] = useState(false);
  const [revealedCredentials, setRevealedCredentials] = useState<{
    loginId: string;
    password: string;
    name: string;
    isReset?: boolean;
  } | null>(null);
  const [copiedField, setCopiedField] = useState<'loginId' | 'password' | 'both' | null>(null);

  // Delete (remove) confirmation & preflight
  const [deleteTarget, setDeleteTarget] = useState<StaffMember | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [preflightLoading, setPreflightLoading] = useState(false);
  const [preflightData, setPreflightData] = useState<{
    canHardDelete: boolean;
    isSelf: boolean;
    isProtected: boolean;
    isLastAdmin: boolean;
    blockers: {
      openAssignedComplaints: number;
      resolvedComplaintsHandled: number;
      citizenComplaints: number;
      feedbacks: number;
      assignedWorkers: number;
      auditRows: number;
      evidence: number;
      notifications: number;
      statusHistory: number;
      pendingApprovals: number;
    };
    reasons: string[];
  } | null>(null);
  const [archiving, setArchiving] = useState(false);
  const [showReassignComplaintsModal, setShowReassignComplaintsModal] = useState(false);
  const [targetStaffIdForComplaints, setTargetStaffIdForComplaints] = useState('');
  const [reassigningComplaints, setReassigningComplaints] = useState(false);

  // Conflict 409 State
  const [conflictInfo, setConflictInfo] = useState<{
    id: string;
    name: string;
    email: string;
    role: string | null;
    status: 'active' | 'deactivated' | 'pending' | 'citizen';
    municipality: string;
    municipalityId: string | null;
    departmentName: string | null;
    departmentId: string | null;
    createdAt: string;
  } | null>(null);

  // Conversion Dialog State (Convert Citizen / Pending -> Staff)
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [convertRole, setConvertRole] = useState('DEPARTMENT_OFFICER');
  const [convertDept, setConvertDept] = useState('');
  const [converting, setConverting] = useState(false);
  const [convertError, setConvertError] = useState('');

  // Bulk actions state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [showBulkReassignModal, setShowBulkReassignModal] = useState(false);
  const [bulkReassignDeptId, setBulkReassignDeptId] = useState('');

  // Current user info
  const [currentUser, setCurrentUser] = useState({ name: 'Admin', role: 'ADMIN' as 'ADMIN' | 'SUPER_ADMIN' });

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((d) => {
        if (d.user) {
          setCurrentUser({
            name: d.user.name || 'Admin',
            role: d.user.role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : 'ADMIN',
          });
        }
      })
      .catch(console.error);
  }, []);

  // ── Load departments once ────────────────────────────────────────────────────

  useEffect(() => {
    fetch('/api/departments')
      .then((r) => r.json())
      .then((d) => setDepartments(Array.isArray(d) ? d : d.data || []))
      .catch(console.error);
  }, []);

  // Fetch Department Officers when department changes for FIELD_WORKER
  useEffect(() => {
    if (createDept && createRole === 'FIELD_WORKER') {
      setLoadingOfficers(true);
      fetch(`/api/admin/staff?role=DEPARTMENT_OFFICER&departmentId=${createDept}&status=active&limit=100`)
        .then((r) => r.json())
        .then((d) => setDeptOfficers(d.items || []))
        .catch(console.error)
        .finally(() => setLoadingOfficers(false));
    } else {
      setDeptOfficers([]);
      setCreateAssignedOfficer('');
    }
  }, [createDept, createRole]);

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

  // ── Bulk Actions Helpers ─────────────────────────────────────────────────────
  const allSelected = (data?.items?.length ?? 0) > 0 && selectedIds.length === data!.items.length;

  function toggleSelectAll() {
    if (!data?.items) return;
    if (allSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(data.items.map((i) => i.id));
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }

  async function handleBulkAction(action: string, extra: Record<string, any> = {}) {
    if (selectedIds.length === 0) return;
    setBulkSubmitting(true);
    try {
      const res = await fetch('/api/admin/staff/bulk', {
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
          message: result.message || 'Bulk operation failed',
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
        hint: perIdReasons || (result.failed === 0 ? 'All selected items processed successfully.' : undefined),
      });

      setSelectedIds([]);
      fetchStaff();
    } catch (err: any) {
      showGlobalError({
        title: 'Bulk Action Error',
        message: err.message || 'Network error occurred',
      });
    } finally {
      setBulkSubmitting(false);
    }
  }

  // ── Create Staff ─────────────────────────────────────────────────────────────

  function openCreate() {
    setCreateName(''); setCreateEmail(''); setCreateRole('DEPARTMENT_OFFICER');
    setCreateDept(''); setCreateAssignedOfficer(''); setCreateError(''); setCreateOpen(true);
  }

  async function handleCreate() {
    if (!createName.trim() || !createEmail.trim()) {
      setCreateError('Name and email are required.'); return;
    }
    const needsDepartment = ['DEPARTMENT_OFFICER', 'FIELD_WORKER'].includes(createRole);
    if (needsDepartment && !createDept) {
      setCreateError('Department assignment is required for this role.'); return;
    }
    if (createRole === 'FIELD_WORKER' && !createAssignedOfficer) {
      setCreateError('An assigned Department Officer is required for Field Workers.'); return;
    }
    setCreating(true); setCreateError('');
    try {
      const res = await fetch('/api/admin/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: createName.trim(), email: createEmail.trim(),
          role: createRole, departmentId: needsDepartment ? (createDept || null) : null,
          assignedOfficerId: createRole === 'FIELD_WORKER' ? (createAssignedOfficer || null) : null,
        }),
      });
      const d = await res.json();
      if (!res.ok) {
        if (res.status === 409 && d.conflict) {
          setCreateOpen(false);
          setConflictInfo(d.conflict);
          return;
        }
        setCreateError(d.message || 'Failed to create staff.');
        return;
      }
      setCreateOpen(false);
      fetchStaff();
    } catch {
      setCreateError('Network error. Please try again.');
    } finally {
      setCreating(false);
    }
  }

  // ── Preflight & Safe Delete Alternatives ─────────────────────────────────────

  function openDelete(staff: StaffMember) {
    setDeleteTarget(staff);
    fetchPreflight(staff.id);
  }

  async function fetchPreflight(staffId: string) {
    setPreflightLoading(true);
    setPreflightData(null);
    try {
      const res = await fetch(`/api/admin/users/${staffId}/delete-preflight`);
      if (res.ok) {
        const d = await res.json();
        setPreflightData(d);
      }
    } catch (err) {
      console.error('Error fetching delete preflight:', err);
    } finally {
      setPreflightLoading(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/staff/${deleteTarget.id}`, { method: 'DELETE' });
      const d = await res.json();
      if (!res.ok) {
        showGlobalError({
          title: 'Delete Blocked',
          message: d.message || 'Cannot delete staff member.',
          hint: d.reasons?.join('\n'),
        });
        return;
      }
      setDeleteTarget(null);
      fetchStaff();
      showGlobalError({
        title: 'Staff Deleted',
        message: 'Staff member permanently removed.',
      });
    } finally {
      setDeleting(false);
    }
  }

  async function handleArchive(staffId: string) {
    setArchiving(true);
    try {
      const res = await fetch(`/api/admin/users/${staffId}/archive`, { method: 'POST' });
      const d = await res.json();
      if (!res.ok) {
        showGlobalError({
          title: 'Archive Failed',
          message: d.message || 'Failed to archive account.',
        });
        return;
      }
      setDeleteTarget(null);
      fetchStaff();
      showGlobalError({
        title: 'Account Archived & Anonymized',
        message: 'Account archived successfully. Original email has been freed and can now be reused.',
      });
    } finally {
      setArchiving(false);
    }
  }

  async function handleReassignComplaints() {
    if (!deleteTarget || !targetStaffIdForComplaints) return;
    setReassigningComplaints(true);
    try {
      const res = await fetch(`/api/admin/users/${deleteTarget.id}/reassign-complaints`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetStaffId: targetStaffIdForComplaints }),
      });
      const d = await res.json();
      if (!res.ok) {
        showGlobalError({
          title: 'Reassignment Failed',
          message: d.message || 'Failed to reassign complaints.',
        });
        return;
      }
      setShowReassignComplaintsModal(false);
      showGlobalError({
        title: 'Complaints Reassigned',
        message: `Successfully reassigned ${d.reassignedCount} items. Re-checking delete preflight...`,
      });
      fetchPreflight(deleteTarget.id);
      fetchStaff();
    } finally {
      setReassigningComplaints(false);
    }
  }

  async function handleConvertCitizen() {
    if (!conflictInfo) return;
    setConverting(true);
    setConvertError('');
    try {
      const res = await fetch(`/api/admin/users/${conflictInfo.id}/convert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: convertRole,
          departmentId: ['DEPARTMENT_OFFICER', 'FIELD_WORKER'].includes(convertRole) ? (convertDept || null) : null,
        }),
      });
      const d = await res.json();
      if (!res.ok) {
        setConvertError(d.message || 'Failed to convert user.');
        return;
      }
      setShowConvertModal(false);
      setConflictInfo(null);
      showGlobalError({
        title: 'Account Converted to Staff',
        message: `Successfully converted ${conflictInfo.name} (${conflictInfo.email}) to ${convertRole}.`,
      });
      fetchStaff();
    } catch {
      setConvertError('Network error occurred.');
    } finally {
      setConverting(false);
    }
  }

  // ── Deactivate ───────────────────────────────────────────────────────────────

  async function handleDeactivate() {
    if (!deactivateTarget) return;
    setDeactivating(true);
    try {
      const res = await fetch(`/api/admin/staff/${deactivateTarget.id}/deactivate`, { method: 'PATCH' });
      if (res.ok) { setDeactivateTarget(null); fetchStaff(); }
    } finally { setDeactivating(false); }
  }

  async function handleReactivate(staff: StaffMember) {
    const res = await fetch(`/api/admin/staff/${staff.id}/reactivate`, { method: 'PATCH' });
    if (res.ok) fetchStaff();
  }

  // ── Credentials Management ───────────────────────────────────────────────────

  function openCredentialsDialog(staff: StaffMember) {
    setCredentialsTarget(staff);
    setIsResetMode(Boolean(staff.loginId));
  }

  function handleCopy(text: string, field: 'loginId' | 'password' | 'both') {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(text);
    }
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2500);
  }

  async function handleGenerateCredentials() {
    if (!credentialsTarget) return;
    setCredentialsGenerating(true);
    try {
      const res = await fetch(`/api/admin/staff/${credentialsTarget.id}/credentials`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reset: isResetMode }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showGlobalError({
          title: 'Action Failed',
          message: data?.message || 'Failed to generate staff credentials.',
          statusCode: res.status,
        });
        return;
      }
      setRevealedCredentials({
        loginId: data.loginId,
        password: data.password,
        name: credentialsTarget.name,
        isReset: isResetMode,
      });
      setCredentialsTarget(null);
      fetchStaff();
    } catch (err: any) {
      showGlobalError({
        title: 'Action Failed',
        message: err?.message || 'Network error occurred.',
        statusCode: 500,
      });
    } finally {
      setCredentialsGenerating(false);
    }
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
    const reassignNeedsDept = ['DEPARTMENT_OFFICER', 'FIELD_WORKER'].includes(reassignRole);
    try {
      const res = await fetch(`/api/admin/staff/${reassignTarget.id}/reassign`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newRole: reassignRole, newDepartmentId: reassignNeedsDept ? (reassignDept || null) : null }),
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

  const needsDept = ['DEPARTMENT_OFFICER', 'FIELD_WORKER'].includes(createRole);
  const reassignNeedsDept = ['DEPARTMENT_OFFICER', 'FIELD_WORKER'].includes(reassignRole);

  return (
    <AppShell user={{ name: currentUser.name, role: currentUser.role }}>
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
                className="h-10 px-3 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-blue-500 w-full sm:w-auto"
              >
                {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
              <select
                value={deptFilter}
                onChange={(e) => setDeptFilter(e.target.value)}
                className="h-10 px-3 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-blue-500 w-full sm:w-auto"
              >
                <option value="ALL">All Departments</option>
                {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-10 px-3 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-blue-500 w-full sm:w-auto"
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
                  <th className="px-4 py-3 w-10">
                    <input
                      type="checkbox"
                      aria-label="Select all staff"
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                      checked={allSelected}
                      onChange={toggleSelectAll}
                    />
                  </th>
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
                    <td colSpan={7} className="text-center py-12 text-slate-400">
                      <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
                      Loading staff...
                    </td>
                  </tr>
                ) : !data || data.items.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-slate-400">
                      <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
                      No staff members found
                    </td>
                  </tr>
                ) : (
                  data.items.map((staff) => (
                    <tr key={staff.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 w-10">
                        <input
                          type="checkbox"
                          aria-label={`Select ${staff.name}`}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                          checked={selectedIds.includes(staff.id)}
                          onChange={() => toggleSelect(staff.id)}
                        />
                      </td>
                      <td className="px-4 py-3 min-w-0 max-w-[140px] sm:max-w-none">
                        <div className="font-semibold text-slate-900 text-sm truncate">{staff.name}</div>
                        <div className="text-xs text-slate-500 mt-0.5 truncate">{staff.email}</div>
                        {staff.loginId && (
                          <div className="text-[11px] font-mono text-slate-500 mt-0.5 truncate flex items-center gap-1">
                            <span className="text-slate-400 font-sans">ID:</span>
                            <span className="font-semibold text-slate-700 bg-slate-100 px-1 rounded">{staff.loginId}</span>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">{roleBadge(staff.role)}</td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <span className="text-xs text-slate-600">{staff.departmentName ?? <span className="text-slate-400">—</span>}</span>
                      </td>
                      <td className="px-4 py-3">
                        {staff.isActive ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-emerald-100 text-emerald-950 border border-emerald-300 px-2 py-0.5 rounded-full">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span> Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-rose-100 text-rose-950 border border-rose-300 px-2 py-0.5 rounded-full">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-600"></span> Inactive
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
                          {staff.role !== 'SUPER_ADMIN' && staff.email !== 'kumarbajrang325@gmail.com' && staff.email !== 'kumarbajrang0154@gmail.com' ? (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                title={staff.loginId ? 'Reset Password' : 'Generate Credentials'}
                                data-testid={`credentials-btn-${staff.id}`}
                                onClick={() => openCredentialsDialog(staff)}
                              >
                                <KeyRound className="w-4 h-4 text-amber-600" />
                              </Button>
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
                              {/* Delete — visible to both ADMIN and SUPER_ADMIN, blocked on SUPER_ADMIN targets */}
                              <Button
                                variant="ghost"
                                size="sm"
                                title="Delete Staff"
                                onClick={() => openDelete(staff)}
                              >
                                <Trash2 className="w-4 h-4 text-rose-500" />
                              </Button>
                            </>
                          ) : (
                            <span className="text-[11px] font-semibold text-indigo-950 bg-indigo-100 border border-indigo-300 px-2.5 py-0.5 rounded-full shadow-2xs" title="Super Admin accounts are permanent and protected">
                              Protected
                            </span>
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
                  onChange={(e) => { setCreateRole(e.target.value); setCreateDept(''); setCreateAssignedOfficer(''); }}
                  className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#1769AA]/20 focus:border-[#1769AA] disabled:cursor-not-allowed disabled:opacity-50"
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
                    onChange={(e) => { setCreateDept(e.target.value); setCreateAssignedOfficer(''); }}
                    className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#1769AA]/20 focus:border-[#1769AA] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="">— Select Department —</option>
                    {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
              )}
              {createRole === 'FIELD_WORKER' && (
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Assigned Officer <span className="text-rose-500">*</span></label>
                  <select
                    value={createAssignedOfficer}
                    onChange={(e) => setCreateAssignedOfficer(e.target.value)}
                    disabled={!createDept || loadingOfficers || deptOfficers.length === 0}
                    className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#1769AA]/20 focus:border-[#1769AA] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="">
                      {!createDept
                        ? '— Select Department First —'
                        : loadingOfficers
                        ? 'Loading department officers...'
                        : deptOfficers.length === 0
                        ? '— No Active Officers in Department —'
                        : '— Select Assigned Officer —'}
                    </option>
                    {deptOfficers.map((off) => (
                      <option key={off.id} value={off.id}>
                        {off.name} ({off.email})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button className="bg-gradient-to-r from-[#2563EB] to-[#0891B2] text-white hover:opacity-95 shadow-sm" onClick={handleCreate} disabled={creating}>
                {creating ? 'Creating...' : 'Create Staff'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ── Generate / Reset Credentials Confirm Dialog ────────────────────── */}
        <Dialog open={!!credentialsTarget} onOpenChange={(o) => !o && setCredentialsTarget(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-slate-900">
                <KeyRound className="w-5 h-5 text-amber-600 shrink-0" />
                {isResetMode ? 'Reset Staff Password' : 'Generate Staff Credentials'}
              </DialogTitle>
              <DialogDescription className="text-sm text-slate-600 leading-relaxed pt-1">
                {isResetMode ? (
                  <>
                    Are you sure you want to reset the password for{' '}
                    <strong className="text-slate-900">{credentialsTarget?.name}</strong>?
                    Their existing password will be invalidated immediately.
                  </>
                ) : (
                  <>
                    Generate a unique Login ID and temporary 12-character password for{' '}
                    <strong className="text-slate-900">{credentialsTarget?.name}</strong>?
                  </>
                )}
              </DialogDescription>
            </DialogHeader>

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-xs leading-relaxed">
              A temporary random 12-character password will be generated. It will only be revealed <strong>once</strong> on the next screen.
            </div>

            <DialogFooter className="mt-4 flex gap-2">
              <Button
                variant="outline"
                onClick={() => setCredentialsTarget(null)}
                disabled={credentialsGenerating}
              >
                Cancel
              </Button>
              <Button
                className="bg-amber-600 hover:bg-amber-700 text-white min-h-[44px]"
                onClick={handleGenerateCredentials}
                disabled={credentialsGenerating}
              >
                {credentialsGenerating ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin mr-1.5" />
                    {isResetMode ? 'Resetting...' : 'Generating...'}
                  </>
                ) : (
                  isResetMode ? 'Confirm Password Reset' : 'Confirm Generate'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ── One-Time Credentials Reveal Modal ───────────────────────────────── */}
        <Dialog open={!!revealedCredentials} onOpenChange={(o) => { if (!o) setRevealedCredentials(null); }}>
          <DialogContent className="max-w-md p-6">
            <DialogHeader className="space-y-1">
              <DialogTitle className="flex items-center gap-2 text-slate-900 text-lg">
                <KeyRound className="w-5 h-5 text-emerald-600 shrink-0" />
                Credentials {revealedCredentials?.isReset ? 'Reset' : 'Generated'}
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-600">
                Account: <strong className="text-slate-900">{revealedCredentials?.name}</strong>
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              {/* Prominent Warning Banner */}
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-950 text-xs space-y-1">
                <div className="font-bold flex items-center gap-1.5 text-rose-900 text-xs">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  SHOWN ONLY ONCE
                </div>
                <p className="text-xs leading-relaxed text-rose-900">
                  This password will <strong>never be shown again</strong> and is stored as a secure one-way hash. Copy it now and securely provide it to the staff member.
                </p>
              </div>

              {/* Login ID box */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">Login ID</label>
                <div className="flex items-center gap-2">
                  <div
                    id="revealed-login-id"
                    className="flex-1 font-mono text-sm bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg font-semibold text-slate-900 select-all"
                  >
                    {revealedCredentials?.loginId}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0 h-9 px-3 gap-1.5 min-h-[36px]"
                    onClick={() => handleCopy(revealedCredentials?.loginId || '', 'loginId')}
                  >
                    {copiedField === 'loginId' ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-xs text-emerald-700">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-slate-600" />
                        <span className="text-xs">Copy ID</span>
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* Password box */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">Temporary Password (12 characters)</label>
                <div className="flex items-center gap-2">
                  <div
                    id="revealed-password"
                    className="flex-1 font-mono text-sm bg-slate-50 border border-slate-200 px-3 py-2 rounded-lg font-semibold text-slate-900 tracking-wider select-all"
                  >
                    {revealedCredentials?.password}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0 h-9 px-3 gap-1.5 min-h-[36px]"
                    onClick={() => handleCopy(revealedCredentials?.password || '', 'password')}
                  >
                    {copiedField === 'password' ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-xs text-emerald-700">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-slate-600" />
                        <span className="text-xs">Copy Pass</span>
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* Copy All Button */}
              <Button
                type="button"
                variant="secondary"
                className="w-full text-xs font-semibold gap-2 border border-slate-200 min-h-[44px]"
                onClick={() => {
                  const text = `Staff Member: ${revealedCredentials?.name}\nLogin ID: ${revealedCredentials?.loginId}\nPassword: ${revealedCredentials?.password}`;
                  handleCopy(text, 'both');
                }}
              >
                {copiedField === 'both' ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-600" />
                    <span className="text-emerald-700">Copied All Credentials!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 text-slate-600" />
                    <span>Copy All (ID & Password)</span>
                  </>
                )}
              </Button>
            </div>

            <DialogFooter className="mt-2">
              <Button
                id="revealed-credentials-done-btn"
                className="w-full bg-slate-900 hover:bg-slate-800 text-white min-h-[44px]"
                onClick={() => setRevealedCredentials(null)}
              >
                I have securely saved these credentials
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

        {/* ── Delete Preflight & Safe Alternatives Modal ──────────────────── */}
        <Dialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) { setDeleteTarget(null); setPreflightData(null); } }}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-rose-600 flex items-center gap-2">
                <Trash2 className="w-5 h-5 text-rose-600 shrink-0" />
                Delete Staff Member: {deleteTarget?.name}
              </DialogTitle>
              <DialogDescription>
                Account: <strong className="text-slate-900">{deleteTarget?.email}</strong>
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              {preflightLoading ? (
                <div className="p-6 text-center text-slate-500">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
                  <p className="text-xs font-medium">Checking active complaints and database constraints...</p>
                </div>
              ) : preflightData ? (
                <>
                  {!preflightData.canHardDelete ? (
                    <div className="space-y-3">
                      <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs">
                        <div className="font-bold flex items-center gap-1.5 mb-1 text-rose-900">
                          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                          Hard Delete Blocked
                        </div>
                        <p className="text-xs leading-relaxed mb-2">
                          Direct deletion is blocked to prevent data loss and broken complaint records.
                        </p>
                        <ul className="list-disc pl-4 space-y-0.5 text-[11px] text-rose-800">
                          {preflightData.reasons.map((r, idx) => (
                            <li key={idx}>{r}</li>
                          ))}
                        </ul>
                      </div>

                      {/* Blocker breakdown badges */}
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="p-2.5 bg-slate-50 border rounded-md">
                          <div className="text-slate-500 text-[11px]">Open Assigned Complaints</div>
                          <div className="text-base font-bold text-slate-900">{preflightData.blockers.openAssignedComplaints}</div>
                        </div>
                        <div className="p-2.5 bg-slate-50 border rounded-md">
                          <div className="text-slate-500 text-[11px]">Resolved Complaints Handled</div>
                          <div className="text-base font-bold text-slate-900">{preflightData.blockers.resolvedComplaintsHandled}</div>
                        </div>
                        <div className="p-2.5 bg-slate-50 border rounded-md">
                          <div className="text-slate-500 text-[11px]">Audit Log Records</div>
                          <div className="text-base font-bold text-slate-900">{preflightData.blockers.auditRows}</div>
                        </div>
                        <div className="p-2.5 bg-slate-50 border rounded-md">
                          <div className="text-slate-500 text-[11px]">Uploaded Evidence</div>
                          <div className="text-base font-bold text-slate-900">{preflightData.blockers.evidence}</div>
                        </div>
                      </div>

                      {/* Safe Alternatives */}
                      <div className="pt-2 border-t">
                        <div className="text-xs font-bold text-slate-800 mb-2">Recommended Safe Alternatives:</div>
                        <div className="space-y-2">
                          {preflightData.blockers.openAssignedComplaints > 0 && (
                            <div className="flex items-center justify-between p-2.5 bg-blue-50 border border-blue-200 rounded-lg">
                              <div>
                                <div className="text-xs font-semibold text-blue-900">1. Reassign Open Complaints</div>
                                <div className="text-[11px] text-blue-700">Move open tasks to another staff member to allow retry</div>
                              </div>
                              <Button
                                size="sm"
                                variant="outline"
                                className="bg-white hover:bg-blue-100 text-blue-700 border-blue-300 text-xs shrink-0"
                                onClick={() => {
                                  setTargetStaffIdForComplaints('');
                                  setShowReassignComplaintsModal(true);
                                }}
                              >
                                Reassign
                              </Button>
                            </div>
                          )}

                          <div className="flex items-center justify-between p-2.5 bg-amber-50 border border-amber-200 rounded-lg">
                            <div>
                              <div className="text-xs font-semibold text-amber-900">2. Deactivate Account</div>
                              <div className="text-[11px] text-amber-700">Blocks login access while keeping audit history safe</div>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              className="bg-white hover:bg-amber-100 text-amber-800 border-amber-300 text-xs shrink-0"
                              onClick={() => {
                                const target = deleteTarget;
                                setDeleteTarget(null);
                                setDeactivateTarget(target);
                              }}
                            >
                              Deactivate
                            </Button>
                          </div>

                          <div className="flex items-center justify-between p-2.5 bg-purple-50 border border-purple-200 rounded-lg">
                            <div>
                              <div className="text-xs font-semibold text-purple-900">3. Archive &amp; Anonymize</div>
                              <div className="text-[11px] text-purple-700">Soft-deletes, keeps evidence snapshot, and frees the email</div>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={archiving}
                              className="bg-white hover:bg-purple-100 text-purple-800 border-purple-300 text-xs shrink-0"
                              onClick={() => { if (deleteTarget) handleArchive(deleteTarget.id); }}
                            >
                              {archiving ? 'Archiving...' : 'Archive Account'}
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-xs flex items-center gap-2">
                      <UserCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                      <div>
                        <div className="font-bold text-emerald-900">Zero Blockers Found</div>
                        <div>This account has no linked complaints or audit history. Hard delete is safe.</div>
                      </div>
                    </div>
                  )}
                </>
              ) : null}
            </div>

            <DialogFooter className="mt-2 flex flex-col sm:flex-row gap-2">
              <Button variant="outline" onClick={() => { setDeleteTarget(null); setPreflightData(null); }}>
                Close
              </Button>
              <Button
                className="bg-rose-600 hover:bg-rose-700 text-white"
                onClick={handleDelete}
                disabled={deleting || preflightLoading || !preflightData?.canHardDelete}
                title={!preflightData?.canHardDelete ? 'Hard delete is disabled because blockers exist' : undefined}
              >
                {deleting ? 'Deleting...' : 'Permanently Delete'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ── 409 Conflict Explanation Dialog ─────────────────────────────── */}
        <Dialog open={!!conflictInfo} onOpenChange={(o) => !o && setConflictInfo(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-amber-600 flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                Email Already Registered
              </DialogTitle>
              <DialogDescription>
                {conflictInfo && (
                  <span className="text-slate-800 font-medium">
                    This email is already a <strong className="text-indigo-700 uppercase">{conflictInfo.status === 'citizen' ? 'CITIZEN' : conflictInfo.status}</strong> account in <strong>{conflictInfo.municipality}</strong>.
                  </span>
                )}
              </DialogDescription>
            </DialogHeader>

            {conflictInfo && (
              <div className="space-y-3 py-2 text-xs">
                <div className="p-3 bg-slate-50 border rounded-lg space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Name:</span>
                    <span className="font-semibold text-slate-900">{conflictInfo.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Email:</span>
                    <span className="font-mono text-slate-700">{conflictInfo.email}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Role:</span>
                    <span className="font-semibold text-slate-800">{conflictInfo.role || 'CITIZEN'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Status:</span>
                    <span className="capitalize font-semibold text-slate-800">{conflictInfo.status}</span>
                  </div>
                  {conflictInfo.departmentName && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">Department:</span>
                      <span className="text-slate-800">{conflictInfo.departmentName}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-slate-500">Registered:</span>
                    <span className="text-slate-800">{new Date(conflictInfo.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                  </div>
                </div>

                <div className="space-y-2 pt-1">
                  <div className="text-[11px] font-bold text-slate-700">Available Actions:</div>
                  <div className="flex flex-col gap-2">
                    {/* 1. Open User */}
                    {conflictInfo.status === 'pending' ? (
                      <Link href={`/admin/users/pending?search=${encodeURIComponent(conflictInfo.email)}`} className="w-full">
                        <Button variant="outline" size="sm" className="w-full text-xs justify-start border-amber-300 text-amber-900 hover:bg-amber-50">
                          <UserCheck className="w-3.5 h-3.5 mr-2 text-amber-600" /> Approve in Pending Users
                        </Button>
                      </Link>
                    ) : conflictInfo.status === 'citizen' ? (
                      <Link href={`/admin/users/citizens/${conflictInfo.id}`} className="w-full">
                        <Button variant="outline" size="sm" className="w-full text-xs justify-start border-slate-300">
                          <Users className="w-3.5 h-3.5 mr-2 text-blue-600" /> Open Citizen Profile
                        </Button>
                      </Link>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full text-xs justify-start border-slate-300"
                        onClick={() => {
                          setSearch(conflictInfo.email);
                          setConflictInfo(null);
                        }}
                      >
                        <Search className="w-3.5 h-3.5 mr-2 text-blue-600" /> Filter Staff List to This User
                      </Button>
                    )}

                    {/* 2. Reactivate (if deactivated) */}
                    {conflictInfo.status === 'deactivated' && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full text-xs justify-start border-emerald-300 text-emerald-800 hover:bg-emerald-50"
                        onClick={async () => {
                          const res = await fetch(`/api/admin/staff/${conflictInfo.id}/reactivate`, { method: 'PATCH' });
                          if (res.ok) {
                            setConflictInfo(null);
                            fetchStaff();
                          }
                        }}
                      >
                        <UserCheck className="w-3.5 h-3.5 mr-2 text-emerald-600" /> Reactivate Deactivated Account
                      </Button>
                    )}

                    {/* 3. Convert citizen -> staff */}
                    {conflictInfo.status === 'citizen' && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full text-xs justify-start border-indigo-300 text-indigo-800 hover:bg-indigo-50"
                        onClick={() => {
                          setConvertRole('DEPARTMENT_OFFICER');
                          setConvertDept('');
                          setConvertError('');
                          setShowConvertModal(true);
                        }}
                      >
                        <UserCheck className="w-3.5 h-3.5 mr-2 text-indigo-600" /> Convert Citizen to Staff
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setConflictInfo(null)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ── Convert Citizen -> Staff Dialog ──────────────────────────────── */}
        <Dialog open={showConvertModal} onOpenChange={setShowConvertModal}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Convert Account to Staff</DialogTitle>
              <DialogDescription>
                Promote <strong className="text-slate-900">{conflictInfo?.name}</strong> ({conflictInfo?.email}) to a platform staff role.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              {convertError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded">{convertError}</div>
              )}
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Target Staff Role</label>
                <select
                  value={convertRole}
                  onChange={(e) => { setConvertRole(e.target.value); setConvertDept(''); }}
                  className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="DEPARTMENT_HEAD">Department Head</option>
                  <option value="DEPARTMENT_OFFICER">Department Officer</option>
                  <option value="FIELD_WORKER">Field Worker</option>
                </select>
              </div>

              {['DEPARTMENT_OFFICER', 'FIELD_WORKER'].includes(convertRole) && (
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">Assigned Department <span className="text-rose-500">*</span></label>
                  <select
                    value={convertDept}
                    onChange={(e) => setConvertDept(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">— Select Department —</option>
                    {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowConvertModal(false)}>Cancel</Button>
              <Button
                className="bg-indigo-600 hover:bg-indigo-700 text-white"
                onClick={handleConvertCitizen}
                disabled={converting || (['DEPARTMENT_OFFICER', 'FIELD_WORKER'].includes(convertRole) && !convertDept)}
              >
                {converting ? 'Converting...' : 'Confirm Conversion'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ── Reassign Open Complaints Dialog ─────────────────────────────── */}
        <Dialog open={showReassignComplaintsModal} onOpenChange={setShowReassignComplaintsModal}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Reassign Open Complaints</DialogTitle>
              <DialogDescription>
                Transfer open complaints from <strong className="text-slate-900">{deleteTarget?.name}</strong> to another active staff member.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Transfer To Staff Member</label>
                <select
                  value={targetStaffIdForComplaints}
                  onChange={(e) => setTargetStaffIdForComplaints(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">— Select Active Staff Member —</option>
                  {data?.items
                    ?.filter((s) => s.id !== deleteTarget?.id && s.isActive)
                    ?.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.role} · {s.departmentName || 'General'})
                      </option>
                    ))}
                </select>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowReassignComplaintsModal(false)}>Cancel</Button>
              <Button
                className="bg-blue-600 hover:bg-blue-700 text-white"
                onClick={handleReassignComplaints}
                disabled={reassigningComplaints || !targetStaffIdForComplaints}
              >
                {reassigningComplaints ? 'Reassigning...' : 'Transfer Complaints'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>


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
                  className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#1769AA]/20 focus:border-[#1769AA] disabled:cursor-not-allowed disabled:opacity-50"
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
                    className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#1769AA]/20 focus:border-[#1769AA] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="">— Select Department —</option>
                    {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setReassignTarget(null)}>Cancel</Button>
              <Button className="bg-gradient-to-r from-[#2563EB] to-[#0891B2] text-white hover:opacity-95 shadow-sm" onClick={handleReassign} disabled={reassigning}>
                {reassigning ? 'Reassigning...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ── Bulk Delete Confirm Dialog ──────────────────────────────────── */}
        <Dialog open={showBulkDeleteConfirm} onOpenChange={setShowBulkDeleteConfirm}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirm Bulk Deletion</DialogTitle>
              <DialogDescription>
                Are you sure you want to permanently delete <strong className="text-slate-900">{selectedIds.length}</strong> staff member(s)? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowBulkDeleteConfirm(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                disabled={bulkSubmitting}
                onClick={() => {
                  setShowBulkDeleteConfirm(false);
                  handleBulkAction('DELETE');
                }}
              >
                {bulkSubmitting ? 'Deleting...' : `Delete ${selectedIds.length} Staff`}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ── Bulk Reassign Department Dialog ─────────────────────────────── */}
        <Dialog open={showBulkReassignModal} onOpenChange={setShowBulkReassignModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reassign Department</DialogTitle>
              <DialogDescription>
                Select target department for <strong className="text-slate-900">{selectedIds.length}</strong> selected staff member(s). Field workers will be skipped (require officer in target dept).
              </DialogDescription>
            </DialogHeader>
            <div className="py-3">
              <label className="text-xs font-semibold text-slate-700 block mb-1">Target Department</label>
              <select
                value={bulkReassignDeptId}
                onChange={(e) => setBulkReassignDeptId(e.target.value)}
                className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#1769AA]/20 focus:border-[#1769AA]"
              >
                <option value="">— Select Department —</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowBulkReassignModal(false)}>Cancel</Button>
              <Button
                disabled={!bulkReassignDeptId || bulkSubmitting}
                className="bg-blue-600 hover:bg-blue-700 text-white"
                onClick={() => {
                  setShowBulkReassignModal(false);
                  handleBulkAction('REASSIGN_DEPT', { departmentId: bulkReassignDeptId });
                }}
              >
                Confirm Reassign
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ── Sticky Bulk Action Bar ───────────────────────────────────────── */}
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
              variant="outline"
              className="bg-slate-800 hover:bg-slate-700 text-white border-slate-700 text-xs"
              disabled={bulkSubmitting}
              onClick={() => handleBulkAction('DEACTIVATE')}
            >
              Deactivate
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="bg-slate-800 hover:bg-slate-700 text-white border-slate-700 text-xs"
              disabled={bulkSubmitting}
              onClick={() => handleBulkAction('REACTIVATE')}
            >
              Reactivate
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="bg-slate-800 hover:bg-slate-700 text-white border-slate-700 text-xs"
              disabled={bulkSubmitting}
              onClick={() => setShowBulkReassignModal(true)}
            >
              Reassign Dept
            </Button>
            <Button
              size="sm"
              variant="destructive"
              className="text-xs"
              disabled={bulkSubmitting}
              onClick={() => setShowBulkDeleteConfirm(true)}
            >
              Delete
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
