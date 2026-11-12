'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Play,
  RefreshCw,
} from 'lucide-react';
import { AppShell, type UserRole } from '@/components/layout/app-shell';
import { EmptyState } from '@/components/admin/empty-state';
import { PageHeader } from '@/components/admin/page-header';
import { PriorityBadge } from '@/components/admin/priority-badge';
import { StatusBadge } from '@/components/admin/status-badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface EscalatedComplaintRow {
  id: string;
  ticketId: string;
  title: string;
  status: string;
  priority: string | null;
  department: { id: string; name: string } | null;
  escalatedAt: string | null;
}

interface PaginationState {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface RunJobSummary {
  checked: number;
  escalated: number;
  skipped: number;
  failedEmailCount: number;
  ranAt: string;
}

interface ShellUser {
  id?: string;
  name?: string;
  email?: string;
  role: UserRole;
  avatarUrl?: string | null;
}

interface SlaEscalationsViewProps {
  defaultRole?: UserRole;
  portalPrefix?: '/admin' | '/dept-head';
}

const DEFAULT_PAGE_SIZE = 20;

function formatEscalatedDate(isoString: string | null): string {
  if (!isoString) return 'Unknown';
  const parsed = new Date(isoString);
  if (Number.isNaN(parsed.getTime())) return 'Unknown';
  return parsed.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export function SlaEscalationsView({
  defaultRole = 'ADMIN',
  portalPrefix = '/admin',
}: SlaEscalationsViewProps) {
  const [user, setUser] = React.useState<ShellUser>({
    name: 'Staff',
    role: defaultRole,
  });
  const [items, setItems] = React.useState<EscalatedComplaintRow[]>([]);
  const [pagination, setPagination] = React.useState<PaginationState>({
    page: 1,
    limit: DEFAULT_PAGE_SIZE,
    total: 0,
    totalPages: 0,
  });
  const [page, setPage] = React.useState(1);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [runningJob, setRunningJob] = React.useState(false);
  const [runError, setRunError] = React.useState<string | null>(null);
  const [runSummary, setRunSummary] = React.useState<RunJobSummary | null>(null);

  React.useEffect(() => {
    let active = true;
    fetch('/api/auth/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!active || !data?.user) return;
        setUser({
          id: data.user.id,
          name: data.user.name,
          email: data.user.email,
          role: data.user.role as UserRole,
          avatarUrl: data.user.avatarUrl ?? null,
        });
      })
      .catch(() => {
        // AppShell falls back cleanly when user profile request is unavailable
      });
    return () => {
      active = false;
    };
  }, []);

  const loadEscalations = React.useCallback(async (targetPage: number) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/admin/sla/escalations?page=${targetPage}&limit=${DEFAULT_PAGE_SIZE}`,
        { cache: 'no-store' },
      );
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        const message =
          typeof data?.error === 'string'
            ? data.error
            : `Failed to load SLA escalations (HTTP ${response.status})`;
        throw new Error(message);
      }

      setItems(Array.isArray(data?.items) ? data.items : []);
      if (data?.pagination) {
        setPagination(data.pagination);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load SLA escalations');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadEscalations(page);
  }, [loadEscalations, page]);

  const handleManualRun = async () => {
    setRunningJob(true);
    setRunError(null);
    setRunSummary(null);
    try {
      const response = await fetch('/api/admin/sla/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        const message =
          typeof data?.error === 'string'
            ? data.error
            : `Failed to run SLA escalation check (HTTP ${response.status})`;
        throw new Error(message);
      }

      setRunSummary({
        checked: Number(data?.checked ?? 0),
        escalated: Number(data?.escalated ?? 0),
        skipped: Number(data?.skipped ?? 0),
        failedEmailCount: Number(data?.failedEmailCount ?? 0),
        ranAt: typeof data?.ranAt === 'string' ? data.ranAt : new Date().toISOString(),
      });

      if (page !== 1) {
        setPage(1);
      } else {
        await loadEscalations(1);
      }
    } catch (err) {
      setRunError(err instanceof Error ? err.message : 'Manual SLA escalation check failed');
    } finally {
      setRunningJob(false);
    }
  };

  const detailPrefix = user.role === 'DEPARTMENT_HEAD' ? '/dept-head' : portalPrefix;
  const isSuperAdmin = user.role === 'SUPER_ADMIN';

  return (
    <AppShell user={user}>
      <div className="space-y-6 max-w-7xl mx-auto">
        <PageHeader
          title="SLA Escalations"
          description={
            user.role === 'DEPARTMENT_HEAD'
              ? 'Active complaints in your department that breached their SLA deadline and triggered escalation.'
              : 'Platform-wide view of complaints that breached their SLA deadline and triggered escalation.'
          }
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => void loadEscalations(page)}
                disabled={loading}
                className="min-h-[44px] bg-white"
              >
                <RefreshCw
                  className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`}
                  aria-hidden="true"
                />
                Refresh
              </Button>
              {isSuperAdmin && (
                <Button
                  type="button"
                  onClick={() => void handleManualRun()}
                  disabled={runningJob}
                  aria-busy={runningJob}
                  className="min-h-[44px] bg-[#131E20] hover:bg-[#1E2E30] text-white"
                >
                  <Play className="w-4 h-4 mr-2" aria-hidden="true" />
                  {runningJob ? 'Running SLA Check...' : 'Run SLA Check'}
                </Button>
              )}
            </div>
          }
        />

