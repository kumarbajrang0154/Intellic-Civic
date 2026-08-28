'use client';

import React, { useEffect, useState } from 'react';
import { Edit2, RefreshCw, Users } from 'lucide-react';
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
import { Select } from '@/components/ui/select';

interface Department {
  id: string;
  name: string;
}

interface UserItem {
  id: string;
  name: string;
  email: string;
  role: string | null;
  isAuthorized: boolean;
  departmentId: string | null;
  department?: { id: string; name: string };
  createdAt: string;
}

export default function AdminAllUsersPage() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [deptFilter, setDeptFilter] = useState<string>('ALL');

  // Edit User state
  const [editUser, setEditUser] = useState<UserItem | null>(null);
  const [editRole, setEditRole] = useState<string>('DEPARTMENT_OFFICER');
  const [editDeptId, setEditDeptId] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchData();
  }, [roleFilter, deptFilter]);

  async function fetchData() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (roleFilter !== 'ALL') params.append('role', roleFilter);
      if (deptFilter !== 'ALL') params.append('departmentId', deptFilter);

      const [uRes, dRes] = await Promise.all([
        fetch(`/api/users?${params.toString()}`),
        fetch('/api/departments'),
      ]);

      if (uRes.ok) {
        const uData = await uRes.json();
        setUsers(uData.data || []);
      }
      if (dRes.ok) {
        const dData = await dRes.json();
        setDepartments(Array.isArray(dData) ? dData : dData.data || []);
      }
    } catch (err) {
      console.error('Failed to load users roster:', err);
    } finally {
      setLoading(false);
    }
  }

  function openEditModal(u: UserItem) {
    setEditUser(u);
    setEditRole(u.role || 'DEPARTMENT_OFFICER');
    setEditDeptId(u.departmentId || (departments[0]?.id ?? ''));
  }

  async function handleSaveEdit() {
    if (!editUser) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/users/${editUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: editRole,
          departmentId: editRole === 'ADMIN' ? null : editDeptId,
        }),
      });

      if (res.ok) {
        const updated = await res.json();
        setUsers((prev) =>
          prev.map((u) => (u.id === editUser.id ? { ...u, ...updated } : u)),
        );
        setEditUser(null);
      }
    } catch (err) {
      console.error('Failed to update user:', err);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell user={{ name: 'Super Admin', role: 'ADMIN' }}>
      <div className="space-y-6 p-6 max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Staff User Roster
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              System-wide directory of all authorized staff, heads & admin accounts
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh Roster
          </Button>
        </div>

        {/* Filters Bar */}
        <Card className="border p-4 bg-white shadow-sm">
          <div className="flex flex-wrap items-center gap-4">
            <div className="min-w-[180px]">
              <label className="text-xs font-semibold text-slate-600 block mb-1">
                Filter by Role
              </label>
              <Select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
                <option value="ALL">All Roles</option>
                <option value="DEPARTMENT_HEAD">Department Head</option>
                <option value="DEPARTMENT_OFFICER">Department Officer</option>
                <option value="ADMIN">Super Admin</option>
                <option value="CITIZEN">Citizen</option>
              </Select>
            </div>

            <div className="min-w-[200px]">
              <label className="text-xs font-semibold text-slate-600 block mb-1">
                Filter by Department
              </label>
              <Select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)}>
                <option value="ALL">All Departments</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        </Card>

        {/* Roster List */}
        {loading ? (
          <div className="p-12 text-center text-slate-500">Loading staff roster...</div>
        ) : users.length === 0 ? (
          <Card className="border p-12 text-center text-slate-500">
            No staff accounts found matching filters.
          </Card>
        ) : (
          <div className="bg-white border rounded-lg overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-600 border-b font-medium">
                  <tr>
                    <th className="p-4">User Name / Email</th>
                    <th className="p-4">Role</th>
                    <th className="p-4">Department</th>
                    <th className="p-4">Status</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50">
                      <td className="p-4">
                        <div className="font-semibold text-slate-900">{u.name}</div>
                        <div className="text-xs text-slate-500">{u.email}</div>
                      </td>
                      <td className="p-4 font-mono text-xs text-slate-700">
                        {u.role || 'UNASSIGNED'}
                      </td>
                      <td className="p-4 text-slate-700">
                        {u.department?.name || u.departmentId || 'System Wide'}
                      </td>
                      <td className="p-4">
                        {u.isAuthorized ? (
                          <span className="text-xs bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-medium">
                            Authorized
                          </span>
                        ) : (
                          <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-medium">
                            Pending Approval
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditModal(u)}
                        >
                          <Edit2 className="w-4 h-4 mr-1 text-slate-600" />
                          Edit Role
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Edit User Modal */}
        <Dialog open={!!editUser} onOpenChange={(open) => !open && setEditUser(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Staff Credentials</DialogTitle>
              <DialogDescription>
                Modify role and department for {editUser?.name}.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  System Role
                </label>
                <Select value={editRole} onChange={(e) => setEditRole(e.target.value)}>
                  <option value="DEPARTMENT_HEAD">Department Head</option>
                  <option value="DEPARTMENT_OFFICER">Department Officer</option>
                  <option value="ADMIN">Super Admin</option>
                </Select>
              </div>

              {editRole !== 'ADMIN' && (
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Department
                  </label>
                  <Select value={editDeptId} onChange={(e) => setEditDeptId(e.target.value)}>
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
              <Button variant="outline" onClick={() => setEditUser(null)}>
                Cancel
              </Button>
              <Button
                className="bg-blue-600 hover:bg-blue-700 text-white"
                onClick={handleSaveEdit}
                disabled={submitting}
              >
                {submitting ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}
