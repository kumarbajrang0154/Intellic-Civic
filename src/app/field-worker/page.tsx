'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Wrench,
  CheckCircle2,
  Clock,
  FileText,
  AlertTriangle,
  ArrowRight,
  Loader2,
  MapPin,
  Camera,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

interface FieldWorkerComplaint {
  id: string;
  ticketId: string;
  title: string;
  description: string;
  status: string;
  priority?: string;
  createdAt: string;
  updatedAt: string;
  readyForReview?: boolean;
  category?: { name: string };
  location?: { address?: string };
  evidence?: { stage: string }[];
}

export default function FieldWorkerDashboardPage() {
  const router = useRouter();

  const [user, setUser] = React.useState<{
    name: string;
    role: 'FIELD_WORKER';
    departmentId?: string;
    email?: string;
  }>({
    name: 'Field Worker',
    role: 'FIELD_WORKER',
  });

  const [complaints, setComplaints] = React.useState<FieldWorkerComplaint[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [statusTab, setStatusTab] = React.useState<'ACTIVE' | 'ASSIGNED' | 'IN_PROGRESS' | 'REVIEW' | 'ALL'>('ACTIVE');
  const [lastUpdated, setLastUpdated] = React.useState<string | null>(null);

  const fetchData = React.useCallback(async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    setError(null);

    try {
      // 1. Get field worker user profile
      const meRes = await fetch('/api/auth/me');
      if (meRes.ok) {
        const meData = await meRes.json();
        if (meData.user) {
          setUser({
            name: meData.user.name || 'Field Worker',
            role: 'FIELD_WORKER',
            departmentId: meData.user.departmentId,
            email: meData.user.email,
          });
        }
      }

      // 2. Fetch complaints assigned to this field worker
      const res = await fetch('/api/field-worker/complaints?status=ALL&limit=100');
      if (!res.ok) {
        throw new Error('Failed to load assigned field complaints');
      }

      const responseData = await res.json();
      setComplaints(responseData.data || []);
      setLastUpdated(new Date().toLocaleTimeString());
    } catch (err: any) {
      if (!isBackground) setError(err.message || 'Error loading dashboard');
    } finally {
      if (!isBackground) setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 30s Polling
  React.useEffect(() => {
    const interval = setInterval(() => {
      fetchData(true);
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Computed counts
  const totalAssigned = complaints.length;
  const pendingStart = complaints.filter((c) => c.status === 'ASSIGNED').length;
  const activeWork = complaints.filter((c) => c.status === 'IN_PROGRESS' && !c.readyForReview).length;
  const awaitingReview = complaints.filter((c) => c.readyForReview).length;
  const completed = complaints.filter((c) => ['RESOLVED', 'CLOSED'].includes(c.status)).length;

  const filteredComplaints = complaints.filter((c) => {
    if (statusTab === 'ACTIVE') return ['ASSIGNED', 'IN_PROGRESS'].includes(c.status) && !c.readyForReview;
    if (statusTab === 'ASSIGNED') return c.status === 'ASSIGNED';
    if (statusTab === 'IN_PROGRESS') return c.status === 'IN_PROGRESS' && !c.readyForReview;
    if (statusTab === 'REVIEW') return Boolean(c.readyForReview);
    return true;
  });

  const getStatusBadge = (complaint: FieldWorkerComplaint) => {
    if (complaint.readyForReview) {
      return <Badge variant="warning" className="font-bold">Awaiting Officer Review</Badge>;
    }
    switch (complaint.status) {
      case 'ASSIGNED':
        return <Badge variant="outline" className="border-amber-500 text-amber-700 bg-amber-50">Pending Start</Badge>;
      case 'IN_PROGRESS':
        return <Badge variant="info">Work In Progress</Badge>;
      case 'RESOLVED':
      case 'CLOSED':
        return <Badge variant="success">Completed &amp; Resolved</Badge>;
      default:
        return <Badge variant="secondary">{complaint.status}</Badge>;
    }
  };

  return (
    <AppShell user={user}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b pb-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <Wrench className="h-7 w-7 text-primary" />
              <span>Field Worker Task Portal</span>
            </h1>
            <p className="text-muted-foreground text-xs sm:text-sm mt-0.5">
              Inspect site tasks, capture Before/After evidence, and submit repairs for officer sign-off.
            </p>
          </div>

          {lastUpdated && (
            <span className="text-xs text-muted-foreground flex items-center gap-1.5 self-end sm:self-center">
              <RefreshCw className="h-3.5 w-3.5 text-primary animate-spin" />
              Live task queue (Updated {lastUpdated})
            </span>
          )}
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="shadow-sm border-amber-500/30 bg-amber-500/5">
            <CardHeader className="p-4 pb-2">
              <CardDescription className="text-xs font-semibold text-amber-800 dark:text-amber-300">
                Pending Start
              </CardDescription>
              <CardTitle className="text-2xl font-black text-amber-900 dark:text-amber-100">
                {pendingStart}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 text-[11px] text-muted-foreground">
              Newly assigned tasks ready to initiate
            </CardContent>
          </Card>

          <Card className="shadow-sm border-blue-500/30 bg-blue-500/5">
            <CardHeader className="p-4 pb-2">
              <CardDescription className="text-xs font-semibold text-blue-800 dark:text-blue-300">
                In Progress
              </CardDescription>
              <CardTitle className="text-2xl font-black text-blue-900 dark:text-blue-100">
                {activeWork}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 text-[11px] text-muted-foreground">
              Active repairs requiring evidence upload
            </CardContent>
          </Card>

          <Card className="shadow-sm border-purple-500/30 bg-purple-500/5">
            <CardHeader className="p-4 pb-2">
              <CardDescription className="text-xs font-semibold text-purple-800 dark:text-purple-300">
                Awaiting Officer Review
              </CardDescription>
              <CardTitle className="text-2xl font-black text-purple-900 dark:text-purple-100">
                {awaitingReview}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 text-[11px] text-muted-foreground">
              Submitted repairs under inspection
            </CardContent>
          </Card>

          <Card className="shadow-sm border-emerald-500/30 bg-emerald-500/5">
            <CardHeader className="p-4 pb-2">
              <CardDescription className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                Completed
              </CardDescription>
              <CardTitle className="text-2xl font-black text-emerald-900 dark:text-emerald-100">
                {completed}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 text-[11px] text-muted-foreground">
              Verified and closed municipal tickets
            </CardContent>
          </Card>
        </div>

        {/* Status Filter Bar */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b">
          {[
            { id: 'ACTIVE', label: `Active Work (${pendingStart + activeWork})` },
            { id: 'ASSIGNED', label: `Pending Start (${pendingStart})` },
            { id: 'IN_PROGRESS', label: `In Progress (${activeWork})` },
            { id: 'REVIEW', label: `Submitted Review (${awaitingReview})` },
            { id: 'ALL', label: `All Tasks (${totalAssigned})` },
          ].map((tab) => (
            <Button
              key={tab.id}
              variant={statusTab === tab.id ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusTab(tab.id as any)}
              className="text-xs shrink-0"
            >
              {tab.label}
            </Button>
          ))}
        </div>

        {/* Content Area */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((n) => (
              <Card key={n} className="p-4 space-y-3">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </Card>
            ))}
          </div>
        ) : error ? (
          <Card className="p-6 text-center border-destructive/20 bg-destructive/5">
            <CardDescription className="text-destructive font-medium">{error}</CardDescription>
            <Button variant="outline" size="sm" onClick={() => fetchData()} className="mt-4">
              Retry
            </Button>
          </Card>
        ) : filteredComplaints.length === 0 ? (
          <Card className="border-dashed py-12 text-center">
            <CardContent className="flex flex-col items-center justify-center space-y-3">
              <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <Wrench className="h-7 w-7" />
              </div>
              <CardTitle className="text-lg">No Tasks Found</CardTitle>
              <CardDescription className="text-xs max-w-sm">
                There are currently no complaints matching this filter assigned to your account.
              </CardDescription>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredComplaints.map((complaint) => {
              const beforePhotos = complaint.evidence?.filter((e) => e.stage === 'BEFORE').length || 0;
              const afterPhotos = complaint.evidence?.filter((e) => e.stage === 'AFTER').length || 0;

              return (
                <Card
                  key={complaint.id}
                  className="shadow-sm hover:shadow-md transition-shadow border-muted flex flex-col justify-between"
                >
                  <CardHeader className="p-4 pb-2">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="font-mono text-xs font-bold text-primary">
                        {complaint.ticketId}
                      </span>
                      {getStatusBadge(complaint)}
                    </div>
                    <CardTitle className="text-base font-bold text-foreground line-clamp-1">
                      {complaint.title}
                    </CardTitle>
                  </CardHeader>

                  <CardContent className="p-4 pt-2 space-y-3 flex-1 flex flex-col justify-between">
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {complaint.description}
                    </p>

                    {complaint.location?.address && (
                      <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                        <span className="line-clamp-1">{complaint.location.address}</span>
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-3 border-t text-xs">
                      <div className="flex items-center gap-2 text-muted-foreground text-[11px]">
                        <Camera className="h-3.5 w-3.5 text-primary" />
                        <span>
                          Before: <strong>{beforePhotos}</strong> | After: <strong>{afterPhotos}</strong>
                        </span>
                      </div>

                      <Link href={`/field-worker/complaints/${complaint.id}`}>
                        <Button size="sm" className="h-8 text-xs font-semibold gap-1">
                          <span>{complaint.status === 'ASSIGNED' ? 'Start Work' : 'View & Work'}</span>
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
