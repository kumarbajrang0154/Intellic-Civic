'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  FileText,
  PlusCircle,
  Loader2,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Filter,
  ImageIcon,
} from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';

import { useRouter } from 'next/navigation';

interface Complaint {
  id: string;
  ticketId: string;
  title: string;
  description: string;
  status: string;
  createdAt: string;
  category?: { id: string; name: string } | null;
  location?: { address?: string } | null;
  evidence?: { imageUrl: string }[];
}

export default function CitizenDashboardPage() {
  const router = useRouter();

  const [user, setUser] = React.useState<{ name: string; role: 'CITIZEN'; isProfileComplete?: boolean }>({
    name: 'Citizen',
    role: 'CITIZEN',
    isProfileComplete: true,
  });

  const [complaints, setComplaints] = React.useState<Complaint[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Pagination & Filter state
  const [page, setPage] = React.useState(1);
  const [totalPages, setTotalPages] = React.useState(1);
  const [statusFilter, setStatusFilter] = React.useState<string>('ALL');

  React.useEffect(() => {
    async function loadUser() {
      try {
        const res = await fetch('/api/auth/me');
        if (res.ok) {
          const data = await res.json();
          if (data.user) {
            // Check if existing profile vs first-time/incomplete profile
            if (data.user.isProfileComplete === false) {
              router.push('/citizen/profile?firstTime=true');
              return;
            }
            setUser({
              name: data.user.name,
              role: 'CITIZEN',
              isProfileComplete: true,
            });
          }
        }
      } catch (err) {
        // Fallback to default
      }
    }
    loadUser();
  }, [router]);

  const fetchComplaints = React.useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      let queryUrl = `/api/complaints?page=${page}&limit=10`;
      if (statusFilter !== 'ALL') {
        if (statusFilter === 'ACTIVE') {
          // Client or backend query: for active, we filter client-side or fetch all
        } else if (statusFilter === 'RESOLVED') {
          queryUrl += `&status=RESOLVED`;
        }
      }

      const res = await fetch(queryUrl);
      if (!res.ok) {
        throw new Error('Failed to load complaints');
      }

      const responseData = await res.json();
      const rawData: Complaint[] = responseData.data || [];
      const meta = responseData.meta || { totalPages: 1 };

      setComplaints(rawData);
      setTotalPages(meta.totalPages || 1);
    } catch (err: any) {
      setError(err.message || 'Error loading complaints');
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  React.useEffect(() => {
    fetchComplaints();
  }, [fetchComplaints]);

  // Client-side status filtering helper
  const filteredComplaints = React.useMemo(() => {
    if (statusFilter === 'ACTIVE') {
      return complaints.filter(
        (c) => !['RESOLVED', 'CLOSED', 'REJECTED', 'DUPLICATE'].includes(c.status),
      );
    }
    if (statusFilter === 'RESOLVED') {
      return complaints.filter((c) => ['RESOLVED', 'CLOSED'].includes(c.status));
    }
    return complaints;
  }, [complaints, statusFilter]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'SUBMITTED':
      case 'AI_PROCESSING':
        return <Badge variant="info">Submitted</Badge>;
      case 'PENDING_DEPT_REVIEW':
        return <Badge variant="secondary">Under Review</Badge>;
      case 'ASSIGNED':
        return <Badge variant="outline">Assigned</Badge>;
      case 'IN_PROGRESS':
        return <Badge variant="warning">In Progress</Badge>;
      case 'RESOLVED':
      case 'CLOSED':
        return <Badge variant="success">Resolved</Badge>;
      case 'REJECTED':
        return <Badge variant="destructive" className="font-bold">Rejected</Badge>;
      case 'DUPLICATE':
        return <Badge variant="secondary">Duplicate</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <AppShell user={user}>
      <div className="space-y-6">
        {/* Profile Completion Alert */}
        {!user.isProfileComplete && (
          <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-amber-900 dark:text-amber-200">
            <div>
              <div className="font-semibold text-sm">Your Citizen Profile is Incomplete</div>
              <div className="text-xs text-muted-foreground mt-0.5">Please fill out your Full Name, Gmail, Address, and Profile Picture to get started.</div>
            </div>
            <Link href="/citizen/profile?firstTime=true">
              <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white text-xs shrink-0">
                Complete Profile Now
              </Button>
            </Link>
          </div>
        )}
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b pb-5">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground break-words">
              Welcome to Citizen Portal
            </h1>
            <p className="text-muted-foreground text-xs sm:text-sm mt-1">
              Submit complaints, track real-time resolution progress, and view ticket history.
            </p>
          </div>
          <Link href="/citizen/complaints/new" className="w-full sm:w-auto">
            <Button className="flex items-center justify-center gap-2 w-full sm:w-auto">
              <PlusCircle className="h-4 w-4 shrink-0" />
              File New Complaint
            </Button>
          </Link>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card p-3.5 sm:p-4 rounded-xl border shadow-sm">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Filter className="h-4 w-4 text-primary shrink-0" />
            <span>Filter Complaints:</span>
          </div>

          <div className="w-full sm:w-48">
            <Select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="text-xs"
            >
              <option value="ALL">All Complaints</option>
              <option value="ACTIVE">Active / In Progress</option>
              <option value="RESOLVED">Resolved / Closed</option>
            </Select>
          </div>
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
            <Button variant="outline" size="sm" onClick={fetchComplaints} className="mt-4">
              Retry
            </Button>
          </Card>
        ) : filteredComplaints.length === 0 ? (
          /* Empty State */
          <Card className="border-dashed py-12 text-center">
            <CardContent className="flex flex-col items-center justify-center space-y-4">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <FileText className="h-8 w-8" />
              </div>
              <div className="space-y-1 max-w-sm">
                <CardTitle className="text-xl">No Complaints Found</CardTitle>
                <CardDescription>
                  {statusFilter === 'ALL'
                    ? "You haven't submitted any civic complaints yet. Click below to file your first report."
                    : 'No complaints match the selected status filter.'}
                </CardDescription>
              </div>
              <Link href="/citizen/complaints/new">
                <Button size="sm">Submit Your First Complaint</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          /* Complaint Cards Grid */
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredComplaints.map((complaint) => {
                const firstImage = complaint.evidence?.[0]?.imageUrl;

                return (
                  <Link
                    key={complaint.id}
                    href={`/citizen/complaints/${complaint.id}`}
                    className="block group"
                  >
                    <Card className="h-full hover:shadow-md transition-shadow border-muted hover:border-primary/30 flex flex-col justify-between overflow-hidden">
                      <CardHeader className="p-5 pb-3">
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <span className="font-mono text-xs font-semibold text-primary">
                            {complaint.ticketId}
                          </span>
                          {getStatusBadge(complaint.status)}
                        </div>
                        <CardTitle className="text-base font-bold text-foreground line-clamp-1 group-hover:text-primary transition-colors">
                          {complaint.title}
                        </CardTitle>
                      </CardHeader>

                      <CardContent className="p-5 pt-0 space-y-3 flex-1 flex flex-col justify-between">
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {complaint.description}
                        </p>

                        <div className="flex items-center justify-between pt-3 border-t text-xs text-muted-foreground">
                          <div className="flex items-center gap-1.5">
                            <Calendar className="h-3.5 w-3.5" />
                            <span>
                              {new Date(complaint.createdAt).toLocaleDateString(undefined, {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })}
                            </span>
                          </div>

                          {complaint.category && (
                            <span className="bg-muted px-2 py-0.5 rounded text-[11px] font-medium text-foreground">
                              {complaint.category.name}
                            </span>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-4 border-t">
                <span className="text-xs text-muted-foreground">
                  Page {page} of {totalPages}
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  >
                    Next
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
