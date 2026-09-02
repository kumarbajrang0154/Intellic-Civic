'use client';

import React, { useEffect, useState } from 'react';
import { Edit2, Plus, Power, RefreshCw, Trash2, UserCheck, UserPlus, Users, UserX } from 'lucide-react';
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
import { Input } from '@/components/ui/input';
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
  isSuspended: boolean;
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
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Add Officer Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState('DEPARTMENT_OFFICER');
  const [newDeptId, setNewDeptId] = useState('');
  const [addError, setAddError] = useState('');
  const [adding, setAdding] = useState(false);

  // Edit User Modal State
  const [editUser, setEditUser] = useState<UserItem | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editRole, setEditRole] = useState<string>('DEPARTMENT_OFFICER');
  const [editDeptId, setEditDeptId] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  // Delete User Modal State
  const [deleteUserItem, setDeleteUserItem] = useState<UserItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchData();
  }, [roleFilter, deptFilter]);

  async function fetchData() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (roleFilter !== 'ALL') params.append('role', roleFilter);
      if (deptFilter !== 'ALL') params.append('departmentId', deptFilter);
      if (searchQuery) params.append('search', searchQuery);

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
        const deptList = Array.isArray(dData) ? dData : dData.data || [];
        setDepartments(deptList);
        if (deptList.length > 0 && !newDeptId) {
          setNewDeptId(deptList[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to load users roster:', err);
    } finally {
      setLoading(false);
    }
  }

  function openAddModal() {
    setNewName('');
    setNewEmail('');
    setNewRole('DEPARTMENT_OFFICER');
    setNewDeptId(departments[0]?.id || '');
    setAddError('');
    setIsAddModalOpen(true);
  }

  async function handleAddOfficer() {
    if (!newName.trim() || !newEmail.trim()) {
      setAddError('Name and Email are required.');
      return;
    }

    setAdding(true);
    setAddError('');
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName.trim(),
          email: newEmail.trim(),
          role: newRole,
          departmentId: newRole === 'ADMIN' ? null : newDeptId,
        }),
      });

      if (res.ok) {
        setIsAddModalOpen(false);
        fetchData();
      } else {
        const errData = await res.json();
        setAddError(errData.message || 'Failed to add officer');
      }
    } catch (err) {
      setAddError('An error occurred while creating officer.');
    } finally {
      setAdding(false);
    }
  }

  function openEditModal(u: UserItem) {
    setEditUser(u);
    setEditName(u.name);
    setEditEmail(u.email);
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
          name: editName.trim(),
          email: editEmail.trim(),
          role: editRole,
          departmentId: editRole === 'ADMIN' ? null : editDeptId,
        }),
      });

      if (res.ok) {
        setEditUser(null);
        fetchData();
      }
    } catch (err) {
      console.error('Failed to update user:', err);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleSuspend(u: UserItem) {
    try {
      const res = await fetch(`/api/users/${u.id}/suspend`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isSuspended: !u.isSuspended }),
      });

      if (res.ok) {
        fetchData();
      }
    } catch (err) {
      console.error('Failed to toggle suspend user status:', err);
    }
  }

  async function handleDeleteConfirm() {
    if (!deleteUserItem) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/users/${deleteUserItem.id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        setDeleteUserItem(null);
        fetchData();
      }
    } catch (err) {
      console.error('Failed to delete user:', err);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <AppShell user={{ name: 'Bajrang Kumar (Super Admin)', role: 'ADMIN' }}>
      <div className="space-y-6 p-6 max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b pb-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
              Officers & Staff Governance Directory
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Super Admin panel to add, edit, suspend, and remove department heads, officers, and staff
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh Roster
            </Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={openAddModal}>
              <UserPlus className="w-4 h-4 mr-2" />
              Add New Officer
            </Button>
          </div>
        </div>

        {/* Filters Bar */}
        <Card className="border p-4 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="min-w-[180px]">
                <label className="text-xs font-semibold text-slate-600 block mb-1">
                  Filter by Role
                </label>
                <Select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
                  <option value="ALL">All System Roles</option>
                  <option value="DEPARTMENT_HEAD">Department Head</option>
                  <option value="DEPARTMENT_OFFICER">Department Officer</option>
                  <option value="FIELD_WORKER">Field Worker</option>
                  <option value="ADMIN">Super Admin</option>
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

            <div className="w-full sm:w-64">
              <label className="text-xs font-semibold text-slate-600 block mb-1">
                Search Name / Email
              </label>
              <Input
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchData()}
              />
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
                    <th className="p-4">User Name & Email</th>
                    <th className="p-4">Role</th>
                    <th className="p-4">Department</th>
                    <th className="p-4">Status</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {users.map((u) => (
                    <tr key={u.id} className={`hover:bg-slate-50 ${u.isSuspended ? 'bg-amber-50/50' : ''}`}>
                      <td className="p-4">
                        <div className="font-semibold text-slate-900 flex items-center gap-2">
                          {u.name}
                          {u.role === 'ADMIN' && (
                            <span className="text-[10px] font-bold bg-purple-100 text-purple-800 px-1.5 py-0.5 rounded">
                              SUPER ADMIN
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500">{u.email}</div>
                      </td>
                      <td className="p-4 font-mono text-xs font-semibold text-slate-700">
                        {u.role || 'UNASSIGNED'}
                      </td>
                      <td className="p-4 text-slate-700">
                        {u.department?.name || u.departmentId || 'System Wide'}
                      </td>
                      <td className="p-4">
                        {u.isSuspended ? (
                          <span className="text-xs bg-rose-100 text-rose-800 border border-rose-200 px-2 py-0.5 rounded-full font-bold">
                            SUSPENDED
                          </span>
                        ) : u.isAuthorized ? (
                          <span className="text-xs bg-emerald-100 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-full font-bold">
                            AUTHORIZED
                          </span>
                        ) : (
                          <span className="text-xs bg-amber-100 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-full font-bold">
                            PENDING
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-right space-x-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          title="Edit Officer Credentials"
                          onClick={() => openEditModal(u)}
                        >
                          <Edit2 className="w-4 h-4 text-slate-600" />
                        </Button>

                        {u.role !== 'ADMIN' && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              title={u.isSuspended ? 'Activate Officer' : 'Suspend Officer'}
                              onClick={() => handleToggleSuspend(u)}
                            >
                              <Power className={`w-4 h-4 ${u.isSuspended ? 'text-emerald-600' : 'text-amber-600'}`} />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              title="Remove Officer"
                              onClick={() => setDeleteUserItem(u)}
                            >
                              <Trash2 className="w-4 h-4 text-rose-600" />
                            </Button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Add Officer Modal */}
        <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Officer / Staff Member</DialogTitle>
              <DialogDescription>
                Directly add an authorized officer or head to the system roster.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              {addError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded">
                  {addError}
                </div>
              )}
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Full Name
                </label>
                <Input
                  placeholder="e.g. Ramesh Chandra"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Email Address
                </label>
                <Input
                  type="email"
                  placeholder="e.g. ramesh@smartcity.gov.in"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Assign System Role
                </label>
                <Select value={newRole} onChange={(e) => setNewRole(e.target.value)}>
                  <option value="DEPARTMENT_OFFICER">Department Officer</option>
                  <option value="DEPARTMENT_HEAD">Department Head</option>
                  <option value="FIELD_WORKER">Field Worker</option>
                  <option value="ADMIN">Super Admin</option>
                </Select>
              </div>

              {newRole !== 'ADMIN' && (
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Assign Department
                  </label>
                  <Select value={newDeptId} onChange={(e) => setNewDeptId(e.target.value)}>
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
              <Button variant="outline" onClick={() => setIsAddModalOpen(false)}>
                Cancel
              </Button>
              <Button
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={handleAddOfficer}
                disabled={adding}
              >
                {adding ? 'Adding...' : 'Add Officer'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit User Modal */}
        <Dialog open={!!editUser} onOpenChange={(open) => !open && setEditUser(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Staff Credentials</DialogTitle>
              <DialogDescription>
                Modify details, role, and department for {editUser?.name}.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Full Name
                </label>
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Email Address
                </label>
                <Input
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  System Role
                </label>
                <Select value={editRole} onChange={(e) => setEditRole(e.target.value)}>
                  <option value="DEPARTMENT_OFFICER">Department Officer</option>
                  <option value="DEPARTMENT_HEAD">Department Head</option>
                  <option value="FIELD_WORKER">Field Worker</option>
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

        {/* Delete Confirmation Modal */}
        <Dialog open={!!deleteUserItem} onOpenChange={(open) => !open && setDeleteUserItem(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="text-rose-600">Remove Staff Account</DialogTitle>
              <DialogDescription>
                Are you sure you want to remove <strong className="text-slate-900">{deleteUserItem?.name}</strong> ({deleteUserItem?.email}) from the system directory?
              </DialogDescription>
            </DialogHeader>

            <DialogFooter className="mt-4">
              <Button variant="outline" onClick={() => setDeleteUserItem(null)}>
                Cancel
              </Button>
              <Button
                className="bg-rose-600 hover:bg-rose-700 text-white"
                onClick={handleDeleteConfirm}
                disabled={deleting}
              >
                {deleting ? 'Removing...' : 'Confirm Remove'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}
