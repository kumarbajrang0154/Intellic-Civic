'use client';

import React, { useEffect, useState } from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/admin/page-header';
import { EmptyState } from '@/components/admin/empty-state';
import { Users } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

interface StaffMember {
  id: string;
  name: string;
  email?: string;
  role: string;
  isAuthorized: boolean;
  isSuspended: boolean;
  department?: { name: string };
  createdAt: string;
}

function HeadsPage() {
  const [heads, setHeads] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState({ name: 'Admin', role: 'ADMIN' });

  useEffect(() => {
    async function load() {
      try {
        const [staffRes, meRes] = await Promise.all([
          fetch('/api/admin/staff?role=DEPARTMENT_HEAD'),
          fetch('/api/auth/me'),
        ]);
        if (staffRes.ok) {
          const data = await staffRes.json();
          setHeads(data.staff || data || []);
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

  const filtered = heads.filter((h) => h.role === 'DEPARTMENT_HEAD');

  return (
    <AppShell user={{ name: user.name, role: user.role as any }}>
      <div className="space-y-6">
        <PageHeader
          title="Department Heads"
          description="All staff members assigned to the DEPARTMENT_HEAD role"
          actions={
            <Link href="/admin/staff">
              <Button size="sm">Manage All Staff</Button>
            </Link>
          }
        />

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {loading ? (
            <div className="py-20 text-center text-sm text-slate-400">Loading…</div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No Department Heads"
              description="No staff members with the Department Head role exist yet."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    {['Name', 'Email', 'Department', 'Status', 'Joined', 'Actions'].map(
                      (h) => (
                        <th
                          key={h}
                          className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide"
                        >
                          {h}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-slate-800">{s.name}</td>
                      <td className="px-4 py-3 text-slate-500 text-xs">{s.email ?? '—'}</td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {s.department?.name ?? 'Unassigned'}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                            s.isSuspended
                              ? 'bg-red-50 text-red-700'
                              : s.isAuthorized
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-amber-50 text-amber-700'
                          }`}
                        >
                          {s.isSuspended
                            ? 'Suspended'
                            : s.isAuthorized
                            ? 'Active'
                            : 'Pending'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-400">
                        {new Date(s.createdAt).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: '2-digit',
                        })}
                      </td>
                      <td className="px-4 py-3">
                        <Link href={`/admin/staff/${s.id}/activity`}>
                          <Button variant="outline" size="sm" className="text-xs h-7">
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

export default HeadsPage;
