'use client';

import * as React from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import {
  AlertTriangle,
  BarChart3,
  ExternalLink,
  Loader2,
  MapPin,
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
import type { AreaStatusCount, CitizenStatusPin } from '@/services/live-status-map-service';

const CitizenLiveMapInner = dynamic(() => import('./citizen-live-map-inner'), {
  ssr: false,
  loading: () => (
    <div className="h-[340px] sm:h-[420px] lg:h-[460px] w-full rounded-xl bg-[#F8F6F1] border border-[#E5E2D9] flex flex-col items-center justify-center p-6 text-[#6E6B64]">
      <Loader2 className="w-7 h-7 animate-spin text-[#3468A1] mb-2" aria-hidden="true" />
      <span className="text-sm font-medium">Loading Live Status Map...</span>
    </div>
  ),
});

interface ShellUser {
  id?: string;
  name?: string;
  email?: string;
  role: UserRole;
  avatarUrl?: string | null;
}

const STATUS_FILTER_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'SUBMITTED', label: 'Submitted' },
  { value: 'PENDING_DEPT_REVIEW', label: 'Pending Review' },
  { value: 'ASSIGNED', label: 'Assigned' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'RESOLVED', label: 'Resolved' },
  { value: 'CLOSED', label: 'Closed' },
] as const;

const STATUS_LEGEND = [
  { label: 'Submitted / Pending', dotClass: 'bg-amber-600' },
  { label: 'Assigned', dotClass: 'bg-blue-600' },
  { label: 'In Progress', dotClass: 'bg-indigo-600' },
  { label: 'Resolved / Closed', dotClass: 'bg-emerald-700' },
  { label: 'Rejected / Duplicate', dotClass: 'bg-slate-500' },
] as const;

function formatUpdatedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Unknown';
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export function CitizenLiveMapView() {
  const [user, setUser] = React.useState<ShellUser>({
    name: 'Citizen',
    role: 'CITIZEN',
  });
  const [statusFilter, setStatusFilter] = React.useState<string>('');
  const [ownPins, setOwnPins] = React.useState<CitizenStatusPin[]>([]);
  const [areas, setAreas] = React.useState<AreaStatusCount[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

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
          role: (data.user.role || 'CITIZEN') as UserRole,
          avatarUrl: data.user.avatarUrl ?? null,
        });
      })
      .catch(() => {
        // Fallback shell user stays cleanly populated
      });
    return () => {
      active = false;
    };
  }, []);

  const loadMapData = React.useCallback(async (selectedStatus: string) => {
    setLoading(true);
    setError(null);
    try {
      const params = selectedStatus ? `?status=${encodeURIComponent(selectedStatus)}` : '';
      const response = await fetch(`/api/citizen/live-status-map${params}`, {
        cache: 'no-store',
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        const message =
          typeof data?.error === 'string'
            ? data.error
            : typeof data?.message === 'string'
              ? data.message
              : `Unable to load live status map (HTTP ${response.status})`;
        throw new Error(message);
      }

      setOwnPins(Array.isArray(data?.own) ? data.own : []);
      setAreas(Array.isArray(data?.areas) ? data.areas : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load live status map');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadMapData(statusFilter);
  }, [loadMapData, statusFilter]);

  return (
    <AppShell user={user}>
      <div className="space-y-6 max-w-7xl mx-auto">
        <PageHeader
          title="Live Status Map"
          description="Track your own geotagged complaints on the map alongside privacy-safe area status totals."
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <label htmlFor="citizen-map-status-filter" className="sr-only">
                Filter your map pins by status
              </label>
              <select
                id="citizen-map-status-filter"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                disabled={loading}
                className="min-h-[44px] rounded-md border border-[#E5E2D9] bg-white px-3 text-sm font-medium text-[#131E20] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3468A1]"
              >
                {STATUS_FILTER_OPTIONS.map((opt) => (
                  <option key={opt.value || 'ALL'} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <Button
                type="button"
                variant="outline"
                onClick={() => void loadMapData(statusFilter)}
                disabled={loading}
                className="min-h-[44px] bg-white"
              >
                <RefreshCw
                  className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`}
                  aria-hidden="true"
                />
                Refresh
              </Button>
            </div>
          }
        />

        {error && (
          <Alert variant="destructive" className="bg-rose-50 border-rose-200 text-rose-900">
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            <AlertTitle>Unable to load live map data</AlertTitle>
            <AlertDescription className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-1">
              <span>{error}</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void loadMapData(statusFilter)}
                className="min-h-[44px] sm:min-h-[36px] bg-white text-rose-900 border-rose-300 hover:bg-rose-100 self-start sm:self-auto"
              >
                Try Again
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Map Card (Own Pins Only) */}
        <Card className="border-[#E5E2D9] shadow-xs bg-white">
          <CardHeader className="border-b border-[#E5E2D9] pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <CardTitle className="text-base font-bold text-[#131E20] flex items-center gap-2">
              <MapPin className="w-4 h-4 text-[#3468A1]" aria-hidden="true" />
              <span>Your Complaint Locations ({ownPins.length})</span>
            </CardTitle>
            <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-[#6E6B64]" aria-label="Pin status color legend">
              {STATUS_LEGEND.map((item) => (
                <li key={item.label} className="inline-flex items-center gap-1.5">
                  <span className={`w-2.5 h-2.5 rounded-full ${item.dotClass}`} aria-hidden="true" />
                  <span>{item.label}</span>
                </li>
              ))}
            </ul>
          </CardHeader>

          <CardContent className="p-4 space-y-4">
            {loading ? (
              <Skeleton className="h-[340px] sm:h-[420px] lg:h-[460px] w-full rounded-xl" />
            ) : (
              <CitizenLiveMapInner pins={ownPins} />
            )}

            {/* List Fallback / Companion List for Own Pins */}
            <div>
              <h2 className="text-sm font-bold text-[#131E20] mb-3">
                Your Geotagged Complaints List
              </h2>
              {loading ? (
                <div className="space-y-2.5" aria-busy="true">
                  {[1, 2].map((n) => (
                    <Skeleton key={n} className="h-16 w-full rounded-xl" />
                  ))}
                </div>
              ) : ownPins.length === 0 ? (
                <EmptyState
                  icon={MapPin}
                  title="No matching own complaint pins"
                  description="You do not have any complaints with GPS coordinates matching the active filter."
                  className="py-10"
                />
              ) : (
                <ul className="divide-y divide-[#E5E2D9] rounded-xl border border-[#E5E2D9] bg-[#F8F6F1]/40" aria-label="Your geotagged complaints">
                  {ownPins.map((pin) => (
                    <li
                      key={pin.id}
                      className="p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs font-bold text-[#3468A1]">
                            {pin.ticketId}
                          </span>
                          <StatusBadge status={pin.status} />
                          <PriorityBadge priority={pin.priority} />
                        </div>
                        <p className="text-xs text-[#6E6B64]">
                          Last updated: {formatUpdatedAt(pin.updatedAt)}
                        </p>
                      </div>
                      <Link
                        href={`/citizen/complaints/${pin.id}`}
                        className="inline-flex items-center justify-center min-h-[44px] sm:min-h-[36px] px-3 rounded-lg border border-[#E5E2D9] bg-white text-xs font-semibold text-[#131E20] hover:bg-[#F2EFE6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3468A1] shrink-0"
                      >
                        <span>View Details</span>
                        <ExternalLink className="w-3.5 h-3.5 ml-1.5" aria-hidden="true" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Aggregate Area Status Counts (No Coordinates / >= 5 k-anonymity threshold) */}
        <Card className="border-[#E5E2D9] shadow-xs bg-white">
          <CardHeader className="border-b border-[#E5E2D9] pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <CardTitle className="text-base font-bold text-[#131E20] flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-[#3468A1]" aria-hidden="true" />
                <span>City Area Complaint Counts</span>
              </CardTitle>
              <p className="text-xs text-[#6E6B64] mt-1">
                Aggregate status counts by ward or locality. Areas with fewer than 5 complaints are grouped under &ldquo;Other&rdquo; to protect citizen privacy.
              </p>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {loading ? (
              <div className="p-6 space-y-3" aria-busy="true">
                {[1, 2, 3].map((n) => (
                  <Skeleton key={n} className="h-12 w-full rounded-lg" />
                ))}
              </div>
            ) : !error && areas.length === 0 ? (
              <EmptyState
                icon={BarChart3}
                title="No area counts available yet"
                description="Aggregate area counts will appear once complaints are recorded."
                className="py-10"
              />
            ) : (
              <>
                {/* Mobile Card List (375px) */}
                <ul className="divide-y divide-[#E5E2D9] md:hidden" aria-label="Area complaint status counts">
                  {areas.map((row) => (
                    <li key={row.area} className="p-4 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-bold text-[#131E20] break-words">
                          {row.area}
                        </span>
                        <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-[#F2EFE6] text-[#131E20] shrink-0">
                          {row.total} total
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-xs text-[#6E6B64]">
                        <div>
                          Pending: <strong className="text-[#131E20]">{row.pending}</strong>
                        </div>
                        <div>
                          Active: <strong className="text-[#131E20]">{row.inProgress}</strong>
                        </div>
                        <div>
                          Resolved: <strong className="text-[#131E20]">{row.resolved}</strong>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>

                {/* Tablet & Desktop Table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left border-collapse" aria-label="Area complaint status counts">
                    <thead>
                      <tr className="border-b border-[#E5E2D9] bg-[#F8F6F1] text-xs font-bold uppercase tracking-wider text-[#6E6B64]">
                        <th scope="col" className="py-3.5 px-4">
                          Area / Ward
                        </th>
                        <th scope="col" className="py-3.5 px-4 text-right">
                          Total
                        </th>
                        <th scope="col" className="py-3.5 px-4 text-right">
                          Pending
                        </th>
                        <th scope="col" className="py-3.5 px-4 text-right">
                          In Progress
                        </th>
                        <th scope="col" className="py-3.5 px-4 text-right">
                          Resolved
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E5E2D9] text-sm">
                      {areas.map((row) => (
                        <tr key={row.area} className="hover:bg-[#F8F6F1]/70">
                          <td className="py-3 px-4 font-semibold text-[#131E20]">
                            {row.area}
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-[#131E20]">
                            {row.total}
                          </td>
                          <td className="py-3 px-4 text-right text-[#6E6B64]">
                            {row.pending}
                          </td>
                          <td className="py-3 px-4 text-right text-[#6E6B64]">
                            {row.inProgress}
                          </td>
                          <td className="py-3 px-4 text-right text-[#6E6B64]">
                            {row.resolved}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

