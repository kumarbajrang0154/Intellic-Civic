'use client';

import React, { useEffect, useState } from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/admin/page-header';
import { EmptyState } from '@/components/admin/empty-state';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, ShieldCheck, UserPlus } from 'lucide-react';
import Link from 'next/link';

interface AdminAccount {
  id: string;
  name: string;
  email?: string;
  role: string;
  isAuthorized: boolean;
  isSuspended: boolean;
  department?: { name: string };
  createdAt: string;
}

const ROLE_LABELS: Record<string, { label: string; color: string }> = {
  SUPER_ADMIN: { label: 'Super Admin', color: 'bg-indigo-100 text-indigo-950 border-indigo-300 font-semibold' },
  ADMIN: { label: 'Admin', color: 'bg-indigo-100 text-indigo-950 border-indigo-300 font-semibold' },
  DEPARTMENT_HEAD: { label: 'Dept. Head', color: 'bg-purple-100 text-purple-950 border-purple-300 font-semibold' },
  DEPARTMENT_OFFICER: { label: 'Officer', color: 'bg-emerald-100 text-emerald-950 border-emerald-300 font-semibold' },
};

export default function AdminAccountsPage() {
  const [accounts, setAccounts] = useState<AdminAccount[]>([]);
  const [filtered, setFiltered] = useState<AdminAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [user, setUser] = useState({ name: 'Admin', role: 'ADMIN' });

  useEffect(() => {
    async function load() {
      try {
        const [staffRes, meRes] = await Promise.all([
          fetch('/api/admin/staff'),
          fetch('/api/auth/me'),
        ]);
        if (staffRes.ok) {
          const data = await staffRes.json();
          const all: AdminAccount[] = data.items || data.staff || [];
          setAccounts(all);
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
      accounts.filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          a.email?.toLowerCase().includes(q) ||
          a.role.toLowerCase().includes(q) ||
          a.department?.name.toLowerCase().includes(q),
      ),
    );
  }, [search, accounts]);

  return (
    <AppShell user={{ name: user.name, role: user.role as any }}>
      <div className="space-y-6">
        <PageHeader
          title="Admin Accounts"
          description="Super Admins, Admins, Department Heads, and Officers"
          actions={
            <Link href="/admin/staff">
              <Button size="sm" className="bg-ic-action hover:bg-ic-blue text-white border-0">
                <UserPlus className="w-4 h-4 mr-2" />
                Create Staff Account
              </Button>
            </Link>
          }
        />

        <div className="flex items-center justify-between gap-4">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              className="pl-9"
              placeholder="Search name, email, role..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <span className="text-sm text-slate-500 shrink-0">
            {filtered.length} account{filtered.length !== 1 ? 's' : ''}
          </span>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {loading ? (
            <div className="py-20 text-center text-sm text-slate-400">Loading…</div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={ShieldCheck}
              title="No admin accounts found"
              description="Create your first staff account from the Staff Management page."
              action={
                <Link href="/admin/staff">
                  <Button size="sm">Go to Staff Management</Button>
                </Link>
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    {['Name', 'Email', 'Role', 'Department', 'Status', 'Joined', 'Actions'].map(
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
                  {filtered.map((a) => {
                    const roleInfo = ROLE_LABELS[a.role] ?? {
                      label: a.role,
                      color: 'bg-slate-100 text-slate-600 border-slate-200',
                    };
                    return (
                      <tr key={a.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 font-medium text-slate-800">{a.name}</td>
                        <td className="px-4 py-3 text-slate-500 text-xs">{a.email ?? '—'}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border ${roleInfo.color}`}
                          >
                            {roleInfo.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500">
                          {a.department?.name ?? 'Unassigned'}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                              a.isSuspended
                                ? 'bg-rose-100 text-rose-950 border-rose-300'
                                : a.isAuthorized
                                ? 'bg-emerald-100 text-emerald-950 border-emerald-300'
                                : 'bg-amber-100 text-amber-950 border-amber-300'
                            }`}
                          >
                            {a.isSuspended ? 'Suspended' : a.isAuthorized ? 'Active' : 'Pending'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-400">
                          {new Date(a.createdAt).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: '2-digit',
                          })}
                        </td>
                        <td className="px-4 py-3">
                          <Link href={`/admin/staff/${a.id}/activity`}>
                            <Button variant="outline" size="sm" className="text-xs h-7">
                              View
                            </Button>
                          </Link>
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