        {runError && (
          <Alert variant="destructive" className="bg-rose-50 border-rose-200 text-rose-900">
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            <AlertTitle>SLA Check Failed</AlertTitle>
            <AlertDescription>{runError}</AlertDescription>
          </Alert>
        )}

        {runSummary && (
          <Alert className="bg-emerald-50 border-emerald-200 text-emerald-950">
            <CheckCircle2 className="h-4 w-4 text-emerald-700" aria-hidden="true" />
            <AlertTitle>SLA Escalation Run Complete</AlertTitle>
            <AlertDescription>
              Checked {runSummary.checked} open complaint(s): escalated {runSummary.escalated},
              skipped {runSummary.skipped}.
            </AlertDescription>
          </Alert>
        )}

        {error && (
          <Alert variant="destructive" className="bg-rose-50 border-rose-200 text-rose-900">
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            <AlertTitle>Unable to load escalated complaints</AlertTitle>
            <AlertDescription className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-1">
              <span>{error}</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void loadEscalations(page)}
                className="min-h-[44px] sm:min-h-[36px] bg-white text-rose-900 border-rose-300 hover:bg-rose-100 self-start sm:self-auto"
              >
                Try Again
              </Button>
            </AlertDescription>
          </Alert>
        )}

        <Card className="border-[#E5E2D9] shadow-xs bg-white">
          <CardHeader className="border-b border-[#E5E2D9] pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <CardTitle className="text-base font-bold text-[#131E20] flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#3468A1]" aria-hidden="true" />
              <span>Escalated Complaints</span>
            </CardTitle>
            {!loading && !error && (
              <p className="text-xs font-medium text-[#6E6B64]">
                {pagination.total} total escalation{pagination.total === 1 ? '' : 's'}
              </p>
            )}
          </CardHeader>

          <CardContent className="p-0">
            {loading ? (
              <div className="p-6 space-y-4" aria-busy="true" aria-label="Loading SLA escalations">
                {[1, 2, 3, 4].map((idx) => (
                  <div
                    key={idx}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border border-[#E5E2D9]"
                  >
                    <div className="space-y-2 flex-1 min-w-0">
                      <Skeleton className="h-4 w-28" />
                      <Skeleton className="h-5 w-3/4" />
                    </div>
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-6 w-20 rounded-full" />
                      <Skeleton className="h-6 w-24 rounded-full" />
                    </div>
                  </div>
                ))}
              </div>
            ) : !error && items.length === 0 ? (
              <EmptyState
                icon={CheckCircle2}
                title="No SLA escalations found"
                description={
                  user.role === 'DEPARTMENT_HEAD'
                    ? 'All tracked complaints in your department are currently within SLA.'
                    : 'No complaints have triggered an SLA escalation yet.'
                }
              />
            ) : (
              <>
                {/* Mobile Card List (375px-friendly) */}
                <ul className="divide-y divide-[#E5E2D9] md:hidden" aria-label="SLA escalated complaints list">
                  {items.map((item) => (
                    <li key={item.id} className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <Link
                          href={`${detailPrefix}/complaints/${item.id}`}
                          className="inline-flex items-center min-h-[44px] text-xs font-mono font-bold text-[#3468A1] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3468A1] rounded"
                        >
                          {item.ticketId}
                        </Link>
                        <PriorityBadge priority={item.priority} />
                      </div>
                      <Link
                        href={`${detailPrefix}/complaints/${item.id}`}
                        className="block text-sm font-semibold text-[#131E20] hover:text-[#3468A1] break-words focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3468A1] rounded"
                      >
                        {item.title}
                      </Link>
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#6E6B64]">
                        <span>{item.department?.name ?? 'Unassigned department'}</span>
                        <StatusBadge status={item.status} />
                      </div>
                      <div className="text-xs text-[#6E6B64]">
                        Escalated: {formatEscalatedDate(item.escalatedAt)}
                      </div>
                    </li>
                  ))}
                </ul>

                {/* Tablet / Desktop Table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left border-collapse" aria-label="SLA escalated complaints">
                    <thead>
                      <tr className="border-b border-[#E5E2D9] bg-[#F8F6F1] text-xs font-bold uppercase tracking-wider text-[#6E6B64]">
                        <th scope="col" className="py-3.5 px-4 whitespace-nowrap">
                          Ticket ID
                        </th>
                        <th scope="col" className="py-3.5 px-4">
                          Complaint Title
                        </th>
                        <th scope="col" className="py-3.5 px-4 whitespace-nowrap">
                          Department
                        </th>
                        <th scope="col" className="py-3.5 px-4 whitespace-nowrap">
                          Priority
                        </th>
                        <th scope="col" className="py-3.5 px-4 whitespace-nowrap">
                          Status
                        </th>
                        <th scope="col" className="py-3.5 px-4 whitespace-nowrap">
                          Escalated At
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E5E2D9] text-sm">
                      {items.map((item) => (
                        <tr key={item.id} className="hover:bg-[#F8F6F1]/70 transition-colors">
                          <td className="py-3.5 px-4 whitespace-nowrap font-mono text-xs font-bold">
                            <Link
                              href={`${detailPrefix}/complaints/${item.id}`}
                              className="text-[#3468A1] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3468A1] rounded px-1 py-0.5"
                            >
                              {item.ticketId}
                            </Link>
                          </td>
                          <td className="py-3.5 px-4 font-medium text-[#131E20] max-w-md">
                            <Link
                              href={`${detailPrefix}/complaints/${item.id}`}
                              className="hover:text-[#3468A1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3468A1] rounded line-clamp-2"
                            >
                              {item.title}
                            </Link>
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap text-[#6E6B64]">
                            {item.department?.name ?? 'Unassigned'}
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <PriorityBadge priority={item.priority} />
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <StatusBadge status={item.status} />
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap text-xs text-[#6E6B64]">
                            {formatEscalatedDate(item.escalatedAt)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {pagination.totalPages > 1 && (
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 py-4 border-t border-[#E5E2D9] bg-[#F8F6F1]/50">
                    <p className="text-xs font-medium text-[#6E6B64]">
                      Page {pagination.page} of {pagination.totalPages}
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={page <= 1 || loading}
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        className="min-h-[44px] sm:min-h-[36px] bg-white"
                      >
                        <ChevronLeft className="w-4 h-4 mr-1" aria-hidden="true" />
                        Previous
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={page >= pagination.totalPages || loading}
                        onClick={() => setPage((p) => p + 1)}
                        className="min-h-[44px] sm:min-h-[36px] bg-white"
                      >
                        Next
                        <ChevronRight className="w-4 h-4 ml-1" aria-hidden="true" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

