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
      <div className="space-y-6 sm:space-y-8 min-w-0">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b pb-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground break-words">
              Super Admin System Portal
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              System-wide governance, staff approvals, triage management & operational oversight
            </p>
          </div>
          <div className="flex flex-wrap sm:flex-nowrap gap-2 w-full sm:w-auto">
            <Link href="/admin/triage" className="w-full sm:w-auto">
              <Button className="bg-amber-600 hover:bg-amber-700 text-white w-full sm:w-auto">
                <AlertCircle className="w-4 h-4 mr-2 shrink-0" />
                Triage Queue ({stats?.needsTriageCount ?? 0})
              </Button>
            </Link>
            <Link href="/admin/users/pending" className="w-full sm:w-auto">
              <Button variant="outline" className="border-indigo-600 text-indigo-600 hover:bg-indigo-50 dark:border-indigo-400 dark:text-indigo-400 w-full sm:w-auto">
                <ShieldAlert className="w-4 h-4 mr-2 shrink-0" />
                Approvals ({stats?.pendingUserApprovalsCount ?? 0})
              </Button>
            </Link>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
          <Card className="border shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Complaints
              </CardTitle>
              <FileText className="w-5 h-5 text-blue-600 shrink-0" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl sm:text-3xl font-bold text-foreground">
                {loading ? '...' : (stats?.totalComplaints ?? 0)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">System-wide logged issues</p>
            </CardContent>
          </Card>

          <Card className="border shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Needs Triage
              </CardTitle>
              <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl sm:text-3xl font-bold text-amber-600">
                {loading ? '...' : (stats?.needsTriageCount ?? 0)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Unassigned or AI-rejected</p>
            </CardContent>
          </Card>

          <Card className="border shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Pending Staff Approvals
              </CardTitle>
              <ShieldAlert className="w-5 h-5 text-indigo-600 shrink-0" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl sm:text-3xl font-bold text-indigo-600">
                {loading ? '...' : (stats?.pendingUserApprovalsCount ?? 0)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">OAuth signups awaiting review</p>
            </CardContent>
          </Card>

          <Card className="border shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Departments & Staff
              </CardTitle>
              <Building2 className="w-5 h-5 text-emerald-600 shrink-0" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl sm:text-3xl font-bold text-foreground">
                {loading ? '...' : `${stats?.departmentCount ?? 0} / ${stats?.totalStaffCount ?? 0}`}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Active Depts / Authorized Staff</p>
            </CardContent>
          </Card>
        </div>

        {/* Quick Links & Status Breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2 border shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg font-semibold">
                Complaint Status Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
                <div className="p-3 sm:p-4 bg-muted/40 rounded-lg border">
                  <div className="text-xs font-medium text-muted-foreground">Submitted</div>
                  <div className="text-xl sm:text-2xl font-bold text-foreground">
                    {stats?.statusBreakdown?.SUBMITTED ?? 0}
                  </div>
                </div>
                <div className="p-3 sm:p-4 bg-amber-500/10 rounded-lg border border-amber-500/20">
                  <div className="text-xs font-medium text-amber-700 dark:text-amber-300">Pending Review</div>
                  <div className="text-xl sm:text-2xl font-bold text-amber-900 dark:text-amber-100">
                    {stats?.statusBreakdown?.PENDING_DEPT_REVIEW ?? 0}
                  </div>
                </div>
                <div className="p-3 sm:p-4 bg-blue-500/10 rounded-lg border border-blue-500/20">
                  <div className="text-xs font-medium text-blue-700 dark:text-blue-300">Assigned</div>
                  <div className="text-xl sm:text-2xl font-bold text-blue-900 dark:text-blue-100">
                    {stats?.statusBreakdown?.ASSIGNED ?? 0}
                  </div>
                </div>
                <div className="p-3 sm:p-4 bg-indigo-500/10 rounded-lg border border-indigo-500/20">
                  <div className="text-xs font-medium text-indigo-700 dark:text-indigo-300">In Progress</div>
                  <div className="text-xl sm:text-2xl font-bold text-indigo-900 dark:text-indigo-100">
                    {stats?.statusBreakdown?.IN_PROGRESS ?? 0}
                  </div>
                </div>
                <div className="p-3 sm:p-4 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                  <div className="text-xs font-medium text-emerald-700 dark:text-emerald-300">Resolved</div>
                  <div className="text-xl sm:text-2xl font-bold text-emerald-900 dark:text-emerald-100">
                    {stats?.statusBreakdown?.RESOLVED ?? 0}
                  </div>
                </div>
                <div className="p-3 sm:p-4 bg-purple-500/10 rounded-lg border border-purple-500/20">
                  <div className="text-xs font-medium text-purple-700 dark:text-purple-300">Closed</div>
                  <div className="text-xl sm:text-2xl font-bold text-purple-900 dark:text-purple-100">
                    {stats?.statusBreakdown?.CLOSED ?? 0}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg font-semibold">
                Governance Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Link href="/admin/triage" className="block">
                <Button variant="outline" className="w-full justify-start text-left font-medium min-h-[3.25rem] h-auto py-2 px-3">
                  <AlertCircle className="w-4 h-4 mr-3 text-amber-600 shrink-0" />
                  <div className="min-w-0">
                    <div className="font-semibold text-sm">Resolve Triage Queue</div>
                    <div className="text-xs text-muted-foreground font-normal leading-tight">Assign unassigned issues</div>
                  </div>
                </Button>
              </Link>

              <Link href="/admin/users/pending" className="block">
                <Button variant="outline" className="w-full justify-start text-left font-medium min-h-[3.25rem] h-auto py-2 px-3">
                  <ShieldAlert className="w-4 h-4 mr-3 text-indigo-600 shrink-0" />
                  <div className="min-w-0">
                    <div className="font-semibold text-sm">Review Staff Approvals</div>
                    <div className="text-xs text-muted-foreground font-normal leading-tight">Authorize pending Google signups</div>
                  </div>
                </Button>
              </Link>

              <Link href="/admin/departments" className="block">
                <Button variant="outline" className="w-full justify-start text-left font-medium min-h-[3.25rem] h-auto py-2 px-3">
                  <Building2 className="w-4 h-4 mr-3 text-emerald-600 shrink-0" />
                  <div className="min-w-0">
                    <div className="font-semibold text-sm">Department Management</div>
                    <div className="text-xs text-muted-foreground font-normal leading-tight">Create and manage departments</div>
                  </div>
                </Button>
              </Link>

              <Link href="/admin/categories" className="block">
                <Button variant="outline" className="w-full justify-start text-left font-medium min-h-[3.25rem] h-auto py-2 px-3">
                  <FolderTree className="w-4 h-4 mr-3 text-purple-600 shrink-0" />
                  <div className="min-w-0">
                    <div className="font-semibold text-sm">Category Management</div>
                    <div className="text-xs text-muted-foreground font-normal leading-tight">Create and map complaint categories</div>
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
