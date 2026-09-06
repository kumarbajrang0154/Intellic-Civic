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
import { AppShell } from '@/components/shared/app-shell';
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

  // Search & Date Range Filters
  const [searchQuery, setSearchQuery] = React.useState('');
  const [debouncedSearch, setDebouncedSearch] = React.useState('');
  const [fromDate, setFromDate] = React.useState('');
  const [toDate, setToDate] = React.useState('');

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
        return <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-blue-50 text-blue-700 border border-blue-200">Submitted</span>;
      case 'PENDING_DEPT_REVIEW':
        return <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-amber-50 text-amber-700 border border-amber-200">Under Review</span>;
      case 'ASSIGNED':
        return <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-sky-50 text-sky-700 border border-sky-200">Assigned</span>;
      case 'IN_PROGRESS':
        return <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">In Progress</span>;
      case 'RESOLVED':
      case 'CLOSED':
        return <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">Resolved</span>;
      case 'REJECTED':
        return <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-rose-100 text-rose-800 border border-rose-300">Rejected</span>;
      default:
        return <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-slate-100 text-slate-700 border border-slate-200">{status}</span>;
    }
  };

  return (
    <AppShell user={user}>
      <div className="space-y-6 p-6 max-w-7xl mx-auto">
        {/* Profile Completion Alert */}
        {!user.isProfileComplete && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-amber-900">
            <div>
              <div className="font-bold text-sm">Your Citizen Profile is Incomplete</div>
              <div className="text-xs text-amber-700 mt-0.5">Please fill out your Full Name, Gmail, Address, and Profile Picture to get started.</div>
            </div>
            <Link href="/citizen/profile?firstTime=true">
              <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white text-xs shrink-0 font-medium">
                Complete Profile Now
              </Button>
            </Link>
          </div>
        )}

        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 break-words">
              Welcome to Citizen Portal
            </h1>
            <p className="text-slate-500 text-xs mt-1">
              Submit complaints, track real-time resolution progress, and view ticket history.
            </p>
          </div>
          <Link href="/citizen/complaints/new" className="w-full sm:w-auto">
            <Button className="flex items-center justify-center gap-2 w-full sm:w-auto bg-ic-blue hover:bg-blue-700 text-white font-medium">
              <PlusCircle className="h-4 w-4 shrink-0" />
              File New Complaint
            </Button>
          </Link>
        </div>

        {/* Filter & Search Controls Card */}
        <Card className="border border-slate-200 shadow-xs bg-white rounded-xl">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
                <Filter className="h-4 w-4 text-ic-blue" />
                <span>Search &amp; Filter Complaints</span>
              </div>

              {lastUpdated && (
                <span className="text-[11px] text-slate-400 flex items-center gap-1 font-mono">
                  <RefreshCw className="h-3 w-3 text-ic-blue animate-spin" />
                  Live (Updated {lastUpdated})
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
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

              <div className="space-y-0.5">
                <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">From Date</label>
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

              <div className="space-y-0.5">
                <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">To Date</label>
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
                  className="text-xs text-slate-500 hover:text-slate-900 h-7 gap-1"
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
          <Card className="p-6 text-center border-rose-200 bg-rose-50 text-rose-800 rounded-xl">
            <CardDescription className="text-xs font-semibold text-rose-800">{error}</CardDescription>
            <Button variant="outline" size="sm" onClick={() => fetchComplaints()} className="mt-4 border-rose-200">
              Retry
            </Button>
          </Card>
        ) : complaints.length === 0 ? (
          <Card className="border-dashed py-16 text-center bg-white rounded-xl">
            <CardContent className="flex flex-col items-center justify-center space-y-4">
              <div className="h-14 w-14 rounded-full bg-ic-blue/10 flex items-center justify-center text-ic-blue">
                <FileText className="h-7 w-7" />
              </div>
              <div className="space-y-1 max-w-sm">
                <CardTitle className="text-base font-bold text-slate-800">No Complaints Found</CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  {searchQuery || fromDate || toDate || statusFilter !== 'ALL'
                    ? 'No complaints match your active filter criteria. Try clearing search parameters.'
                    : "You haven't submitted any civic complaints yet. Click below to file your first report."}
                </CardDescription>
              </div>
              <Link href="/citizen/complaints/new">
                <Button size="sm" className="bg-ic-blue text-white font-medium">Submit Your First Complaint</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {complaints.map((complaint) => {
                return (
                  <Link
                    key={complaint.id}
                    href={`/citizen/complaints/${complaint.id}`}
                    className="block group"
                  >
                    <Card className="h-full hover:shadow-md transition-shadow border border-slate-200 bg-white rounded-xl hover:border-ic-blue/40 flex flex-col justify-between overflow-hidden">
                      <CardHeader className="p-5 pb-3">
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <span className="font-mono text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                            #{complaint.ticketId}
                          </span>
                          {getStatusBadge(complaint.status)}
                        </div>
                        <CardTitle className="text-base font-bold text-slate-900 line-clamp-1 group-hover:text-ic-blue transition-colors">
                          {complaint.title}
                        </CardTitle>
                      </CardHeader>

                      <CardContent className="p-5 pt-0 space-y-3 flex-1 flex flex-col justify-between">
                        <p className="text-xs text-slate-600 line-clamp-2">
                          {complaint.description}
                        </p>

                        <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs text-slate-500">
                          <div className="flex items-center gap-1.5">
                            <Calendar className="h-3.5 w-3.5 text-ic-blue" />
                            <span>
                              {new Date(complaint.createdAt).toLocaleDateString(undefined, {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })}
                            </span>
                          </div>

                          {complaint.category && (
                            <span className="bg-slate-50 border border-slate-200 px-2 py-0.5 rounded text-[11px] font-semibold text-slate-700">
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
              <div className="flex items-center justify-between pt-4 border-t border-slate-200">
                <span className="text-xs text-slate-500">
                  Page {page} of {totalPages}
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="border-slate-200 text-xs"
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className="border-slate-200 text-xs"
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

