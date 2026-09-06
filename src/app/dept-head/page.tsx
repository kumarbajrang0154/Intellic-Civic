'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  Building2,
  CheckCircle2,
  Clock,
  Sparkles,
  Users,
  AlertTriangle,
  FileText,
  ArrowRight,
  TrendingUp,
  ShieldAlert,
  ClipboardList,
} from 'lucide-react';
import { AppShell } from '@/components/shared/app-shell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { AICard } from '@/components/ui/ai-card';

interface Stats {
  total: number;
  pendingReview: number;
  inProgress: number;
  resolved: number;
  pendingAi: number;
  duplicates: number;
}

export default function DepartmentHeadDashboardPage() {
  const [user, setUser] = React.useState<{ name: string; role: 'DEPARTMENT_HEAD'; departmentId?: string }>({
    name: 'Department Head',
    role: 'DEPARTMENT_HEAD',
  });

  const [stats, setStats] = React.useState<Stats>({
    total: 0,
    pendingReview: 0,
    inProgress: 0,
    resolved: 0,
    pendingAi: 0,
    duplicates: 0,
  });
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    async function loadData() {
      try {
        const meRes = await fetch('/api/auth/me');
        if (meRes.ok) {
          const meData = await meRes.json();
          if (meData.user) {
            setUser({
              name: meData.user.name || 'Department Head',
              role: 'DEPARTMENT_HEAD',
              departmentId: meData.user.departmentId,
            });
          }
        }

        const [deptRes, aiRes] = await Promise.all([
          fetch('/api/complaints?limit=100'),
          fetch('/api/complaints?pendingAiConfirmation=true&limit=100'),
        ]);

        let deptComplaints: any[] = [];
        let aiComplaints: any[] = [];

        if (deptRes.ok) {
          const dData = await deptRes.json();
          deptComplaints = dData.data || [];
        }

        if (aiRes.ok) {
          const aData = await aiRes.json();
          aiComplaints = aData.data || [];
        }

        const pendingReview = deptComplaints.filter(
          (c) => c.status === 'PENDING_DEPT_REVIEW' || c.status === 'SUBMITTED',
        ).length;
        const inProgress = deptComplaints.filter((c) => c.status === 'IN_PROGRESS' || c.status === 'ASSIGNED').length;
        const resolved = deptComplaints.filter((c) => c.status === 'RESOLVED' || c.status === 'CLOSED').length;
        const duplicates = deptComplaints.filter((c) => c.status === 'DUPLICATE').length;

        setStats({
          total: deptComplaints.length,
          pendingReview,
          inProgress,
          resolved,
          pendingAi: aiComplaints.length,
          duplicates,
        });
      } catch (err) {
        console.error('Failed to load dashboard data', err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  return (
    <AppShell user={user}>
      <div className="space-y-6 p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="border-b border-slate-200 pb-4">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Department Head Command Center
          </h1>
          <p className="text-slate-500 text-xs mt-1">
            Manage municipal department queue, verify AI triage recommendations, and direct operational flow.
          </p>
        </div>

        {/* AI Action Alert Banner if pending suggestions exist */}
        {stats.pendingAi > 0 && (
          <AICard
            title={`${stats.pendingAi} AI Complaint Suggestion(s) Awaiting Confirmation`}
            subtitle="Gemini AI identified complaints likely belonging to your department (SUGGEST_ONLY tier)."
            badgeText="Action Required"
            variant="outline"
          >
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-1">
              <p className="text-xs text-slate-600 dark:text-slate-300">
                Review and confirm complaints automatically triaged by the AI engine before assigning field workers.
              </p>
              <Link href="/dept-head/ai-suggestions">
                <Button variant="ai" size="sm" className="whitespace-nowrap flex items-center gap-2 shrink-0">
                  Review AI Suggestions <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </AICard>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <Card className="shadow-xs border border-slate-200 bg-white rounded-xl">
            <CardContent className="p-4 space-y-1">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Total Queue
              </span>
              {loading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="text-2xl font-bold text-slate-900">{stats.total}</div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-xs border border-slate-200 bg-white rounded-xl border-l-4 border-l-amber-500">
            <CardContent className="p-4 space-y-1">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Pending Review
              </span>
              {loading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="text-2xl font-bold text-slate-900">
                  {stats.pendingReview}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-xs border border-slate-200 bg-white rounded-xl border-l-4 border-l-sky-600">
            <CardContent className="p-4 space-y-1">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                In Progress
              </span>
              {loading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="text-2xl font-bold text-slate-900">
                  {stats.inProgress}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-xs border border-slate-200 bg-white rounded-xl border-l-4 border-l-emerald-600">
            <CardContent className="p-4 space-y-1">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Resolved
              </span>
              {loading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="text-2xl font-bold text-slate-900">
                  {stats.resolved}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-xs border border-slate-200 bg-white rounded-xl border-l-4 border-l-indigo-600">
            <CardContent className="p-4 space-y-1">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                AI Suggestions
              </span>
              {loading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="text-2xl font-bold text-slate-900">{stats.pendingAi}</div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-xs border border-slate-200 bg-slate-50/50 rounded-xl">
            <CardContent className="p-4 space-y-1">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Duplicates
              </span>
              {loading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="text-2xl font-bold text-slate-600">{stats.duplicates}</div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Quick Access Modules */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
          <Card className="hover:shadow-md transition-shadow border border-slate-200 bg-white rounded-xl flex flex-col justify-between">
            <CardHeader className="p-5">
              <div className="h-10 w-10 rounded-lg bg-ic-blue/10 flex items-center justify-center text-ic-blue mb-2">
                <Building2 className="h-5 w-5" />
              </div>
              <CardTitle className="text-lg font-bold text-slate-900">Department Queue</CardTitle>
              <CardDescription className="text-xs text-slate-500">
                View table registry of active complaints assigned to your municipal department.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5 pt-0">
              <Link href="/dept-head/complaints">
                <Button className="w-full bg-ic-blue hover:bg-blue-700 text-white flex items-center justify-between">
                  Open Queue <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow border border-indigo-200 bg-white rounded-xl flex flex-col justify-between">
            <CardHeader className="p-5">
              <div className="h-10 w-10 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600 mb-2">
                <Sparkles className="h-5 w-5" />
              </div>
              <CardTitle className="text-lg font-bold text-slate-900">
                AI Suggestions ({stats.pendingAi})
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Review and confirm complaints triaged by Gemini AI for your department.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5 pt-0">
              <Link href="/dept-head/ai-suggestions">
                <Button variant="ai" className="w-full flex items-center justify-between">
                  Review Suggestions <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow border border-slate-200 bg-white rounded-xl flex flex-col justify-between">
            <CardHeader className="p-5">
              <div className="h-10 w-10 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600 mb-2">
                <Users className="h-5 w-5" />
              </div>
              <CardTitle className="text-lg font-bold text-slate-900">Team Roster</CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Manage department officers and field workers assigned to your jurisdiction.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5 pt-0">
              <Link href="/dept-head/team">
                <Button variant="outline" className="w-full border-slate-200 flex items-center justify-between">
                  View Team Roster <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}

