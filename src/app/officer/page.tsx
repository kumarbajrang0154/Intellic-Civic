'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Building2,
  CheckCircle2,
  Clock,
  FileText,
  AlertTriangle,
  ArrowRight,
  ShieldAlert,
  Loader2,
  UserCheck,
} from 'lucide-react';
import { AppShell } from '@/components/shared/app-shell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

interface AssignedComplaint {
  id: string;
  ticketId: string;
  title: string;
  status: string;
  priority: string;
  createdAt: string;
  category?: { name: string };
  location?: { address?: string };
}

export default function OfficerDashboardPage() {
  const router = useRouter();

  const [user, setUser] = React.useState<{
    name: string;
    role: 'DEPARTMENT_OFFICER';
    departmentId?: string;
    email?: string;
  }>({
    name: 'Department Officer',
    role: 'DEPARTMENT_OFFICER',
  });

  const [stats, setStats] = React.useState({
    totalAssigned: 0,
    needsAction: 0,
    inProgress: 0,
    resolved: 0,
  });

  const [recentComplaints, setRecentComplaints] = React.useState<AssignedComplaint[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const fetchDashboardData = React.useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const meRes = await fetch('/api/auth/me');
      if (meRes.ok) {
        const meData = await meRes.json();
        if (meData.user) {
          setUser({
            name: meData.user.name || 'Department Officer',
            role: 'DEPARTMENT_OFFICER',
            departmentId: meData.user.departmentId,
            email: meData.user.email,
          });
        }
      }

      const res = await fetch('/api/complaints?assignedToMe=true&limit=50');
      if (!res.ok) {
        throw new Error('Failed to load assigned complaints');
      }

      const data = await res.json();
      const list: AssignedComplaint[] = data.data || [];

      const totalAssigned = list.length;
      const needsAction = list.filter((c) => c.status === 'ASSIGNED').length;
      const inProgress = list.filter((c) => c.status === 'IN_PROGRESS').length;
      const resolved = list.filter((c) => c.status === 'RESOLVED' || c.status === 'CLOSED').length;

      setStats({ totalAssigned, needsAction, inProgress, resolved });
      setRecentComplaints(list.slice(0, 5));
    } catch (err: any) {
      setError(err.message || 'Error loading officer dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ASSIGNED':
        return <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-amber-50 text-amber-700 border border-amber-200">Assigned</span>;
      case 'IN_PROGRESS':
        return <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-sky-50 text-sky-700 border border-sky-200">In Progress</span>;
      case 'RESOLVED':
        return <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">Resolved</span>;
      case 'CLOSED':
        return <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-slate-100 text-slate-700 border border-slate-200">Closed</span>;
      default:
        return <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-slate-100 text-slate-700 border border-slate-200">{status}</span>;
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'CRITICAL':
      case 'EMERGENCY':
        return <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-rose-100 text-rose-800 border border-rose-300">EMERGENCY</span>;
      case 'HIGH':
        return <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-amber-100 text-amber-800 border border-amber-300">HIGH</span>;
      case 'MEDIUM':
        return <span className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-blue-100 text-blue-800 border border-blue-300">MEDIUM</span>;
      default:
        return <span className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-slate-100 text-slate-700 border border-slate-300">LOW</span>;
    }
  };

  return (
    <AppShell user={user}>
      <div className="space-y-6 p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="border-b border-slate-200 pb-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-ic-blue mb-1">
              <UserCheck className="h-4 w-4" />
              <span>Officer Workstation</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Welcome back, {user.name}
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Track and resolve citizen complaints assigned to you by your Department Head.
            </p>
          </div>

          <Link href="/officer/complaints">
            <Button size="sm" className="bg-ic-blue hover:bg-blue-700 text-white flex items-center gap-1.5 text-xs">
              <FileText className="h-4 w-4" />
              <span>View All Assigned Tasks</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border border-slate-200 bg-white rounded-xl shadow-xs">
            <CardHeader className="p-4 pb-2">
              <CardDescription className="text-xs text-slate-500 font-medium">Assigned to Me</CardDescription>
              <CardTitle className="text-2xl font-bold text-slate-900">
                {loading ? <Skeleton className="h-8 w-16" /> : stats.totalAssigned}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <span className="text-[11px] text-slate-400 flex items-center gap-1">
                <FileText className="h-3 w-3" />
                Active workload count
              </span>
            </CardContent>
          </Card>

          <Card className="border border-slate-200 bg-white rounded-xl shadow-xs border-l-4 border-l-amber-500">
            <CardHeader className="p-4 pb-2">
              <CardDescription className="text-xs font-semibold text-slate-500">
                Needs Action (Assigned)
              </CardDescription>
              <CardTitle className="text-2xl font-bold text-slate-900">
                {loading ? <Skeleton className="h-8 w-16" /> : stats.needsAction}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <span className="text-[11px] text-slate-500 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3 text-amber-500" />
                Awaiting transition to In Progress
              </span>
            </CardContent>
          </Card>

          <Card className="border border-slate-200 bg-white rounded-xl shadow-xs border-l-4 border-l-sky-600">
            <CardHeader className="p-4 pb-2">
              <CardDescription className="text-xs font-semibold text-slate-500">In Progress</CardDescription>
              <CardTitle className="text-2xl font-bold text-slate-900">
                {loading ? <Skeleton className="h-8 w-16" /> : stats.inProgress}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <span className="text-[11px] text-slate-500 flex items-center gap-1">
                <Clock className="h-3 w-3 text-sky-600" />
                Currently under field resolution
              </span>
            </CardContent>
          </Card>

          <Card className="border border-slate-200 bg-white rounded-xl shadow-xs border-l-4 border-l-emerald-600">
            <CardHeader className="p-4 pb-2">
              <CardDescription className="text-xs font-semibold text-slate-500">Resolved</CardDescription>
              <CardTitle className="text-2xl font-bold text-slate-900">
                {loading ? <Skeleton className="h-8 w-16" /> : stats.resolved}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <span className="text-[11px] text-slate-500 flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                Successfully completed tasks
              </span>
            </CardContent>
          </Card>
        </div>

        {/* Recent Workload Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold tracking-tight text-slate-900">
              Recent Assigned Tasks
            </h2>
            <Link href="/officer/complaints" className="text-xs text-ic-blue font-semibold hover:underline">
              View all tasks &rarr;
            </Link>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((n) => (
                <Card key={n} className="p-4 space-y-2">
                  <Skeleton className="h-5 w-1/3" />
                  <Skeleton className="h-4 w-full" />
                </Card>
              ))}
            </div>
          ) : recentComplaints.length === 0 ? (
            <Card className="border-dashed py-12 text-center bg-white rounded-xl">
              <CardContent className="flex flex-col items-center justify-center space-y-2">
                <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                <CardTitle className="text-base font-bold text-slate-800">No Pending Assignments</CardTitle>
                <CardDescription className="text-xs text-slate-500 max-w-sm">
                  You currently have no active complaints assigned to you. Check back later or notify your Department Head.
                </CardDescription>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {recentComplaints.map((item) => (
                <Card
                  key={item.id}
                  className="hover:border-ic-blue/40 transition-colors shadow-xs bg-white rounded-xl border border-slate-200"
                >
                  <CardContent className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                          #{item.ticketId}
                        </span>
                        {getStatusBadge(item.status)}
                        {getPriorityBadge(item.priority)}
                        <span className="text-xs font-medium text-slate-500 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                          {item.category?.name || 'General Issue'}
                        </span>
                      </div>
                      <h3 className="font-semibold text-sm text-slate-900">{item.title}</h3>
                      <p className="text-xs text-slate-500">
                        {item.location?.address || 'Location provided'} &bull; Submitted {new Date(item.createdAt).toLocaleDateString()}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 self-end md:self-center">
                      <Link href={`/officer/complaints/${item.id}`}>
                        <Button size="sm" variant="outline" className="text-xs flex items-center gap-1 border-slate-200">
                          <span>Work on Complaint</span>
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}

