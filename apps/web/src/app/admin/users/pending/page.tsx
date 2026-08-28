'use client';

import React, { useEffect, useState } from 'react';
import { CheckCircle2, RefreshCw, ShieldAlert, UserX } from 'lucide-react';
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

  // Approve dialog state
  const [approveUser, setApproveUser] = useState<PendingUser | null>(null);
  const [selectedRole, setSelectedRole] = useState<string>('DEPARTMENT_OFFICER');
  const [selectedDeptId, setSelectedDeptId] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

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
        }
      }
    } catch (err) {
      console.error('Failed to load pending users:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirmApprove() {
    if (!approveUser) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/users/${approveUser.id}/approve`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: selectedRole,
          departmentId: selectedDeptId,
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
          <div className="grid grid-cols-1 gap-4">
            {users.map((u) => (
              <Card key={u.id} className="border shadow-sm bg-white">
                <CardContent className="p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
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

                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <Button
                      variant="outline"
                      className="text-rose-600 border-rose-200 hover:bg-rose-50"
                      onClick={() => handleReject(u.id)}
                    >
                      <UserX className="w-4 h-4 mr-2" />
                      Reject
                    </Button>
                    <Button
                      className="bg-emerald-600 hover:bg-emerald-700 text-white"
                      onClick={() => setApproveUser(u)}
                    >
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      Approve Staff
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Approval Modal */}
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

              {selectedRole !== 'ADMIN' && (
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
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={handleConfirmApprove}
                disabled={submitting}
              >
                {submitting ? 'Approving...' : 'Confirm Approval'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}
