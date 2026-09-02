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
  Search,
  RefreshCw,
  X,
} from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
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
  const [lastUpdated, setLastUpdated] = React.useState<string | null>(null);

  // Pagination & Filter state
  const [page, setPage] = React.useState(1);
  const [totalPages, setTotalPages] = React.useState(1);
  const [statusFilter, setStatusFilter] = React.useState<string>('ALL');

  // Batch D — Search & Date Range Filters
  const [searchQuery, setSearchQuery] = React.useState('');
  const [debouncedSearch, setDebouncedSearch] = React.useState('');
  const [fromDate, setFromDate] = React.useState('');
  const [toDate, setToDate] = React.useState('');

  // Debounce search query input (300ms)
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  React.useEffect(() => {
    async function loadUser() {
      try {
        const res = await fetch('/api/auth/me');
        if (res.ok) {
          const data = await res.json();
          if (data.user) {
            if (data.user.isProfileComplete === false) {
              window.location.href = '/citizen/profile?firstTime=true';
              return;
            }
            setUser({
              name: data.user.name,
              role: 'CITIZEN',
              isProfileComplete: true,
            });
          }
        }
      } catch (err) {}
    }
    loadUser();
  }, [router]);

  const fetchComplaints = React.useCallback(
    async (isBackground = false) => {
      if (!isBackground) setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({
          page: String(page),
          limit: '10',
          ...(statusFilter !== 'ALL' && { status: statusFilter }),
          ...(debouncedSearch.trim() && { search: debouncedSearch.trim() }),
          ...(fromDate && { fromDate }),
          ...(toDate && { toDate }),
        });

        const res = await fetch(`/api/complaints?${params.toString()}`);
        if (!res.ok) {
          throw new Error('Failed to load complaints');
        }

        const responseData = await res.json();
        const rawData: Complaint[] = responseData.data || [];
        const meta = responseData.meta || { totalPages: 1 };

        setComplaints(rawData);
        setTotalPages(meta.totalPages || 1);
        setLastUpdated(new Date().toLocaleTimeString());
      } catch (err: any) {
        if (!isBackground) setError(err.message || 'Error loading complaints');
      } finally {
        if (!isBackground) setLoading(false);
      }
    },
    [page, statusFilter, debouncedSearch, fromDate, toDate],
  );

  React.useEffect(() => {
    fetchComplaints();
  }, [fetchComplaints]);

  // Batch D — 30-Second Polling Fallback for Dashboard Status Updates
  React.useEffect(() => {
    const interval = setInterval(() => {
      fetchComplaints(true);
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchComplaints]);

  const clearFilters = () => {
    setSearchQuery('');
    setDebouncedSearch('');
    setFromDate('');
    setToDate('');
    setStatusFilter('ALL');
    setPage(1);
  };

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

        {/* Batch D — Filter & Search Controls Card */}
        <Card className="border shadow-sm">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-bold text-foreground">
                <Filter className="h-4 w-4 text-primary" />
                <span>Search &amp; Filter Complaints</span>
              </div>

              {lastUpdated && (
                <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <RefreshCw className="h-3 w-3 text-primary animate-spin" />
                  Live (Updated {lastUpdated})
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Search Keyword Input */}
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search title or ID..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setPage(1);
                  }}
                  className="pl-9 text-xs"
                />
              </div>

              {/* Status Select */}
              <Select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                className="text-xs"
              >
                <option value="ALL">All Statuses</option>
                <option value="SUBMITTED">Submitted</option>
                <option value="PENDING_DEPT_REVIEW">Under Review</option>
                <option value="ASSIGNED">Assigned</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="RESOLVED">Resolved</option>
                <option value="CLOSED">Closed</option>
                <option value="REJECTED">Rejected</option>
                <option value="DUPLICATE">Duplicate</option>
              </Select>

              {/* From Date Picker */}
              <div className="space-y-0.5">
                <label className="text-[10px] font-semibold text-muted-foreground uppercase">From Date</label>
                <Input
                  type="date"
                  value={fromDate}
                  onChange={(e) => {
                    setFromDate(e.target.value);
                    setPage(1);
                  }}
                  className="text-xs h-9"
                />
              </div>

              {/* To Date Picker */}
              <div className="space-y-0.5">
                <label className="text-[10px] font-semibold text-muted-foreground uppercase">To Date</label>
                <Input
                  type="date"
                  value={toDate}
                  onChange={(e) => {
                    setToDate(e.target.value);
                    setPage(1);
                  }}
                  className="text-xs h-9"
                />
              </div>
            </div>

            {(searchQuery || fromDate || toDate || statusFilter !== 'ALL') && (
              <div className="flex justify-end pt-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                  className="text-xs text-muted-foreground hover:text-foreground h-7 gap-1"
                >
                  <X className="h-3 w-3" />
                  Clear All Filters
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

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
            <Button variant="outline" size="sm" onClick={() => fetchComplaints()} className="mt-4">
              Retry
            </Button>
          </Card>
        ) : complaints.length === 0 ? (
          /* Empty State */
          <Card className="border-dashed py-12 text-center">
            <CardContent className="flex flex-col items-center justify-center space-y-4">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <FileText className="h-8 w-8" />
              </div>
              <div className="space-y-1 max-w-sm">
                <CardTitle className="text-xl">No Complaints Found</CardTitle>
                <CardDescription>
                  {searchQuery || fromDate || toDate || statusFilter !== 'ALL'
                    ? 'No complaints match your active filter criteria. Try clearing search parameters.'
                    : "You haven't submitted any civic complaints yet. Click below to file your first report."}
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
              {complaints.map((complaint) => {
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
