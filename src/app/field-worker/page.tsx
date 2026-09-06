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
import { AppShell } from '@/components/shared/app-shell';
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

  React.useEffect(() => {
    const interval = setInterval(() => {
      fetchData(true);
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

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
      return <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-purple-100 text-purple-800 border border-purple-300">Awaiting Officer Review</span>;
    }
    switch (complaint.status) {
      case 'ASSIGNED':
        return <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-amber-50 text-amber-700 border border-amber-200">Pending Start</span>;
      case 'IN_PROGRESS':
        return <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-sky-50 text-sky-700 border border-sky-200">Work In Progress</span>;
      case 'RESOLVED':
      case 'CLOSED':
        return <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">Completed &amp; Resolved</span>;
      default:
        return <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-slate-100 text-slate-700 border border-slate-200">{complaint.status}</span>;
    }
  };

  return (
    <AppShell user={user}>
      <div className="space-y-6 p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
              <Wrench className="h-6 w-6 text-ic-blue" />
              <span>Field Worker Task Portal</span>
            </h1>
            <p className="text-slate-500 text-xs mt-0.5">
              Inspect site tasks, capture Before/After evidence, and submit repairs for officer sign-off.
            </p>
          </div>

          {lastUpdated && (
            <span className="text-xs text-slate-400 flex items-center gap-1.5 self-end sm:self-center font-mono">
              <RefreshCw className="h-3.5 w-3.5 text-ic-blue animate-spin" />
              Live task queue (Updated {lastUpdated})
            </span>
          )}
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="shadow-xs border border-slate-200 bg-white rounded-xl border-l-4 border-l-amber-500">
            <CardHeader className="p-4 pb-2">
              <CardDescription className="text-xs font-semibold text-slate-500">
                Pending Start
              </CardDescription>
              <CardTitle className="text-2xl font-bold text-slate-900">
                {pendingStart}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 text-[11px] text-slate-500">
              Newly assigned tasks ready to initiate
            </CardContent>
          </Card>

          <Card className="shadow-xs border border-slate-200 bg-white rounded-xl border-l-4 border-l-sky-600">
            <CardHeader className="p-4 pb-2">
              <CardDescription className="text-xs font-semibold text-slate-500">
                In Progress
              </CardDescription>
              <CardTitle className="text-2xl font-bold text-slate-900">
                {activeWork}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 text-[11px] text-slate-500">
              Active repairs requiring evidence upload
            </CardContent>
          </Card>

          <Card className="shadow-xs border border-slate-200 bg-white rounded-xl border-l-4 border-l-purple-600">
            <CardHeader className="p-4 pb-2">
              <CardDescription className="text-xs font-semibold text-slate-500">
                Awaiting Officer Review
              </CardDescription>
              <CardTitle className="text-2xl font-bold text-slate-900">
                {awaitingReview}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 text-[11px] text-slate-500">
              Submitted repairs under inspection
            </CardContent>
          </Card>

          <Card className="shadow-xs border border-slate-200 bg-white rounded-xl border-l-4 border-l-emerald-600">
            <CardHeader className="p-4 pb-2">
              <CardDescription className="text-xs font-semibold text-slate-500">
                Completed
              </CardDescription>
              <CardTitle className="text-2xl font-bold text-slate-900">
                {completed}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 text-[11px] text-slate-500">
              Verified and closed municipal tickets
            </CardContent>
          </Card>
        </div>

        {/* Status Filter Bar */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-slate-200">
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
              className={`text-xs shrink-0 rounded-lg ${statusTab === tab.id ? 'bg-ic-blue text-white' : 'border-slate-200'}`}
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
          <Card className="p-6 text-center border-rose-200 bg-rose-50 text-rose-800 rounded-xl">
            <CardDescription className="text-xs font-semibold text-rose-800">{error}</CardDescription>
            <Button variant="outline" size="sm" onClick={() => fetchData()} className="mt-4 border-rose-200">
              Retry
            </Button>
          </Card>
        ) : filteredComplaints.length === 0 ? (
          <Card className="border-dashed py-16 text-center bg-white rounded-xl">
            <CardContent className="flex flex-col items-center justify-center space-y-3">
              <div className="h-12 w-12 rounded-full bg-ic-blue/10 flex items-center justify-center text-ic-blue">
                <Wrench className="h-6 w-6" />
              </div>
              <CardTitle className="text-base font-bold text-slate-800">No Tasks Found</CardTitle>
              <CardDescription className="text-xs text-slate-500 max-w-sm">
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
                  className="shadow-xs hover:shadow-md transition-shadow border border-slate-200 bg-white rounded-xl flex flex-col justify-between"
                >
                  <CardHeader className="p-4 pb-2">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="font-mono text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                        #{complaint.ticketId}
                      </span>
                      {getStatusBadge(complaint)}
                    </div>
                    <CardTitle className="text-base font-bold text-slate-900 line-clamp-1">
                      {complaint.title}
                    </CardTitle>
                  </CardHeader>

                  <CardContent className="p-4 pt-2 space-y-3 flex-1 flex flex-col justify-between">
                    <p className="text-xs text-slate-600 line-clamp-2">
                      {complaint.description}
                    </p>

                    {complaint.location?.address && (
                      <div className="flex items-start gap-1.5 text-xs text-slate-500">
                        <MapPin className="h-3.5 w-3.5 text-ic-blue shrink-0 mt-0.5" />
                        <span className="line-clamp-1">{complaint.location.address}</span>
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs">
                      <div className="flex items-center gap-2 text-slate-500 text-[11px]">
                        <Camera className="h-3.5 w-3.5 text-ic-blue" />
                        <span>
                          Before: <strong>{beforePhotos}</strong> | After: <strong>{afterPhotos}</strong>
                        </span>
                      </div>

                      <Link href={`/field-worker/complaints/${complaint.id}`}>
                        <Button size="sm" className="h-8 text-xs font-semibold gap-1 bg-ic-blue hover:bg-blue-700 text-white">
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

