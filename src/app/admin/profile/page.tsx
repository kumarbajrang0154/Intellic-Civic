'use client';

import React from 'react';
import { ShieldCheck, User } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function AdminProfilePage() {
  return (
    <AppShell user={{ name: 'Super Admin', role: 'ADMIN' }}>
      <div className="space-y-6 p-6 max-w-4xl mx-auto">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Super Admin Profile
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            System Administrator credentials & platform scope
          </p>
        </div>

        <Card className="border shadow-sm bg-white">
          <CardHeader className="flex flex-row items-center gap-4">
            <div className="w-14 h-14 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-700 font-bold text-xl">
              SA
            </div>
            <div>
              <CardTitle className="text-xl font-bold text-slate-900">
                Super Admin Account
              </CardTitle>
              <p className="text-sm text-slate-500">admin@city.gov</p>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 pt-4 border-t text-sm">
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-slate-500">System Role:</span>
              <span className="font-bold text-indigo-700 bg-indigo-50 px-3 py-1 rounded-full text-xs">
                SUPER_ADMIN (ADMIN)
              </span>
            </div>
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-slate-500">Department Scope:</span>
              <span className="font-semibold text-slate-800">Unrestricted (System-Wide)</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-slate-500">Platform Permissions:</span>
              <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-1 rounded">
                Full Governance & Approval Rights
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
