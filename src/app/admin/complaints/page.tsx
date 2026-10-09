'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Eye, FileText, Filter, RefreshCw, Search, AlertCircle, UserCheck } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { getStaffComplaintText } from '@/lib/complaint-language';
import { OriginalLanguageBadge } from '@/components/ui/original-language-badge';

interface Department {
  id: string;
  name: string;
}

interface Category {
  id: string;
  name: string;
  departmentId?: string;
}

interface Complaint {
  id: string;
  ticketId: string;
  title: string;
  description: string;
  language?: string | null;
  titleEn?: string | null;
  descriptionEn?: string | null;
  status: string;
  priority: string | null;
  createdAt: string;
  needsTriage?: boolean;
  department?: { id: string; name: string };
  category?: { id: string; name: string };
  citizen?: { name: string; email: string };
}

export default function AdminAllComplaintsPage() {
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [priorityFilter, setPriorityFilter] = useState('ALL');
  const [deptFilter, setDeptFilter] = useState('ALL');
  const [catFilter, setCatFilter] = useState('ALL');
  const [triageFilter, setTriageFilter] = useState<'ALL' | 'NEEDS_TRIAGE'>('ALL');

  // Manual Assign Modal state
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null);
  const [targetDeptId, setTargetDeptId] = useState('');
  const [targetCatId, setTargetCatId] = useState('');
  const [assignNotes, setAssignNotes] = useState('');
  const [assigning, setAssigning] = useState(false);

  useEffect(() => {
    fetchMetadata();
  }, []);

  useEffect(() => {
    fetchComplaints();
  }, [statusFilter, priorityFilter, deptFilter, catFilter, triageFilter]);

  async function fetchMetadata() {
    try {
      const [dRes, cRes] = await Promise.all([
        fetch('/api/departments'),
        fetch('/api/categories'),
      ]);
      if (dRes.ok) {
        const dData = await dRes.json();
        setDepartments(Array.isArray(dData) ? dData : dData.data || []);
      }
      if (cRes.ok) {
        const cData = await cRes.json();
        setCategories(Array.isArray(cData) ? cData : cData.data || []);
      }
    } catch (err) {
      console.error('Failed to load filter metadata:', err);
    }
  }

  async function fetchComplaints() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('limit', '100');
      if (statusFilter !== 'ALL') params.append('status', statusFilter);
      if (priorityFilter !== 'ALL') params.append('priority', priorityFilter);
      if (deptFilter !== 'ALL') params.append('departmentId', deptFilter);
      if (catFilter !== 'ALL') params.append('categoryId', catFilter);
      if (triageFilter === 'NEEDS_TRIAGE') params.append('needsTriage', 'true');

      const res = await fetch(`/api/complaints?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setComplaints(data.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch complaints:', err);
    } finally {
      setLoading(false);
    }
  }

  function openAssignModal(c: Complaint) {
    setSelectedComplaint(c);
    const initialDept = c.department?.id || (departments.length > 0 ? departments[0].id : '');
    setTargetDeptId(initialDept);
    setTargetCatId(c.category?.id || '');
    setAssignNotes('');
    setAssignModalOpen(true);
  }

  async function handleManualAssign() {
    if (!selectedComplaint || !targetDeptId) return;
    setAssigning(true);
    try {
      const res = await fetch(`/api/complaints/${selectedComplaint.id}/assign`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          departmentId: targetDeptId,
          categoryId: targetCatId || undefined,
          notes: assignNotes.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Failed to assign complaint');
      }
      toast.success(`Complaint ${selectedComplaint.ticketId} successfully triaged and assigned!`);
      setAssignModalOpen(false);
      setSelectedComplaint(null);
      fetchComplaints();
    } catch (err: any) {
      toast.error(err.message || 'Error assigning complaint');
    } finally {
      setAssigning(false);
    }
  }

  const filteredComplaints = complaints.filter((c) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      c.ticketId.toLowerCase().includes(q) ||
      c.title.toLowerCase().includes(q) ||
      (c.titleEn && c.titleEn.toLowerCase().includes(q)) ||
      (c.citizen?.name && c.citizen.name.toLowerCase().includes(q))
    );
  });

  return (
    <AppShell user={{ name: 'Super Admin', role: 'ADMIN' }}>
      <div className="space-y-6 p-6 max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              System-Wide All Complaints
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Complete registry across all municipal departments and citizen submissions
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={fetchComplaints} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Filters Grid */}
        <Card className="border p-4 bg-white shadow-sm space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">Search</label>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <Input
                  className="pl-9"
                  placeholder="Ticket ID or title..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">AI Triage</label>
              <Select
                data-testid="ai-triage-filter"
                value={triageFilter}
                onChange={(e) => setTriageFilter(e.target.value as any)}
              >
                <option value="ALL">All Complaints</option>
                <option value="NEEDS_TRIAGE">Needs Triage</option>
              </Select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">Department</label>
              <Select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)}>
                <option value="ALL">All Departments</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">Status</label>
              <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="ALL">All Statuses</option>
                <option value="SUBMITTED">Submitted</option>
                <option value="PENDING_DEPT_REVIEW">Pending Dept Review</option>
                <option value="ASSIGNED">Assigned</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="RESOLVED">Resolved</option>
                <option value="CLOSED">Closed</option>
                <option value="REJECTED">Rejected</option>
              </Select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">Priority</label>
              <Select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}>
                <option value="ALL">All Priorities</option>
                <option value="CRITICAL">Critical</option>
                <option value="HIGH">High</option>
                <option value="MEDIUM">Medium</option>
                <option value="LOW">Low</option>
              </Select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">Category</label>
              <Select value={catFilter} onChange={(e) => setCatFilter(e.target.value)}>
                <option value="ALL">All Categories</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        </Card>

        {/* Complaints Table */}
        {loading ? (
          <div className="p-12 text-center text-slate-500">Loading system complaints...</div>
        ) : filteredComplaints.length === 0 ? (
          <Card className="border p-12 text-center text-slate-500">
            No complaints found matching filters.
          </Card>
        ) : (
          <div className="bg-white border rounded-lg overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-600 border-b font-medium">
                  <tr>
                    <th className="p-4">Ticket / Title</th>
                    <th className="p-4">Department</th>
                    <th className="p-4">Category</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Priority</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredComplaints.map((c) => {
                    const { displayTitle, isTitleFallback } = getStaffComplaintText(c);
                    const isNeedsTriage = Boolean(c.needsTriage || !c.category || !c.department);
                    return (
                      <tr key={c.id} className="hover:bg-slate-50">
                        <td className="p-4">
                          <div className="font-mono text-xs font-bold text-slate-500">{c.ticketId}</div>
                          <div className="font-semibold text-slate-900 line-clamp-1 flex items-center gap-1.5">
                            <span>{displayTitle}</span>
                            {isTitleFallback && <OriginalLanguageBadge />}
                          </div>
                        </td>
                        <td className="p-4 text-slate-700">
                          <div className="flex flex-col gap-1 items-start">
                            {isNeedsTriage && (
                              <span
                                data-testid="needs-triage-badge"
                                className="text-[11px] px-2 py-0.5 rounded-full font-bold bg-amber-100 text-amber-900 border border-amber-300 inline-flex items-center gap-1"
                              >
                                <AlertCircle className="w-3 h-3 text-amber-600 shrink-0" />
                                Needs Triage
                              </span>
                            )}
                            <span className="font-medium text-slate-900">
                              {c.department?.name || <span className="text-slate-400 italic">Unassigned</span>}
                            </span>
                          </div>
                        </td>
                        <td className="p-4 text-slate-700">
                          {c.category?.name || <span className="text-slate-400 italic">Uncategorized</span>}
                        </td>
                        <td className="p-4">
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-slate-100 text-slate-800">
                            {c.status}
                          </span>
                        </td>
                        <td className="p-4">
                          <span className="text-xs font-semibold text-slate-700">
                            {c.priority || 'NORMAL'}
                          </span>
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openAssignModal(c)}
                              data-testid={`manual-assign-${c.id}`}
                              className="h-8 px-2.5 text-xs text-indigo-700 border-indigo-200 hover:bg-indigo-50 font-semibold"
                            >
                              <UserCheck className="w-3.5 h-3.5 mr-1 text-indigo-600" />
                              Manual Assign
                            </Button>
                            <Link href={`/admin/complaints/${c.id}`}>
                              <Button variant="ghost" size="sm" className="h-8 px-2 text-xs">
                                <Eye className="w-4 h-4 mr-1 text-slate-600" />
                                Inspect
                              </Button>
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Manual Triage & Assign Modal */}
        <Dialog open={assignModalOpen} onOpenChange={setAssignModalOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-slate-900">
                <UserCheck className="h-5 w-5 text-indigo-600 shrink-0" />
                Manual Triage & Assignment
              </DialogTitle>
              <DialogDescription className="text-slate-600 text-xs pt-1">
                Assign department and category to complaint <strong>{selectedComplaint?.ticketId}</strong> to clear triage and forward to officers.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Target Department *</label>
                <Select
                  data-testid="target-dept-select"
                  value={targetDeptId}
                  onChange={(e) => setTargetDeptId(e.target.value)}
                >
                  <option value="">Select Department...</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Target Category (Optional)</label>
                <Select value={targetCatId} onChange={(e) => setTargetCatId(e.target.value)}>
                  <option value="">Select Category...</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">Triage Notes (Optional)</label>
                <Textarea
                  rows={2}
                  placeholder="Reason for manual assignment..."
                  value={assignNotes}
                  onChange={(e) => setAssignNotes(e.target.value)}
                  className="text-xs"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setAssignModalOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={handleManualAssign}
                disabled={assigning || !targetDeptId}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold"
              >
                {assigning ? 'Assigning...' : 'Confirm Assignment'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}
