'use client';

import React, { useEffect, useState } from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/admin/page-header';
import { PriorityBadge } from '@/components/admin/priority-badge';
import { StatusBadge } from '@/components/admin/status-badge';
import { EmptyState } from '@/components/admin/empty-state';
import { Button } from '@/components/ui/button';
import { Bell, BellOff, CheckCheck, ExternalLink, Zap } from 'lucide-react';
import Link from 'next/link';

interface NotificationItem {
  id: string;
  ticketId: string;
  title: string;
  status: string;
  priority: string | null;
  createdAt: string;
  category?: { name: string };
  department?: { name: string };
}

type FilterType = 'all' | 'critical' | 'high' | 'pending';

export default function NotificationsPage() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('all');
  const [user, setUser] = useState({ name: 'Admin', role: 'ADMIN' });
  const [readIds, setReadIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    async function load() {
      try {
        const [cRes, meRes] = await Promise.all([
          fetch('/api/complaints?limit=100'),
          fetch('/api/auth/me'),
        ]);
        if (cRes.ok) {
          const data = await cRes.json();
          const all: NotificationItem[] = data.data || [];
          const notif = all.filter(
            (c) =>
              c.priority === 'CRITICAL' ||
              c.priority === 'HIGH' ||
              ['SUBMITTED', 'PENDING_DEPT_REVIEW'].includes(c.status),
          );
          setItems(notif);
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

  const filtered = items.filter((item) => {
    if (filter === 'critical') return item.priority === 'CRITICAL';
    if (filter === 'high') return item.priority === 'HIGH';
    if (filter === 'pending') return ['SUBMITTED', 'PENDING_DEPT_REVIEW'].includes(item.status);
    return true;
  });

  const unreadCount = filtered.filter((i) => !readIds.has(i.id)).length;

  function markRead(id: string) {
    setReadIds((prev) => new Set(Array.from(prev).concat(id)));
  }

  function markAllRead() {
    setReadIds(new Set(filtered.map((i) => i.id)));
  }

  function getNotifType(item: NotificationItem): {
    icon: string;
    label: string;
    color: string;
  } {
    if (item.priority === 'CRITICAL')
      return { icon: '🚨', label: 'Critical Priority', color: 'border-l-red-500' };
    if (item.priority === 'HIGH')
      return { icon: '⚠️', label: 'High Priority', color: 'border-l-orange-500' };
    if (item.status === 'PENDING_DEPT_REVIEW')
      return { icon: '📋', label: 'Pending Review', color: 'border-l-amber-500' };
    return { icon: '📌', label: 'New Submission', color: 'border-l-blue-500' };
  }

  return (
    <AppShell user={{ name: user.name, role: user.role as any }}>
      <div className="space-y-6">
        <PageHeader
          title="Notifications"
          description="High-priority complaints and items requiring admin attention"
          badge={
            unreadCount > 0 ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-50 text-red-700 border border-red-200">
                <Bell className="w-3 h-3" />
                {unreadCount} unread
              </span>
            ) : undefined
          }
          actions={
            <Button variant="outline" size="sm" onClick={markAllRead}>
              <CheckCheck className="w-4 h-4 mr-2" />
              Mark All Read
            </Button>
          }
        />

        {/* Filter tabs */}
        <div className="flex gap-2 flex-wrap">
          {(
            [
              { key: 'all', label: `All (${items.length})` },
              { key: 'critical', label: `Critical (${items.filter((i) => i.priority === 'CRITICAL').length})` },
              { key: 'high', label: `High (${items.filter((i) => i.priority === 'HIGH').length})` },
              { key: 'pending', label: `Pending (${items.filter((i) => ['SUBMITTED', 'PENDING_DEPT_REVIEW'].includes(i.status)).length})` },
            ] as { key: FilterType; label: string }[]
          ).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors border ${
                filter === tab.key
                  ? 'bg-ic-action text-white border-ic-action shadow-sm'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Notification List */}
        {loading ? (
          <div className="py-20 text-center text-sm text-slate-400">Loading…</div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={BellOff}
            title="No notifications"
            description="No high-priority or pending complaints at this time."
          />
        ) : (
          <div className="space-y-2">
            {filtered.map((item) => {
              const type = getNotifType(item);
              const isRead = readIds.has(item.id);
              return (
                <div
                  key={item.id}
                  className={`bg-white rounded-xl border border-slate-200 border-l-4 ${type.color} shadow-sm p-4 flex items-start gap-4 transition-all ${
                    isRead ? 'opacity-60' : ''
                  }`}
                >
                  <div className="text-2xl shrink-0">{type.icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold text-slate-500">{type.label}</span>
                      <span className="text-xs font-mono text-ic-action">#{item.ticketId}</span>
                      {!isRead && (
                        <span className="w-2 h-2 rounded-full bg-ic-action shrink-0" />
                      )}
                    </div>
                    <div className="text-sm font-semibold text-slate-800 mt-0.5 truncate">
                      {item.title}
                    </div>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <PriorityBadge priority={item.priority} />
                      <StatusBadge status={item.status} />
                      <span className="text-xs text-slate-400">
                        {new Date(item.createdAt).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: '2-digit',
                        })}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {!isRead && (
                      <button
                        onClick={() => markRead(item.id)}
                        className="text-xs text-slate-400 hover:text-slate-700 px-2 py-1 rounded hover:bg-slate-100 transition-colors"
                      >
                        Mark read
                      </button>
                    )}
                    <Link href={`/admin/complaints/${item.id}`}>
                      <Button variant="outline" size="sm" className="text-xs h-7">
                        <ExternalLink className="w-3 h-3 mr-1" />
                        View
                      </Button>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
