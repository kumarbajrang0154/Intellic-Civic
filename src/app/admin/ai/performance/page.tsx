'use client';

import React, { useEffect, useState } from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/admin/page-header';
import { StatCard } from '@/components/admin/stat-card';
import { Bot, CheckCircle2, TrendingUp, XCircle } from 'lucide-react';

interface Complaint {
  status: string;
  priority: string | null;
  categoryId: string | null;
  aiPrediction?: {
    isRejected: boolean;
    suggestedPriority?: string;
    confidenceScore?: number;
    suggestedCategory?: { name: string };
    suggestedDepartment?: { name: string };
  };
  category?: { name: string };
  department?: { name: string };
}

export default function AiPerformancePage() {
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState({ name: 'Admin', role: 'ADMIN' });

  useEffect(() => {
    async function load() {
      try {
        const [cRes, meRes] = await Promise.all([
          fetch('/api/complaints?limit=500'),
          fetch('/api/auth/me'),
        ]);
        if (cRes.ok) {
          const data = await cRes.json();
          setComplaints(data.data || data.complaints || []);
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

  const withAi = complaints.filter((c) => c.aiPrediction);
  const total = withAi.length;
  const accepted = withAi.filter((c) => !c.aiPrediction?.isRejected).length;
  const rejected = withAi.filter((c) => c.aiPrediction?.isRejected).length;
  const avgConf =
    total > 0
      ? Math.round(
          (withAi.reduce((s, c) => s + (c.aiPrediction?.confidenceScore ?? 0), 0) / total) * 100,
        )
      : 0;
  const acceptanceRate = total > 0 ? Math.round((accepted / total) * 100) : 0;

  // Confidence score distribution
  const confBuckets = [
    { label: '>= 80%', min: 0.8, max: 1, color: 'bg-emerald-400' },
    { label: '60-79%', min: 0.6, max: 0.8, color: 'bg-amber-400' },
    { label: '< 60%', min: 0, max: 0.6, color: 'bg-red-400' },
  ];
  const confDist = confBuckets.map((b) => ({
    ...b,
    count: withAi.filter(
      (c) =>
        (c.aiPrediction?.confidenceScore ?? 0) >= b.min &&
        (c.aiPrediction?.confidenceScore ?? 0) < b.max,
    ).length,
  }));
  const confMax = Math.max(...confDist.map((b) => b.count), 1);

  return (
    <AppShell user={{ name: user.name, role: user.role as any }}>
      <div className="space-y-6">
        <PageHeader
          title="AI Performance"
          description="Accuracy metrics, confidence score distribution, and classification review data"
        />

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="AI Processed"
            value={loading ? '—' : total}
            description="Complaints run through AI"
            icon={Bot}
            iconColor="text-ic-action"
            iconBg="bg-blue-50"
          />
          <StatCard
            title="Accepted"
            value={loading ? '—' : accepted}
            description={`${acceptanceRate}% acceptance rate`}
            icon={CheckCircle2}
            iconColor="text-emerald-600"
            iconBg="bg-emerald-50"
          />
          <StatCard
            title="Rejected / Overridden"
            value={loading ? '—' : rejected}
            description="Manual corrections"
            icon={XCircle}
            iconColor="text-red-600"
            iconBg="bg-red-50"
          />
          <StatCard
            title="Avg. Confidence"
            value={loading ? '—' : `${avgConf}%`}
            description="Mean score across all AI predictions"
            icon={TrendingUp}
            iconColor="text-amber-600"
            iconBg="bg-amber-50"
          />
        </div>

        {/* Confidence distribution */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <h2 className="text-base font-semibold text-slate-800 mb-1">Confidence Score Distribution</h2>
          <p className="text-xs text-slate-400 mb-5">
            How confident the AI was when making predictions
          </p>
          <div className="flex items-end gap-8 h-32">
            {confDist.map((b) => (
              <div key={b.label} className="flex-1 flex flex-col items-center gap-2">
                <div className="w-full flex items-end justify-center" style={{ height: '90px' }}>
                  <div
                    className={`w-full rounded-t transition-all duration-500 ${b.color}`}
                    style={{
                      height: `${Math.round((b.count / confMax) * 90)}px`,
                      minHeight: b.count > 0 ? '6px' : '0',
                    }}
                  />
                </div>
                <div className="text-center">
                  <div className="text-sm font-bold text-slate-700">{b.count}</div>
                  <div className="text-[10px] text-slate-400">{b.label}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Acceptance Rate Ring */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <h2 className="text-base font-semibold text-slate-800 mb-4">Prediction Acceptance</h2>
          <div className="flex flex-col sm:flex-row gap-6 items-start sm:items-center">
            <div className="flex flex-col items-center gap-1">
              <div
                className="w-28 h-28 rounded-full"
                style={{
                  background: `conic-gradient(#10b981 0% ${acceptanceRate}%, #ef4444 ${acceptanceRate}% 100%)`,
                  WebkitMask: 'radial-gradient(circle at center, transparent 36%, black 37%)',
                  mask: 'radial-gradient(circle at center, transparent 36%, black 37%)',
                }}
              />
              <div className="text-2xl font-bold text-slate-800">{acceptanceRate}%</div>
              <div className="text-xs text-slate-400">Acceptance Rate</div>
            </div>
            <div className="space-y-3 flex-1">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-sm bg-emerald-400 shrink-0" />
                <span className="text-sm text-slate-600">AI suggestions accepted by department heads</span>
                <span className="ml-auto font-semibold text-slate-800">{accepted}</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-sm bg-red-400 shrink-0" />
                <span className="text-sm text-slate-600">Overridden (manual corrections)</span>
                <span className="ml-auto font-semibold text-slate-800">{rejected}</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-sm bg-slate-300 shrink-0" />
                <span className="text-sm text-slate-600">Total AI-processed complaints</span>
                <span className="ml-auto font-semibold text-slate-800">{total}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
