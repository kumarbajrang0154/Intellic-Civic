'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Eye, FileText, Filter, RefreshCw, Search } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

interface Department {
  id: string;
  name: string;
}

interface Category {
  id: string;
  name: string;
}

interface Complaint {
  id: string;
  ticketId: string;
  title: string;
  description: string;
  status: string;
  priority: string | null;
  createdAt: string;
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

  useEffect(() => {
    fetchMetadata();
  }, []);

  useEffect(() => {
    fetchComplaints();
  }, [statusFilter, priorityFilter, deptFilter, catFilter]);

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

  const filteredComplaints = complaints.filter((c) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      c.ticketId.toLowerCase().includes(q) ||
      c.title.toLowerCase().includes(q) ||
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
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
                    <th className="p-4 text-right">View Detail</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredComplaints.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50">
                      <td className="p-4">
                        <div className="font-mono text-xs font-bold text-slate-500">{c.ticketId}</div>
                        <div className="font-semibold text-slate-900 line-clamp-1">{c.title}</div>
                      </td>
                      <td className="p-4 text-slate-700">
                        {c.department?.name || <span className="text-amber-600 font-medium">Needs Triage</span>}
                      </td>
                      <td className="p-4 text-slate-700">
                        {c.category?.name || 'Uncategorized'}
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
                        <Link href={`/admin/complaints/${c.id}`}>
                          <Button variant="ghost" size="sm">
                            <Eye className="w-4 h-4 mr-1 text-slate-600" />
                            Inspect
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
