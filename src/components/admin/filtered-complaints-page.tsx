'use client';

import React from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/admin/page-header';
import { StatusBadge } from '@/components/admin/status-badge';
import { PriorityBadge } from '@/components/admin/priority-badge';
import { EmptyState } from '@/components/admin/empty-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Link from 'next/link';
import {
  Search,
  ExternalLink,
  Clock,
  ClipboardList,
  RefreshCw,
} from 'lucide-react';

interface Complaint {
  id: string;
  ticketId: string;
  title: string;
  status: string;
  priority: string | null;
  createdAt: string;
  citizen?: { name: string; mobileNumber?: string };
  category?: { name: string };
  department?: { name: string };
}

interface FilteredComplaintsPageProps {
  filterStatus: string | string[];
  pageTitle: string;
  pageDescription: string;
  emptyMessage: string;
  /** Optional additional status pill shown in header */
  statusLabel?: string;
}

export function FilteredComplaintsPage({
  filterStatus,
  pageTitle,
  pageDescription,
  emptyMessage,
  statusLabel,
}: FilteredComplaintsPageProps) {
  const [complaints, setComplaints] = React.useState<Complaint[]>([]);
  const [filtered, setFiltered] = React.useState<Complaint[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState('');
  const [user, setUser] = React.useState<{ name: string; role: string }>({ name: 'Admin', role: 'ADMIN' });

  const statuses = Array.isArray(filterStatus) ? filterStatus : [filterStatus];

  React.useEffect(() => {
    async function load() {
      try {
        const [complaintRes, meRes] = await Promise.all([
          fetch('/api/complaints?limit=200'),
          fetch('/api/auth/me'),
        ]);
        if (complaintRes.ok) {
          const data = await complaintRes.json();
          const all: Complaint[] = data.data || data.complaints || [];
          const matched = all.filter((c) => statuses.includes(c.status));
          setComplaints(matched);
          setFiltered(matched);
        }
        if (meRes.ok) {
          const me = await meRes.json();
          setUser({ name: me.name || 'Admin', role: me.role || 'ADMIN' });
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  React.useEffect(() => {
    const q = search.toLowerCase();
    setFiltered(
      complaints.filter(
        (c) =>
          c.ticketId.toLowerCase().includes(q) ||
          c.title.toLowerCase().includes(q) ||
          c.citizen?.name.toLowerCase().includes(q) ||
          c.category?.name.toLowerCase().includes(q) ||
          c.department?.name.toLowerCase().includes(q),
      ),
    );
  }, [search, complaints]);

  return (
    <AppShell user={{ name: user.name, role: user.role as any }}>
      <div className="space-y-6">
        <PageHeader
          title={pageTitle}
          description={pageDescription}
          badge={
            statusLabel ? (
              <StatusBadge status={statusLabel} />
            ) : undefined
          }
          actions={
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setLoading(true);
                setSearch('');
                window.location.reload();
              }}
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          }
        />

        {/* Search + count */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              className="pl-9"
              placeholder="Search by ticket, title, citizen..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <span className="text-sm text-slate-500 shrink-0">
            {filtered.length} complaint{filtered.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {loading ? (
            <div className="py-20 text-center text-slate-400 text-sm">Loading…</div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={ClipboardList}
              title="No complaints found"
              description={emptyMessage}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      Ticket
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide hidden sm:table-cell">
                      Category
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide hidden md:table-cell">
                      Department
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      Priority
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide hidden lg:table-cell">
                      Date
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex flex-col">
                          <span className="font-mono text-xs text-ic-action font-semibold">
                            #{c.ticketId}
                          </span>
                          <span className="text-slate-700 text-xs mt-0.5 truncate max-w-[180px]">
                            {c.title}
                          </span>
                          {c.citizen?.name && (
                            <span className="text-[11px] text-slate-400 mt-0.5">
                              {c.citizen.name}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <span className="text-xs text-slate-500">
                          {c.category?.name ?? '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <span className="text-xs text-slate-500">
                          {c.department?.name ?? 'Unassigned'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <PriorityBadge priority={c.priority} />
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={c.status} />
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <div className="flex items-center gap-1 text-xs text-slate-400">
                          <Clock className="w-3 h-3" />
                          {new Date(c.createdAt).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: '2-digit',
                          })}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link href={`/admin/complaints/${c.id}`}>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-xs h-7"
                          >
                            <ExternalLink className="w-3 h-3 mr-1" />
                            View
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
