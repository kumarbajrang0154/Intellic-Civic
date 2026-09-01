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
import { AppShell } from '@/components/layout/app-shell';
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
      // 1. Fetch current officer user profile
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

      // 2. Fetch complaints assigned to this officer
      const res = await fetch('/api/complaints?assignedToMe=true&limit=50');
      if (!res.ok) {
        throw new Error('Failed to load assigned complaints');
      }

      const data = await res.json();
      const list: AssignedComplaint[] = data.data || [];

      // Calculate stats
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
        return <Badge variant="warning">Assigned (Action Required)</Badge>;
      case 'IN_PROGRESS':
        return <Badge variant="default" className="bg-blue-600 hover:bg-blue-700">In Progress</Badge>;
      case 'RESOLVED':
        return <Badge variant="success">Resolved</Badge>;
      case 'CLOSED':
        return <Badge variant="outline">Closed</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'CRITICAL':
        return <Badge variant="destructive">Critical</Badge>;
      case 'HIGH':
        return <Badge variant="destructive" className="bg-orange-600 hover:bg-orange-700">High</Badge>;
      case 'MEDIUM':
        return <Badge variant="warning">Medium</Badge>;
      default:
        return <Badge variant="secondary">Low</Badge>;
    }
  };

  return (
    <AppShell user={user}>
      <div className="space-y-6">
        {/* Header */}
        <div className="border-b pb-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-primary mb-1">
              <UserCheck className="h-4 w-4" />
              <span>Officer Workstation</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Welcome back, {user.name}
            </h1>
            <p className="text-xs text-muted-foreground mt-1">
              Track and resolve citizen complaints assigned to you by your Department Head.
            </p>
          </div>

          <Link href="/officer/complaints">
            <Button size="sm" className="flex items-center gap-1.5 text-xs">
              <FileText className="h-4 w-4" />
              <span>View All Assigned Complaints</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-l-4 border-l-primary">
            <CardHeader className="p-4 pb-2">
              <CardDescription className="text-xs">Assigned to Me</CardDescription>
              <CardTitle className="text-2xl font-bold text-foreground">
                {loading ? <Skeleton className="h-8 w-16" /> : stats.totalAssigned}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                <FileText className="h-3 w-3" />
                Active workload count
              </span>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-amber-500">
            <CardHeader className="p-4 pb-2">
              <CardDescription className="text-xs font-medium text-amber-600 dark:text-amber-400">
                Needs Action (Assigned)
              </CardDescription>
              <CardTitle className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                {loading ? <Skeleton className="h-8 w-16" /> : stats.needsAction}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                <AlertTriangle className="h-3 w-3 text-amber-500" />
                Awaiting transition to In Progress
              </span>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-blue-500">
            <CardHeader className="p-4 pb-2">
              <CardDescription className="text-xs">In Progress</CardDescription>
              <CardTitle className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {loading ? <Skeleton className="h-8 w-16" /> : stats.inProgress}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Currently under field resolution
              </span>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-emerald-500">
            <CardHeader className="p-4 pb-2">
              <CardDescription className="text-xs">Resolved</CardDescription>
              <CardTitle className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                {loading ? <Skeleton className="h-8 w-16" /> : stats.resolved}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                Successfully completed tasks
              </span>
            </CardContent>
          </Card>
        </div>

        {/* Recent Workload Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold tracking-tight text-foreground">
              Recent Assigned Tasks
            </h2>
            <Link href="/officer/complaints" className="text-xs text-primary hover:underline">
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
            <Card className="border-dashed py-8 text-center">
              <CardContent className="flex flex-col items-center justify-center space-y-2">
                <CheckCircle2 className="h-8 w-8 text-muted-foreground" />
                <CardTitle className="text-base">No Pending Assignments</CardTitle>
                <CardDescription className="text-xs max-w-sm">
                  You currently have no active complaints assigned to you. Check back later or notify your Department Head.
                </CardDescription>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {recentComplaints.map((item) => (
                <Card
                  key={item.id}
                  className="hover:border-primary/50 transition-colors shadow-sm"
                >
                  <CardContent className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-bold text-primary">
                          {item.ticketId}
                        </span>
                        {getStatusBadge(item.status)}
                        {getPriorityBadge(item.priority)}
                        <Badge variant="outline" className="text-xs">
                          {item.category?.name || 'General Issue'}
                        </Badge>
                      </div>
                      <h3 className="font-semibold text-sm text-foreground">{item.title}</h3>
                      <p className="text-xs text-muted-foreground">
                        {item.location?.address || 'Location provided'} &bull; Submitted {new Date(item.createdAt).toLocaleDateString()}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 self-end md:self-center">
                      <Link href={`/officer/complaints/${item.id}`}>
                        <Button size="sm" variant="outline" className="text-xs flex items-center gap-1">
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
