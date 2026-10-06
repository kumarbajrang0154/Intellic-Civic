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
  WifiOff,
  Trash2,
  Clock,
  AlertTriangle,
} from 'lucide-react';
import { AppShell } from '@/components/shared/app-shell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

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

  const [user, setUser] = React.useState<{ id?: string; name: string; role: 'CITIZEN'; isProfileComplete?: boolean }>({
    name: 'Citizen',
    role: 'CITIZEN',
    isProfileComplete: true,
  });

  const [complaints, setComplaints] = React.useState<Complaint[]>([]);
  const [drafts, setDrafts] = React.useState<any[]>([]);
  const [syncingDraftId, setSyncingDraftId] = React.useState<string | null>(null);
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

  const loadDrafts = React.useCallback(async () => {
    try {
      const { getDrafts } = await import('@/lib/offline-queue');
      const allDrafts = await getDrafts(user.id);
      setDrafts(allDrafts);
    } catch {
      setDrafts([]);
    }
  }, [user.id]);

  React.useEffect(() => {
    loadDrafts();

    const runSync = async () => {
      if (typeof navigator !== 'undefined' && navigator.onLine) {
        const { syncDrafts } = await import('@/lib/offline-queue');
        await syncDrafts(user.id || '');
        await loadDrafts();
        fetchComplaints(true);
      }
    };

    // Auto-sync on initial mount if online
    runSync();

    const handleDraftsChanged = () => loadDrafts();
    const handleDraftSynced = (e: any) => {
      loadDrafts();
      fetchComplaints(true);
      toast.success(`Complaint synced successfully! Ticket #${e.detail?.ticketId || ''}`);
    };
    const handleAuthRequired = () => {
      loadDrafts();
      toast.error('Session expired - log in to sync');
    };

    const handleOnline = () => runSync();
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        runSync();
      }
    };

    // 30s retry timer while drafts are pending/failed and online
    const intervalTimer = setInterval(() => {
      runSync();
    }, 30000);

    window.addEventListener('intellicivic:drafts-changed', handleDraftsChanged);
    window.addEventListener('intellicivic:draft-synced', handleDraftSynced);
    window.addEventListener('intellicivic:auth-required', handleAuthRequired);
    window.addEventListener('online', handleOnline);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(intervalTimer);
      window.removeEventListener('intellicivic:drafts-changed', handleDraftsChanged);
      window.removeEventListener('intellicivic:draft-synced', handleDraftSynced);
      window.removeEventListener('intellicivic:auth-required', handleAuthRequired);
      window.removeEventListener('online', handleOnline);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user.id, loadDrafts]);

  const handleRetryDraft = async (draftId: string) => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      toast.error('Cannot sync while offline. Please connect to internet.');
      return;
    }
    setSyncingDraftId(draftId);
    try {
      const { getDraft, saveDraft, syncDrafts } = await import('@/lib/offline-queue');
      const draft = await getDraft(draftId);
      if (draft) {
        draft.status = 'pending';
        draft.lastError = undefined;
        await saveDraft(draft);
      }
      await syncDrafts(user.id || draft?.userId || '');
      await loadDrafts();
      await fetchComplaints(true);
    } finally {
      setSyncingDraftId(null);
    }
  };

  const handleDeleteDraft = async (draftId: string) => {
    try {
      const { deleteDraft } = await import('@/lib/offline-queue');
      await deleteDraft(draftId);
      await loadDrafts();
      toast.success('Draft deleted');
    } catch {
      toast.error('Failed to delete draft');
    }
  };

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
              id: data.user.id,
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
      <div className="mx-auto w-full max-w-5xl px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-6">
        {/* Profile Completion Alert */}
        {!user.isProfileComplete && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-amber-900">
            <div>
              <div className="font-bold text-sm">Your Citizen Profile is Incomplete</div>
              <div className="text-xs text-amber-700 mt-0.5">Please fill out your Full Name, Gmail, Address, and Profile Picture to get started.</div>
            </div>
            <Link href="/citizen/profile?firstTime=true">
              <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white shrink-0 font-medium">
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

        {/* Pending Offline Drafts Section */}
        {drafts.length > 0 && (
          <Card className="border-amber-300 bg-amber-50/60 shadow-xs rounded-xl overflow-hidden min-w-0" data-testid="pending-complaints-section">
            <CardHeader className="p-4 pb-2 border-b border-amber-200/70 flex flex-row items-center justify-between gap-2 min-w-0">
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <div className="h-9 w-9 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                  <WifiOff className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <CardTitle className="text-sm font-bold text-slate-900 truncate">
                    Pending Offline Complaints ({drafts.length})
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-600 truncate">
                    Saved locally on this device. Submits automatically once reconnected.
                  </CardDescription>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="h-11 px-3 md:h-9 md:px-3 text-xs gap-1.5 border-amber-300 text-amber-900 hover:bg-amber-100 shrink-0"
                aria-label="Sync All"
                title="Sync All"
                onClick={async () => {
                  if (typeof navigator !== 'undefined' && !navigator.onLine) {
                    toast.error('Cannot sync while offline. Please connect to internet.');
                    return;
                  }
                  if (user.id) {
                    const { getDrafts, saveDraft, syncDrafts } = await import('@/lib/offline-queue');
                    const allDrafts = await getDrafts(user.id);
                    for (const d of allDrafts) {
                      if (d.status === 'failed') {
                        d.status = 'pending';
                        d.lastError = undefined;
                        await saveDraft(d);
                      }
                    }
                    await syncDrafts(user.id);
                    await loadDrafts();
                    await fetchComplaints(true);
                  }
                }}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span className="hidden md:inline">Sync All</span>
                <span className="sr-only md:hidden">Sync All</span>
              </Button>
            </CardHeader>
            <CardContent className="p-4 pt-3 divide-y divide-amber-200/60 min-w-0">
              {drafts.map((d) => (
                <div key={d.id} className="py-3 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3 min-w-0" data-testid={`pending-draft-${d.id}`}>
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm text-slate-900 break-words">{d.fields.title}</span>
                      {d.status === 'pending' && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800 border border-amber-300 shrink-0" title="Pending Sync">
                          <Clock className="w-3 h-3" />
                          <span className="hidden md:inline">Pending Sync</span>
                          <span className="sr-only md:hidden">Pending Sync</span>
                        </span>
                      )}
                      {d.status === 'syncing' && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-semibold text-blue-800 border border-blue-300 shrink-0" title="Syncing...">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          <span className="hidden md:inline">Syncing...</span>
                          <span className="sr-only md:hidden">Syncing...</span>
                        </span>
                      )}
                      {d.status === 'failed' && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-semibold text-rose-800 border border-rose-300 shrink-0" title="Failed">
                          <AlertTriangle className="w-3 h-3" />
                          <span className="hidden md:inline">Failed</span>
                          <span className="sr-only md:hidden">Failed</span>
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-600 line-clamp-1 break-words">{d.fields.description}</p>
                    <div className="flex items-center gap-3 text-[11px] text-slate-500">
                      <span>Captured: {new Date(d.capturedAt).toLocaleTimeString()}</span>
                      {d.photos?.length > 0 && <span>{d.photos.length} photo(s) attached</span>}
                    </div>
                    {d.lastError && (
                      <p className="text-[11px] text-rose-600 font-medium break-words">
                        {d.lastError}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {d.lastError?.includes('Session expired') || d.lastError?.includes('log in') ? (
                      <Link href="/login/citizen">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-11 px-3 md:h-9 md:px-3 text-xs gap-1 border-rose-300 text-rose-700 hover:bg-rose-50 font-semibold shrink-0"
                        >
                          Log In to Sync
                        </Button>
                      </Link>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-11 w-11 md:h-9 md:w-auto md:px-3 text-xs gap-1 shrink-0 p-0 md:px-3 inline-flex items-center justify-center"
                        disabled={syncingDraftId === d.id}
                        onClick={() => handleRetryDraft(d.id)}
                        aria-label="Retry sync"
                        title="Retry sync"
                      >
                        {syncingDraftId === d.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <RefreshCw className="h-3.5 w-3.5" />
                        )}
                        <span className="hidden md:inline">Retry</span>
                        <span className="sr-only md:hidden">Retry</span>
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-11 w-11 md:h-9 md:w-auto md:px-3 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 shrink-0 p-0 md:px-3 inline-flex items-center justify-center"
                      onClick={() => handleDeleteDraft(d.id)}
                      aria-label="Delete draft"
                      title="Delete draft"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span className="hidden md:inline">Delete</span>
                      <span className="sr-only md:hidden">Delete</span>
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Summary Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <Card className="border border-slate-200 shadow-xs bg-white rounded-xl p-3 sm:p-4 min-w-0">
            <div className="flex items-center justify-between gap-2 min-w-0">
              <div className="min-w-0">
                <p className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider truncate">Total Reports</p>
                <p className="text-xl sm:text-2xl font-extrabold text-slate-900 mt-1 truncate">{complaints.length}</p>
              </div>
              <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl bg-blue-50 text-ic-blue flex items-center justify-center shrink-0">
                <FileText className="h-4 w-4 sm:h-5 sm:w-5" />
              </div>
            </div>
          </Card>

          <Card className="border border-slate-200 shadow-xs bg-white rounded-xl p-3 sm:p-4 min-w-0">
            <div className="flex items-center justify-between gap-2 min-w-0">
              <div className="min-w-0">
                <p className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider truncate">Under Review</p>
                <p className="text-xl sm:text-2xl font-extrabold text-amber-600 mt-1 truncate">
                  {complaints.filter((c) => ['SUBMITTED', 'AI_PROCESSING', 'PENDING_DEPT_REVIEW'].includes(c.status)).length}
                </p>
              </div>
              <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                <Calendar className="h-4 w-4 sm:h-5 sm:w-5" />
              </div>
            </div>
          </Card>

          <Card className="border border-slate-200 shadow-xs bg-white rounded-xl p-3 sm:p-4 min-w-0">
            <div className="flex items-center justify-between gap-2 min-w-0">
              <div className="min-w-0">
                <p className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider truncate">In Progress</p>
                <p className="text-xl sm:text-2xl font-extrabold text-indigo-600 mt-1 truncate">
                  {complaints.filter((c) => ['ASSIGNED', 'IN_PROGRESS'].includes(c.status)).length}
                </p>
              </div>
              <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                <RefreshCw className="h-4 w-4 sm:h-5 sm:w-5" />
              </div>
            </div>
          </Card>

          <Card className="border border-slate-200 shadow-xs bg-white rounded-xl p-3 sm:p-4 min-w-0">
            <div className="flex items-center justify-between gap-2 min-w-0">
              <div className="min-w-0">
                <p className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider truncate">Resolved</p>
                <p className="text-xl sm:text-2xl font-extrabold text-emerald-600 mt-1 truncate">
                  {complaints.filter((c) => ['RESOLVED', 'CLOSED'].includes(c.status)).length}
                </p>
              </div>
              <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <PlusCircle className="h-4 w-4 sm:h-5 sm:w-5 rotate-45" />
              </div>
            </div>
          </Card>
        </div>

        {/* Filter & Search Controls Card */}
        <Card className="border border-slate-200 shadow-xs bg-white rounded-xl min-w-0">
          <CardContent className="p-4 space-y-3 min-w-0">
            <div className="flex items-center justify-between gap-2 min-w-0">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-900 min-w-0">
                <Filter className="h-4 w-4 text-ic-blue shrink-0" />
                <span className="truncate">Search &amp; Filter Complaints</span>
              </div>

              {lastUpdated && (
                <span className="text-[11px] text-slate-400 flex items-center gap-1 font-mono shrink-0">
                  <RefreshCw className="h-3 w-3 text-ic-blue animate-spin" />
                  <span className="hidden sm:inline">Live (Updated {lastUpdated})</span>
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 min-w-0">
              <div className="relative min-w-0">
                <Search className="absolute left-3 top-3.5 md:top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search title or ID..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setPage(1);
                  }}
                  className="pl-9 min-w-0"
                />
              </div>

              <Select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                className="min-w-0"
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

              <div className="space-y-0.5 min-w-0">
                <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">From Date</label>
                <Input
                  type="date"
                  value={fromDate}
                  onChange={(e) => {
                    setFromDate(e.target.value);
                    setPage(1);
                  }}
                  className="min-w-0"
                />
              </div>

              <div className="space-y-0.5 min-w-0">
                <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">To Date</label>
                <Input
                  type="date"
                  value={toDate}
                  onChange={(e) => {
                    setToDate(e.target.value);
                    setPage(1);
                  }}
                  className="min-w-0"
                />
              </div>
            </div>

            {(searchQuery || fromDate || toDate || statusFilter !== 'ALL') && (
              <div className="flex justify-end pt-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                  className="h-11 px-3 md:h-9 md:px-3 text-slate-500 hover:text-slate-900 gap-1.5"
                  aria-label="Clear All Filters"
                >
                  <X className="h-4 w-4 md:h-3 md:w-3" />
                  <span>Clear All Filters</span>
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
            <Button variant="outline" size="sm" onClick={() => fetchComplaints()} className="mt-4 h-11 px-4 md:h-9 md:px-3 border-rose-200">
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
                <Button size="sm" className="h-11 px-4 md:h-9 md:px-3 bg-ic-blue text-white font-medium">Submit Your First Complaint</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4 min-w-0">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 min-w-0">
              {complaints.map((complaint) => {
                return (
                  <Link
                    key={complaint.id}
                    href={`/citizen/complaints/${complaint.id}`}
                    className="block group min-w-0"
                  >
                    <Card className="h-full hover:shadow-md transition-shadow border border-slate-200 bg-white rounded-xl hover:border-ic-blue/40 flex flex-col justify-between overflow-hidden min-w-0">
                      <CardHeader className="p-4 sm:p-5 pb-3 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
                          <span className="font-mono text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 shrink-0">
                            #{complaint.ticketId}
                          </span>
                          <div className="shrink-0">
                            {getStatusBadge(complaint.status)}
                          </div>
                        </div>
                        <CardTitle className="text-base font-bold text-slate-900 line-clamp-1 group-hover:text-ic-blue transition-colors break-words">
                          {complaint.title}
                        </CardTitle>
                      </CardHeader>

                      <CardContent className="p-4 sm:p-5 pt-0 space-y-3 flex-1 flex flex-col justify-between min-w-0">
                        <p className="text-xs text-slate-600 line-clamp-2 break-words">
                          {complaint.description}
                        </p>

                        <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs text-slate-500 gap-2 flex-wrap">
                          <div className="flex items-center gap-1.5 shrink-0">
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
                            <span className="bg-slate-50 border border-slate-200 px-2 py-0.5 rounded text-[11px] font-semibold text-slate-700 truncate max-w-[150px]">
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
              <div className="flex items-center justify-between pt-4 border-t border-slate-200 gap-2 flex-wrap">
                <span className="text-xs text-slate-500">
                  Page {page} of {totalPages}
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="h-11 px-3 md:h-9 md:px-3 border-slate-200"
                    aria-label="Previous page"
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    <span>Previous</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className="h-11 px-3 md:h-9 md:px-3 border-slate-200"
                    aria-label="Next page"
                  >
                    <span>Next</span>
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


