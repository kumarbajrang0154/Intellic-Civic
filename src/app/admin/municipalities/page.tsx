'use client';

import React, { useCallback, useEffect, useState } from 'react';
import type { UserRole } from '@prisma/client';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/admin/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Landmark, Plus, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

interface MunicipalityItem {
  id: string;
  name: string;
  code: string;
  city: string | null;
  state: string | null;
  onboardingReady: boolean;
  counts: {
    users: number;
    departments: number;
    complaints: number;
  };
}

export default function MunicipalitiesOnboardingPage() {
  const [user, setUser] = useState<{ name: string; role: UserRole }>({ name: 'Admin', role: 'ADMIN' });
  const [items, setItems] = useState<MunicipalityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [starterDepartmentName, setStarterDepartmentName] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [meRes, mRes] = await Promise.all([
        fetch('/api/auth/me'),
        fetch('/api/admin/municipalities'),
      ]);
      if (meRes.ok) {
        const me = await meRes.json();
        setUser({ name: me.user?.name || 'Admin', role: me.user?.role || 'ADMIN' });
      }
      if (mRes.ok) {
        const data = await mRes.json();
        setItems(data.items || []);
      }
    } catch {
      toast.error('Unable to load municipalities.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleOnboard(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/admin/municipalities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          code,
          city,
          state,
          starterDepartmentName: starterDepartmentName || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.message || 'Unable to onboard municipality.');
      }
      toast.success('Municipality tenant provisioned.');
      setName('');
      setCode('');
      setCity('');
      setState('');
      setStarterDepartmentName('');
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Onboarding failed.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell user={user}>
      <div className="space-y-6">
        <PageHeader
          title="Multi-Municipality Onboarding"
          description="Provision isolated municipal tenants, verify readiness, and inspect department/staff counts."
          actions={
            <Button variant="outline" size="sm" onClick={loadData} className="gap-1.5 text-xs">
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          }
        />

        {user.role === 'SUPER_ADMIN' && (
          <form
            onSubmit={handleOnboard}
            className="rounded-xl border border-[#E5E2D9] bg-white p-5 grid grid-cols-1 md:grid-cols-5 gap-3 items-end"
          >
            <div>
              <label className="block text-xs font-medium text-[#464440] mb-1">Municipality Name</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="Madurai Corporation"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#464440] mb-1">Tenant Code</label>
              <Input value={code} onChange={(e) => setCode(e.target.value)} required placeholder="MDU-CORP" />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#464440] mb-1">City</label>
              <Input value={city} onChange={(e) => setCity(e.target.value)} required placeholder="Madurai" />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#464440] mb-1">State</label>
              <Input value={state} onChange={(e) => setState(e.target.value)} required placeholder="Tamil Nadu" />
            </div>
            <div className="flex gap-2">
              <Input
                value={starterDepartmentName}
                onChange={(e) => setStarterDepartmentName(e.target.value)}
                placeholder="Starter Dept (optional)"
              />
              <Button type="submit" disabled={saving} className="shrink-0 gap-1">
                <Plus className="h-4 w-4" />
                {saving ? 'Creating...' : 'Onboard'}
              </Button>
            </div>
          </form>
        )}

        <section className="rounded-xl border border-[#E5E2D9] bg-white p-5">
          {loading ? (
            <p className="text-xs text-[#6E6B64]">Loading municipal tenants...</p>
          ) : items.length === 0 ? (
            <div className="py-10 text-center text-xs text-[#6E6B64] flex flex-col items-center gap-2">
              <Landmark className="h-6 w-6 text-[#A3A098]" />
              <span>No municipalities configured.</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#E5E2D9] text-[#6E6B64]">
                    <th className="py-2 pr-3 font-medium">Code</th>
                    <th className="py-2 px-3 font-medium">Municipality</th>
                    <th className="py-2 px-3 font-medium">City / State</th>
                    <th className="py-2 px-3 font-medium text-right">Departments</th>
                    <th className="py-2 px-3 font-medium text-right">Users</th>
                    <th className="py-2 px-3 font-medium text-right">Complaints</th>
                    <th className="py-2 pl-3 font-medium">Readiness</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F2EFE6]">
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td className="py-2.5 pr-3 font-mono font-semibold text-[#131E20]">{item.code}</td>
                      <td className="py-2.5 px-3 font-medium text-[#131E20]">{item.name}</td>
                      <td className="py-2.5 px-3 text-[#464440]">
                        {item.city || '-'}, {item.state || '-'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono">{item.counts.departments}</td>
                      <td className="py-2.5 px-3 text-right font-mono">{item.counts.users}</td>
                      <td className="py-2.5 px-3 text-right font-mono">{item.counts.complaints}</td>
                      <td className="py-2.5 pl-3">
                        <Badge variant={item.onboardingReady ? 'default' : 'outline'}>
                          {item.onboardingReady ? 'Ready' : 'Needs Department'}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
