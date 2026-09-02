'use client';

import React, { useEffect, useState } from 'react';
import { Building2, Edit2, MapPin, Plus, Power, RefreshCw, Trash2 } from 'lucide-react';
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

interface Department {
  id: string;
  name: string;
  description: string;
  headOfficeAddress?: string;
  isSuspended: boolean;
  staffCount: number;
  complaintCount: number;
  activeComplaintCount: number;
}

export default function AdminDepartmentsPage() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);

  // Create/Edit Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [nameInput, setNameInput] = useState('');
  const [descInput, setDescInput] = useState('');
  const [addressInput, setAddressInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Delete Modal State
  const [deletingDept, setDeletingDept] = useState<Department | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchDepartments();
  }, []);

  async function fetchDepartments() {
    setLoading(true);
    try {
      const res = await fetch('/api/departments');
      if (res.ok) {
        const data = await res.json();
        setDepartments(Array.isArray(data) ? data : data.data || []);
      }
    } catch (err) {
      console.error('Failed to load departments:', err);
    } finally {
      setLoading(false);
    }
  }

  function openCreateModal() {
    setEditingDept(null);
    setNameInput('');
    setDescInput('');
    setAddressInput('Civic Centre Complex, Main City Sector');
    setError('');
    setIsModalOpen(true);
  }

  function openEditModal(dept: Department) {
    setEditingDept(dept);
    setNameInput(dept.name);
    setDescInput(dept.description);
    setAddressInput(dept.headOfficeAddress || 'Civic Centre Complex, Main City Sector');
    setError('');
    setIsModalOpen(true);
  }

  async function handleSubmit() {
    if (!nameInput.trim() || !descInput.trim()) {
      setError('Department name and description are required.');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const url = editingDept ? `/api/departments/${editingDept.id}` : '/api/departments';
      const method = editingDept ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: nameInput.trim(),
          description: descInput.trim(),
          headOfficeAddress: addressInput.trim(),
        }),
      });

      if (res.ok) {
        setIsModalOpen(false);
        fetchDepartments();
      } else {
        const errData = await res.json();
        setError(errData.message || 'Failed to save department');
      }
    } catch (err) {
      setError('An error occurred while saving.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleSuspend(dept: Department) {
    try {
      const res = await fetch(`/api/departments/${dept.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isSuspended: !dept.isSuspended }),
      });

      if (res.ok) {
        fetchDepartments();
      }
    } catch (err) {
      console.error('Failed to toggle suspend status:', err);
    }
  }

  async function handleDeleteConfirm() {
    if (!deletingDept) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/departments/${deletingDept.id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        setDeletingDept(null);
        fetchDepartments();
      }
    } catch (err) {
      console.error('Failed to delete department:', err);
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
              Department & Head Office Governance
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Super Admin authority to add, edit, suspend/activate, and remove municipal departments & head offices
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={fetchDepartments} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button className="bg-blue-600 hover:bg-blue-700 text-white" onClick={openCreateModal}>
              <Plus className="w-4 h-4 mr-2" />
              Add Department
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-500">Loading departments...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {departments.map((dept) => (
              <Card key={dept.id} className={`border shadow-sm bg-white flex flex-col justify-between transition-all ${dept.isSuspended ? 'opacity-75 bg-slate-50 border-amber-300' : ''}`}>
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Building2 className={`w-5 h-5 ${dept.isSuspended ? 'text-amber-600' : 'text-blue-600'}`} />
                        <CardTitle className="text-lg font-bold text-slate-900">
                          {dept.name}
                        </CardTitle>
                      </div>
                      {dept.isSuspended ? (
                        <span className="inline-block text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-full">
                          SUSPENDED
                        </span>
                      ) : (
                        <span className="inline-block text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-full">
                          ACTIVE
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" title="Edit Department" onClick={() => openEditModal(dept)}>
                        <Edit2 className="w-4 h-4 text-slate-600" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        title={dept.isSuspended ? 'Activate Department' : 'Suspend Department'}
                        onClick={() => handleToggleSuspend(dept)}
                      >
                        <Power className={`w-4 h-4 ${dept.isSuspended ? 'text-emerald-600' : 'text-amber-600'}`} />
                      </Button>
                      <Button variant="ghost" size="sm" title="Remove Department" onClick={() => setDeletingDept(dept)}>
                        <Trash2 className="w-4 h-4 text-rose-600" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed">{dept.description}</p>

                  <div className="flex items-start gap-1.5 text-xs text-slate-500 bg-slate-50 p-2.5 rounded border">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                    <span className="line-clamp-2">{dept.headOfficeAddress || 'Civic Center Complex'}</span>
                  </div>

                  <div className="pt-3 border-t grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="p-2 bg-slate-100 rounded">
                      <div className="font-bold text-slate-900 text-base">{dept.staffCount}</div>
                      <div className="text-slate-500 font-medium">Officers</div>
                    </div>
                    <div className="p-2 bg-amber-50 rounded">
                      <div className="font-bold text-amber-900 text-base">{dept.activeComplaintCount}</div>
                      <div className="text-amber-700 font-medium">Active</div>
                    </div>
                    <div className="p-2 bg-blue-50 rounded">
                      <div className="font-bold text-blue-900 text-base">{dept.complaintCount}</div>
                      <div className="text-blue-700 font-medium">Total</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Create / Edit Department Modal */}
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingDept ? 'Edit Department & Head Office' : 'Add New Department'}</DialogTitle>
              <DialogDescription>
                {editingDept
                  ? 'Update department details and head office location.'
                  : 'Add a new municipal service department to the platform.'}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              {error && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded">
                  {error}
                </div>
              )}
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Department Name
                </label>
                <Input
                  placeholder="e.g. Roads & Infrastructure"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Head Office Location & Address
                </label>
                <Input
                  placeholder="e.g. Jal Bhawan, Block B, Central Complex"
                  value={addressInput}
                  onChange={(e) => setAddressInput(e.target.value)}
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Description & Operational Scope
                </label>
                <textarea
                  className="w-full min-h-[100px] p-3 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Describe the responsibilities of this department..."
                  value={descInput}
                  onChange={(e) => setDescInput(e.target.value)}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsModalOpen(false)}>
                Cancel
              </Button>
              <Button
                className="bg-blue-600 hover:bg-blue-700 text-white"
                onClick={handleSubmit}
                disabled={submitting}
              >
                {submitting ? 'Saving...' : editingDept ? 'Save Changes' : 'Create Department'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Department Confirmation Modal */}
        <Dialog open={!!deletingDept} onOpenChange={(open) => !open && setDeletingDept(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="text-rose-600">Remove Department</DialogTitle>
              <DialogDescription>
                Are you sure you want to remove <strong className="text-slate-900">{deletingDept?.name}</strong>? Assigned staff members will become unassigned.
              </DialogDescription>
            </DialogHeader>

            <DialogFooter className="mt-4">
              <Button variant="outline" onClick={() => setDeletingDept(null)}>
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
