'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Building2, RefreshCw, ShieldAlert, User, Users } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface DeptWorkload {
  departmentId: string;
  departmentName: string;
  heads: number;
  officers: number;
  fieldWorkers: number;
  totalStaff: number;
  inactiveStaff: number;
}

function StatBox({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div className={`p-3 rounded-lg border text-center ${color}`}>
      <div className="text-xl font-bold">{value}</div>
      <div className="text-xs font-medium mt-0.5">{label}</div>
    </div>
  );
}

export default function WorkloadPage() {
  const [workload, setWorkload] = useState<DeptWorkload[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function fetchWorkload() {
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/admin/staff/workload-summary');
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.message || 'Failed to load workload');
      }
      const d = await res.json();
      setWorkload(d.workload ?? []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchWorkload(); }, []);

  const totals = workload.reduce(
    (acc, d) => ({
      heads: acc.heads + d.heads,
      officers: acc.officers + d.officers,
      fieldWorkers: acc.fieldWorkers + d.fieldWorkers,
      total: acc.total + d.totalStaff,
      inactive: acc.inactive + d.inactiveStaff,
    }),
    { heads: 0, officers: 0, fieldWorkers: 0, total: 0, inactive: 0 },
  );

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
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                Department Workload Summary
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                Staff distribution by department and role across the platform
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={fetchWorkload} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        </div>

        {/* Platform-wide summary */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <Card className="border shadow-sm col-span-2 sm:col-span-1">
            <CardContent className="pt-4 pb-3 text-center">
              <div className="text-3xl font-bold text-slate-900">{totals.total}</div>
              <div className="text-xs text-muted-foreground mt-1 font-medium">Total Staff</div>
            </CardContent>
          </Card>
          <Card className="border shadow-sm">
            <CardContent className="pt-4 pb-3 text-center">
              <div className="text-3xl font-bold text-blue-700">{totals.heads}</div>
              <div className="text-xs text-muted-foreground mt-1 font-medium">Dept Heads</div>
            </CardContent>
          </Card>
          <Card className="border shadow-sm">
            <CardContent className="pt-4 pb-3 text-center">
              <div className="text-3xl font-bold text-sky-700">{totals.officers}</div>
              <div className="text-xs text-muted-foreground mt-1 font-medium">Officers</div>
            </CardContent>
          </Card>
          <Card className="border shadow-sm">
            <CardContent className="pt-4 pb-3 text-center">
              <div className="text-3xl font-bold text-amber-700">{totals.fieldWorkers}</div>
              <div className="text-xs text-muted-foreground mt-1 font-medium">Field Workers</div>
            </CardContent>
          </Card>
          <Card className="border shadow-sm">
            <CardContent className="pt-4 pb-3 text-center">
              <div className="text-3xl font-bold text-rose-700">{totals.inactive}</div>
              <div className="text-xs text-muted-foreground mt-1 font-medium">Inactive</div>
            </CardContent>
          </Card>
        </div>

        {/* Error */}
        {error && (
          <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-sm flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0" /> {error}
          </div>
        )}

        {/* Department Cards */}
        {loading ? (
          <div className="text-center py-16 text-slate-400">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
            Loading workload data...
          </div>
        ) : workload.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <Building2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p>No departments found</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {workload.map((dept) => {
              const activeStaff = dept.totalStaff - dept.inactiveStaff;
              const inactivePercent = dept.totalStaff > 0 ? Math.round((dept.inactiveStaff / dept.totalStaff) * 100) : 0;

              return (
                <Card key={dept.departmentId} className={`border shadow-sm ${dept.totalStaff === 0 ? 'opacity-60' : ''}`}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-5 h-5 text-blue-600 shrink-0" />
                        <CardTitle className="text-base font-bold text-slate-900 leading-tight">
                          {dept.departmentName}
                        </CardTitle>
                      </div>
                      {dept.totalStaff === 0 && (
                        <span className="text-[11px] font-semibold bg-slate-100 text-slate-500 border px-2 py-0.5 rounded-full shrink-0">
                          No Staff
                        </span>
                      )}
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    {/* Staff role breakdown */}
                    <div className="grid grid-cols-3 gap-2">
                      <StatBox value={dept.heads} label="Heads" color="bg-blue-50 border-blue-200 text-blue-900" />
                      <StatBox value={dept.officers} label="Officers" color="bg-sky-50 border-sky-200 text-sky-900" />
                      <StatBox value={dept.fieldWorkers} label="Field" color="bg-amber-50 border-amber-200 text-amber-900" />
                    </div>

                    {/* Active vs Inactive bar */}
                    {dept.totalStaff > 0 && (
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs text-slate-600">
                          <span className="flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            {activeStaff} active / {dept.inactiveStaff} inactive
                          </span>
                          {inactivePercent > 0 && (
                            <span className="text-rose-600 font-medium">{inactivePercent}% inactive</span>
                          )}
                        </div>
                        <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-emerald-500 rounded-full transition-all"
                            style={{ width: `${100 - inactivePercent}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Action */}
                    <div className="pt-2 border-t">
                      <Link href={`/admin/staff?departmentId=${dept.departmentId}`}>
                        <Button variant="outline" size="sm" className="w-full text-xs">
                          <User className="w-3.5 h-3.5 mr-1.5" />
                          View Department Staff
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
