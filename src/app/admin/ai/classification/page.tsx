'use client';

import React from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/admin/page-header';
import { FolderTree } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function AiClassificationPage() {
  const [user, setUser] = React.useState({ name: 'Admin', role: 'ADMIN' });

  React.useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((me) => setUser({ name: me.user?.name || 'Admin', role: me.user?.role || 'ADMIN' }))
      .catch(console.error);
  }, []);

  return (
    <AppShell user={{ name: user.name, role: user.role as any }}>
      <div className="space-y-6">
        <PageHeader
          title="AI Classification"
          description="Manage complaint categories used by the AI classification engine"
          actions={
            <Link href="/admin/categories">
              <Button className="bg-ic-action hover:bg-ic-blue text-white border-0" size="sm">
                <FolderTree className="w-4 h-4 mr-2" />
                Open Category Manager
              </Button>
            </Link>
          }
        />

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
              <FolderTree className="w-6 h-6 text-ic-action" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-800 mb-1">
                Category-based AI Classification
              </h2>
              <p className="text-sm text-slate-500 max-w-2xl">
                The IntelliCivic AI engine uses complaint categories to automatically classify
                incoming citizen reports, suggest the correct department, and assign priority
                levels. Managing categories here directly affects AI prediction accuracy.
              </p>
              <div className="mt-4 flex gap-3 flex-wrap">
                <Link href="/admin/categories">
                  <Button variant="outline" size="sm">
                    <FolderTree className="w-4 h-4 mr-2" />
                    Manage Categories
                  </Button>
                </Link>
                <Link href="/admin/ai/performance">
                  <Button variant="outline" size="sm">View AI Performance →</Button>
                </Link>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { icon: '🛣️', label: 'Road Issues' },
            { icon: '💧', label: 'Water Supply' },
            { icon: '⚡', label: 'Electricity' },
            { icon: '🗑️', label: 'Garbage' },
            { icon: '🚰', label: 'Drainage' },
            { icon: '💡', label: 'Street Lighting' },
            { icon: '🏛️', label: 'Public Property' },
            { icon: '📋', label: 'Other' },
          ].map((cat) => (
            <div
              key={cat.label}
              className="bg-ic-light rounded-xl border border-blue-100 p-4 flex items-center gap-3"
            >
              <span className="text-2xl">{cat.icon}</span>
              <span className="text-sm font-medium text-ic-navy">{cat.label}</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-slate-400">
          * Sample categories for reference. Actual categories are configured in the Category Manager.
        </p>
      </div>
    </AppShell>
  );
}
