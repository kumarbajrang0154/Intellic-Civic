'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Clock, RefreshCw, ShieldAlert, User, UserCheck, UserMinus, UserPlus, Users } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface ActivityEntry {
  id: string;
  action: string;
  actorId: string;
  actorName: string;
  targetId: string | null;
  targetName: string | null;
  metadata: Record<string, any> | null;
  createdAt: string;
}

interface StaffMember {
  id: string;
  name: string;
  email: string;
  role: string | null;
  isActive: boolean;
}

function actionIcon(action: string) {
  const map: Record<string, React.ReactNode> = {
    STAFF_CREATED: <UserPlus className="w-4 h-4 text-emerald-600" />,
    STAFF_DEACTIVATED: <UserMinus className="w-4 h-4 text-rose-600" />,
    STAFF_REACTIVATED: <UserCheck className="w-4 h-4 text-blue-600" />,
    STAFF_REASSIGNED: <Users className="w-4 h-4 text-amber-600" />,
    STAFF_DELETED: <ShieldAlert className="w-4 h-4 text-rose-800" />,
  };
  return map[action] ?? <User className="w-4 h-4 text-slate-500" />;
}

function actionColor(action: string): string {
  const map: Record<string, string> = {
    STAFF_CREATED: 'bg-emerald-100 border-emerald-200',
    STAFF_DEACTIVATED: 'bg-rose-100 border-rose-200',
    STAFF_REACTIVATED: 'bg-blue-100 border-blue-200',
    STAFF_REASSIGNED: 'bg-amber-100 border-amber-200',
    STAFF_DELETED: 'bg-rose-200 border-rose-300',
  };
  return map[action] ?? 'bg-slate-100 border-slate-200';
}

function actionLabel(action: string): string {
  const map: Record<string, string> = {
    STAFF_CREATED: 'Account Created',
    STAFF_DEACTIVATED: 'Account Deactivated',
    STAFF_REACTIVATED: 'Account Reactivated',
    STAFF_REASSIGNED: 'Role / Department Reassigned',
    STAFF_DELETED: 'Account Deleted',
  };
  return map[action] ?? action;
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
}

export default function StaffActivityPage({ params }: { params: { id: string } }) {
  const [staff, setStaff] = useState<StaffMember | null>(null);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function fetchData() {
    setLoading(true); setError('');
    try {
      const [actRes, staffRes] = await Promise.all([
        fetch(`/api/admin/staff/${params.id}/activity`),
        fetch(`/api/admin/staff?search=&limit=100`),
      ]);

      if (actRes.ok) {
        const d = await actRes.json();
        setActivity(d.activity ?? []);
      } else {
        const d = await actRes.json();
        setError(d.message || 'Failed to load activity');
      }

      // Find this staff member's details from the list
      if (staffRes.ok) {
        const d = await staffRes.json();
        const found = d.items?.find((s: StaffMember) => s.id === params.id);
        if (found) setStaff(found);
      }
    } catch {
      setError('Failed to load data.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchData(); }, [params.id]);

  return (
    <AppShell user={{ name: 'Super Admin', role: 'ADMIN' }}>
      <div className="space-y-6 min-w-0">

        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b pb-4">
          <div className="flex items-start gap-3">
            <Link href="/admin/staff">
              <Button variant="outline" size="sm">
                <ArrowLeft className="w-4 h-4 mr-1" /> Back
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                Activity Log
              </h1>
              {staff && (
                <p className="text-sm text-muted-foreground mt-0.5">
                  {staff.name} · {staff.email}
                </p>
              )}
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        </div>

        {/* Summary Card */}
        {staff && (
          <Card className="border shadow-sm">
            <CardContent className="pt-4 pb-3">
              <div className="flex flex-wrap items-center gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground text-xs">Staff ID</span>
                  <div className="font-mono text-xs text-slate-700 mt-0.5">{staff.id}</div>
                </div>
                <div>
                  <span className="text-muted-foreground text-xs">Role</span>
                  <div className="font-semibold text-slate-700 mt-0.5">{staff.role ?? 'Unassigned'}</div>
                </div>
                <div>
                  <span className="text-muted-foreground text-xs">Status</span>
                  <div className="mt-0.5">
                    {staff.isActive ? (
                      <span className="text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-full">Active</span>
                    ) : (
                      <span className="text-[11px] font-semibold bg-rose-100 text-rose-800 border border-rose-200 px-2 py-0.5 rounded-full">Inactive</span>
                    )}
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground text-xs">Total Events</span>
                  <div className="font-bold text-slate-900 mt-0.5">{activity.length}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Error */}
        {error && (
          <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-sm">{error}</div>
        )}

        {/* Timeline */}
        {loading ? (
          <div className="text-center py-16 text-slate-400">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
            Loading activity...
          </div>
        ) : activity.length === 0 ? (
          <Card className="border shadow-sm">
            <CardContent className="py-16 text-center text-slate-400">
              <Clock className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium text-slate-500">No activity recorded yet</p>
              <p className="text-xs mt-1">Actions performed by or on this staff member will appear here</p>
            </CardContent>
          </Card>
        ) : (
          <Card className="border shadow-sm">
            <CardHeader className="pb-0">
              <CardTitle className="text-base font-semibold">Event Timeline</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="relative">
                {/* Vertical line */}
                <div className="absolute left-5 top-0 bottom-0 w-px bg-slate-200" />

                <div className="space-y-4">
                  {activity.map((entry) => (
                    <div key={entry.id} className="flex gap-4 relative">
                      {/* Icon bubble */}
                      <div className={`relative z-10 flex-shrink-0 w-10 h-10 rounded-full border-2 flex items-center justify-center ${actionColor(entry.action)}`}>
                        {actionIcon(entry.action)}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0 pt-1">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                          <p className="font-semibold text-sm text-slate-900">
                            {actionLabel(entry.action)}
                          </p>
                          <span className="text-xs text-slate-400 flex items-center gap-1 flex-shrink-0">
                            <Clock className="w-3 h-3" />
                            {formatDateTime(entry.createdAt)}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          By: <span className="font-medium text-slate-700">{entry.actorName}</span>
                        </p>
                        {entry.metadata && Object.keys(entry.metadata).length > 0 && (
                          <div className="mt-1.5 p-2 bg-slate-50 border border-slate-200 rounded text-xs text-slate-600 font-mono">
                            {Object.entries(entry.metadata).map(([k, v]) => (
                              <div key={k}>
                                <span className="text-slate-400">{k}:</span>{' '}
                                <span>{String(v ?? '—')}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
