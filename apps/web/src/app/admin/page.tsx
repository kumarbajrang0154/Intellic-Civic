'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  Clock,
  FileText,
  FolderTree,
  ShieldAlert,
  Users,
} from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface SystemStats {
  totalComplaints: number;
  statusBreakdown: Record<string, number>;
  needsTriageCount: number;
  pendingUserApprovalsCount: number;
  departmentCount: number;
  totalStaffCount: number;
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch('/api/admin/stats');
        if (res.ok) {
          const data = await res.json();
          setStats(data);
        }
      } catch (err) {
        console.error('Failed to load system stats:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, []);

  return (
    <AppShell user={{ name: 'Super Admin', role: 'ADMIN' }}>
      <div className="space-y-8 p-6 max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">
              Super Admin System Portal
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              System-wide governance, staff approvals, triage management & operational oversight
            </p>
          </div>
          <div className="flex gap-2">
            <Link href="/admin/triage">
              <Button className="bg-amber-600 hover:bg-amber-700 text-white">
                <AlertCircle className="w-4 h-4 mr-2" />
                Triage Queue ({stats?.needsTriageCount ?? 0})
              </Button>
            </Link>
            <Link href="/admin/users/pending">
              <Button variant="outline" className="border-indigo-600 text-indigo-600 hover:bg-indigo-50">
                <ShieldAlert className="w-4 h-4 mr-2" />
                Approvals ({stats?.pendingUserApprovalsCount ?? 0})
              </Button>
            </Link>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <Card className="border shadow-sm bg-white">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">
                Total Complaints
              </CardTitle>
              <FileText className="w-5 h-5 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-slate-900">
                {loading ? '...' : (stats?.totalComplaints ?? 0)}
              </div>
              <p className="text-xs text-slate-500 mt-1">System-wide logged issues</p>
            </CardContent>
          </Card>

          <Card className="border shadow-sm bg-white">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">
                Needs Triage
              </CardTitle>
              <AlertCircle className="w-5 h-5 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-amber-600">
                {loading ? '...' : (stats?.needsTriageCount ?? 0)}
              </div>
              <p className="text-xs text-slate-500 mt-1">Unassigned or AI-rejected</p>
            </CardContent>
          </Card>

          <Card className="border shadow-sm bg-white">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">
                Pending Staff Approvals
              </CardTitle>
              <ShieldAlert className="w-5 h-5 text-indigo-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-indigo-600">
                {loading ? '...' : (stats?.pendingUserApprovalsCount ?? 0)}
              </div>
              <p className="text-xs text-slate-500 mt-1">OAuth signups awaiting review</p>
            </CardContent>
          </Card>

          <Card className="border shadow-sm bg-white">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">
                Departments & Staff
              </CardTitle>
              <Building2 className="w-5 h-5 text-emerald-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-slate-900">
                {loading ? '...' : `${stats?.departmentCount ?? 0} / ${stats?.totalStaffCount ?? 0}`}
              </div>
              <p className="text-xs text-slate-500 mt-1">Active Depts / Authorized Staff</p>
            </CardContent>
          </Card>
        </div>

        {/* Quick Links & Status Breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2 border shadow-sm bg-white">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-slate-900">
                Complaint Status Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div className="p-4 bg-slate-50 rounded-lg border border-slate-100">
                  <div className="text-xs font-medium text-slate-500">Submitted</div>
                  <div className="text-2xl font-bold text-slate-800">
                    {stats?.statusBreakdown?.SUBMITTED ?? 0}
                  </div>
                </div>
                <div className="p-4 bg-amber-50 rounded-lg border border-amber-100">
                  <div className="text-xs font-medium text-amber-700">Pending Dept Review</div>
                  <div className="text-2xl font-bold text-amber-900">
                    {stats?.statusBreakdown?.PENDING_DEPT_REVIEW ?? 0}
                  </div>
                </div>
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
                  <div className="text-xs font-medium text-blue-700">Assigned</div>
                  <div className="text-2xl font-bold text-blue-900">
                    {stats?.statusBreakdown?.ASSIGNED ?? 0}
                  </div>
                </div>
                <div className="p-4 bg-indigo-50 rounded-lg border border-indigo-100">
                  <div className="text-xs font-medium text-indigo-700">In Progress</div>
                  <div className="text-2xl font-bold text-indigo-900">
                    {stats?.statusBreakdown?.IN_PROGRESS ?? 0}
                  </div>
                </div>
                <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-100">
                  <div className="text-xs font-medium text-emerald-700">Resolved</div>
                  <div className="text-2xl font-bold text-emerald-900">
                    {stats?.statusBreakdown?.RESOLVED ?? 0}
                  </div>
                </div>
                <div className="p-4 bg-purple-50 rounded-lg border border-purple-100">
                  <div className="text-xs font-medium text-purple-700">Closed</div>
                  <div className="text-2xl font-bold text-purple-900">
                    {stats?.statusBreakdown?.CLOSED ?? 0}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border shadow-sm bg-white">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-slate-900">
                Governance Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Link href="/admin/triage" className="block">
                <Button variant="outline" className="w-full justify-start text-left font-medium h-12">
                  <AlertCircle className="w-4 h-4 mr-3 text-amber-600" />
                  <div>
                    <div>Resolve Triage Queue</div>
                    <div className="text-xs text-slate-500 font-normal">Assign unassigned issues</div>
                  </div>
                </Button>
              </Link>

              <Link href="/admin/users/pending" className="block">
                <Button variant="outline" className="w-full justify-start text-left font-medium h-12">
                  <ShieldAlert className="w-4 h-4 mr-3 text-indigo-600" />
                  <div>
                    <div>Review Staff Approvals</div>
                    <div className="text-xs text-slate-500 font-normal">Authorize pending Google signups</div>
                  </div>
                </Button>
              </Link>

              <Link href="/admin/departments" className="block">
                <Button variant="outline" className="w-full justify-start text-left font-medium h-12">
                  <Building2 className="w-4 h-4 mr-3 text-emerald-600" />
                  <div>
                    <div>Department Management</div>
                    <div className="text-xs text-slate-500 font-normal">Create and manage departments</div>
                  </div>
                </Button>
              </Link>

              <Link href="/admin/categories" className="block">
                <Button variant="outline" className="w-full justify-start text-left font-medium h-12">
                  <FolderTree className="w-4 h-4 mr-3 text-purple-600" />
                  <div>
                    <div>Category Management</div>
                    <div className="text-xs text-slate-500 font-normal">Create and map complaint categories</div>
                  </div>
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
