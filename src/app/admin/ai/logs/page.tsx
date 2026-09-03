'use client';

import React, { useEffect, useState } from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/admin/page-header';
import { PriorityBadge } from '@/components/admin/priority-badge';
import { StatusBadge } from '@/components/admin/status-badge';
import { EmptyState } from '@/components/admin/empty-state';
import { Bot, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';

interface AiLogEntry {
  id: string;
  ticketId: string;
  title: string;
  description: string;
  status: string;
  priority: string | null;
  createdAt: string;
  category?: { name: string };
  department?: { name: string };
  aiPrediction?: {
    confidenceScore?: number;
    suggestedCategory?: { name: string };
    suggestedDepartment?: { name: string };
    suggestedPriority?: string;
    isRejected: boolean;
    createdAt: string;
  };
}

export default function AiLogsPage() {
  const [entries, setEntries] = useState<AiLogEntry[]>([]);
  const [filtered, setFiltered] = useState<AiLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [user, setUser] = useState({ name: 'Admin', role: 'ADMIN' });

  useEffect(() => {
    async function load() {
      try {
        const [cRes, meRes] = await Promise.all([
          fetch('/api/complaints?limit=200'),
          fetch('/api/auth/me'),
        ]);
        if (cRes.ok) {
          const data = await cRes.json();
          const all: AiLogEntry[] = data.data || [];
          setEntries(all);
          setFiltered(all);
        }
        if (meRes.ok) {
          const me = await meRes.json();
          setUser({ name: me.user?.name || 'Admin', role: me.user?.role || 'ADMIN' });
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  useEffect(() => {
    const q = search.toLowerCase();
    setFiltered(
      entries.filter(
        (e) =>
          e.ticketId.toLowerCase().includes(q) ||
          e.title.toLowerCase().includes(q) ||
          e.aiPrediction?.suggestedCategory?.name.toLowerCase().includes(q) ||
          e.aiPrediction?.suggestedDepartment?.name.toLowerCase().includes(q),
      ),
    );
  }, [search, entries]);

  function confColor(score?: number) {
    if (!score) return 'text-slate-400';
    if (score >= 0.8) return 'text-emerald-600';
    if (score >= 0.6) return 'text-amber-600';
    return 'text-red-600';
  }

  return (
    <AppShell user={{ name: user.name, role: user.role as any }}>
      <div className="space-y-6">
        <PageHeader
          title="AI Processing Logs"
          description="All complaints processed by the AI classification engine with confidence scores and predictions"
        />

        <div className="flex items-center justify-between gap-4">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              className="pl-9"
              placeholder="Search ticket, title, category..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <span className="text-sm text-slate-500 shrink-0">{filtered.length} logs</span>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {loading ? (
            <div className="py-20 text-center text-sm text-slate-400">Loading…</div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={Bot}
              title="No AI logs yet"
              description="AI processing logs will appear here as complaints are submitted and classified."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    {[
                      'Ticket',
                      'AI Category',
                      'AI Department',
                      'AI Priority',
                      'Confidence',
                      'Status',
                      'AI Result',
                      'Processed',
                    ].map((h) => (
                      <th
                        key={h}
                        className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((entry) => {
                    const ai = entry.aiPrediction;
                    const confidence = ai?.confidenceScore;
                    return (
                      <tr key={entry.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-mono text-xs text-ic-action font-semibold">
                            #{entry.ticketId}
                          </div>
                          <div className="text-xs text-slate-500 truncate max-w-[140px] mt-0.5">
                            {entry.title}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-600">
                          {ai?.suggestedCategory?.name ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-600">
                          {ai?.suggestedDepartment?.name ?? '—'}
                        </td>
                        <td className="px-4 py-3">
                          <PriorityBadge priority={ai?.suggestedPriority ?? null} />
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`text-sm font-bold ${confColor(confidence)}`}
                          >
                            {confidence != null
                              ? `${Math.round(confidence * 100)}%`
                              : '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={entry.status} />
                        </td>
                        <td className="px-4 py-3">
                          {ai ? (
                            <span
                              className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                                ai.isRejected
                                  ? 'bg-red-50 text-red-700'
                                  : 'bg-emerald-50 text-emerald-700'
                              }`}
                            >
                              {ai.isRejected ? 'Rejected' : 'Accepted'}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400">Pending</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-400">
                          {ai?.createdAt
                            ? new Date(ai.createdAt).toLocaleDateString('en-IN', {
                                day: '2-digit',
                                month: 'short',
                              })
                            : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
