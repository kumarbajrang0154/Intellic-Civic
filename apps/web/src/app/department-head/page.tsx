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
} from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

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
      <div className="space-y-6">
        {/* Header */}
        <div className="border-b pb-4">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Department Head Command Center
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage department queue, review AI triage recommendations, and assign complaints to officers.
          </p>
        </div>

        {/* AI Action Alert Banner if pending suggestions exist */}
        {stats.pendingAi > 0 && (
          <div className="p-4 rounded-xl bg-primary/10 border border-primary/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-primary">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm">
                  {stats.pendingAi} AI Complaint Suggestion(s) Awaiting Confirmation
                </h3>
                <p className="text-xs text-muted-foreground">
                  Gemini AI identified complaints likely belonging to your department (SUGGEST_ONLY tier).
                </p>
              </div>
            </div>
            <Link href="/department-head/ai-suggestions">
              <Button size="sm" className="whitespace-nowrap flex items-center gap-1.5">
                Review Suggestions <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <Card className="shadow-sm">
            <CardContent className="p-4 space-y-1">
              <span className="text-xs font-semibold text-muted-foreground uppercase">
                Total Queue
              </span>
              {loading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="text-2xl font-bold text-foreground">{stats.total}</div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardContent className="p-4 space-y-1">
              <span className="text-xs font-semibold text-sky-600 dark:text-sky-400 uppercase">
                Pending Review
              </span>
              {loading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="text-2xl font-bold text-sky-600 dark:text-sky-400">
                  {stats.pendingReview}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardContent className="p-4 space-y-1">
              <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase">
                In Progress
              </span>
              {loading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                  {stats.inProgress}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardContent className="p-4 space-y-1">
              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase">
                Resolved
              </span>
              {loading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                  {stats.resolved}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-sm border-primary/30 bg-primary/5">
            <CardContent className="p-4 space-y-1">
              <span className="text-xs font-semibold text-primary uppercase">
                AI Suggestions
              </span>
              {loading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="text-2xl font-bold text-primary">{stats.pendingAi}</div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardContent className="p-4 space-y-1">
              <span className="text-xs font-semibold text-muted-foreground uppercase">
                Duplicates
              </span>
              {loading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="text-2xl font-bold text-muted-foreground">{stats.duplicates}</div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Quick Access Modules */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
          <Card className="hover:shadow-md transition-shadow border-muted hover:border-primary/30 flex flex-col justify-between">
            <CardHeader>
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary mb-2">
                <Building2 className="h-6 w-6" />
              </div>
              <CardTitle className="text-xl">Department Queue</CardTitle>
              <CardDescription>
                View dense table queue of all active complaints assigned to your department.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/department-head/complaints">
                <Button className="w-full flex items-center justify-between">
                  Open Queue <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow border-muted hover:border-primary/30 flex flex-col justify-between">
            <CardHeader>
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary mb-2">
                <Sparkles className="h-6 w-6" />
              </div>
              <CardTitle className="text-xl">AI Suggestions ({stats.pendingAi})</CardTitle>
              <CardDescription>
                Review and confirm complaints suggested by Gemini AI for your department.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/department-head/ai-suggestions">
                <Button variant="outline" className="w-full flex items-center justify-between">
                  Review Suggestions <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow border-muted hover:border-primary/30 flex flex-col justify-between">
            <CardHeader>
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary mb-2">
                <Users className="h-6 w-6" />
              </div>
              <CardTitle className="text-xl">Team Roster</CardTitle>
              <CardDescription>
                View officers and active field workers belonging to your department.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/department-head/team">
                <Button variant="outline" className="w-full flex items-center justify-between">
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
