'use client';

import React, { useCallback, useEffect, useState } from 'react';
import type { UserRole } from '@prisma/client';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/admin/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Building2, Plus, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

interface ContractorItem {
  id: string;
  name: string;
  companyName: string;
  registrationCode: string;
  specialty: string;
  contactEmail?: string | null;
  isActive: boolean;
  department?: { name: string } | null;
  _count?: { workOrders: number };
}

export default function ContractorsPage() {
  const [user, setUser] = useState<{ name: string; role: UserRole }>({ name: 'Admin', role: 'ADMIN' });
  const [items, setItems] = useState<ContractorItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [registrationCode, setRegistrationCode] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [contactEmail, setContactEmail] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [meRes, cRes] = await Promise.all([
        fetch('/api/auth/me'),
        fetch('/api/admin/contractors'),
      ]);
      if (meRes.ok) {
        const me = await meRes.json();
        setUser({ name: me.user?.name || 'Admin', role: me.user?.role || 'ADMIN' });
      }
      if (cRes.ok) {
        const data = await cRes.json();
        setItems(data.items || []);
      }
    } catch {
      toast.error('Unable to load contractors.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/admin/contractors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          companyName,
          registrationCode,
          specialty,
          contactEmail: contactEmail || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.message || 'Unable to register contractor.');
      }
      toast.success('Contractor registered.');
      setName('');
      setCompanyName('');
      setRegistrationCode('');
      setSpecialty('');
      setContactEmail('');
      await loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Unable to register contractor.');
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(item: ContractorItem) {
    try {
      const res = await fetch(`/api/admin/contractors/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !item.isActive }),
      });
      if (!res.ok) {
        throw new Error('Update failed');
      }
      await loadData();
    } catch {
      toast.error('Failed to update contractor status.');
    }
  }

  return (
    <AppShell user={user}>
      <div className="space-y-6">
        <PageHeader
          title="Contractor Management"
          description="Register municipal external contractors and manage work-order availability."
          actions={
            <Button variant="outline" size="sm" onClick={loadData} className="gap-1.5 text-xs">
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          }
        />

        <form
          onSubmit={handleCreate}
          className="rounded-xl border border-[#E5E2D9] bg-white p-5 grid grid-cols-1 md:grid-cols-5 gap-3 items-end"
        >
          <div>
            <label className="block text-xs font-medium text-[#464440] mb-1">Contact Name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required placeholder="R. Kumar" />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#464440] mb-1">Company</label>
            <Input
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              required
              placeholder="Civic Roads Infra"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#464440] mb-1">Reg. Code</label>
            <Input
              value={registrationCode}
              onChange={(e) => setRegistrationCode(e.target.value)}
              required
              placeholder="CNT-ROAD-01"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#464440] mb-1">Specialty</label>
            <Input
              value={specialty}
              onChange={(e) => setSpecialty(e.target.value)}
              required
              placeholder="Road & Asphalt"
            />
          </div>
          <div className="flex gap-2">
            <Input
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              placeholder="ops@company.in"
            />
            <Button type="submit" disabled={saving} className="shrink-0 gap-1">
              <Plus className="h-4 w-4" />
              {saving ? 'Adding...' : 'Add'}
            </Button>
          </div>
        </form>

        <section className="rounded-xl border border-[#E5E2D9] bg-white p-5">
          {loading ? (
            <p className="text-xs text-[#6E6B64]">Loading contractors...</p>
          ) : items.length === 0 ? (
            <div className="py-10 text-center text-xs text-[#6E6B64] flex flex-col items-center gap-2">
              <Building2 className="h-6 w-6 text-[#A3A098]" />
              <span>No contractors registered yet.</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#E5E2D9] text-[#6E6B64]">
                    <th className="py-2 pr-3 font-medium">Code</th>
                    <th className="py-2 px-3 font-medium">Company</th>
                    <th className="py-2 px-3 font-medium">Contact</th>
                    <th className="py-2 px-3 font-medium">Specialty</th>
                    <th className="py-2 px-3 font-medium text-right">Work Orders</th>
                    <th className="py-2 px-3 font-medium">Status</th>
                    <th className="py-2 pl-3 font-medium text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F2EFE6]">
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td className="py-2.5 pr-3 font-mono font-semibold text-[#131E20]">
                        {item.registrationCode}
                      </td>
                      <td className="py-2.5 px-3 font-medium text-[#131E20]">{item.companyName}</td>
                      <td className="py-2.5 px-3 text-[#464440]">{item.name}</td>
                      <td className="py-2.5 px-3 text-[#464440]">{item.specialty}</td>
                      <td className="py-2.5 px-3 text-right font-mono">{item._count?.workOrders ?? 0}</td>
                      <td className="py-2.5 px-3">
                        <Badge variant={item.isActive ? 'default' : 'outline'}>
                          {item.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td className="py-2.5 pl-3 text-right">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => toggleStatus(item)}
                          className="h-7 text-xs"
                        >
                          {item.isActive ? 'Deactivate' : 'Activate'}
                        </Button>
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
