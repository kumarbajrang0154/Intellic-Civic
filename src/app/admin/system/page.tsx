'use client';

import React, { useEffect, useState } from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/admin/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import {
  Clock,
  Edit3,
  FolderTree,
  ListChecks,
  Save,
  Settings,
  ShieldCheck,
  Workflow,
} from 'lucide-react';
import Link from 'next/link';

type SystemTab = 'categories' | 'priority' | 'workflow' | 'sla';

interface SlaRule {
  id: string;
  priority: string;
  resolutionHours: number;
  label: string;
  isActive: boolean;
}

const STATUS_FLOW = [
  { status: 'SUBMITTED', next: ['AI_PROCESSING', 'PENDING_DEPT_REVIEW'], color: 'bg-slate-200 text-slate-700' },
  { status: 'AI_PROCESSING', next: ['PENDING_DEPT_REVIEW'], color: 'bg-purple-100 text-purple-700' },
  { status: 'PENDING_DEPT_REVIEW', next: ['ASSIGNED', 'REJECTED'], color: 'bg-amber-100 text-amber-700' },
  { status: 'ASSIGNED', next: ['IN_PROGRESS', 'REJECTED'], color: 'bg-blue-100 text-blue-700' },
  { status: 'IN_PROGRESS', next: ['RESOLVED', 'ASSIGNED'], color: 'bg-indigo-100 text-indigo-700' },
  { status: 'RESOLVED', next: ['CLOSED', 'ASSIGNED'], color: 'bg-emerald-100 text-emerald-700' },
  { status: 'CLOSED', next: [], color: 'bg-gray-100 text-gray-600' },
  { status: 'REJECTED', next: [], color: 'bg-red-100 text-red-700' },
  { status: 'DUPLICATE', next: [], color: 'bg-orange-100 text-orange-700' },
];

const PRIORITY_RULES = [
  { priority: 'CRITICAL', description: 'Life-threatening or infrastructure-critical issues', examples: 'Sewage overflow, road collapse, burst main pipeline', color: 'border-l-red-500 bg-red-50' },
  { priority: 'HIGH', description: 'Significant issues affecting many citizens', examples: 'Major pothole on arterial road, large area power outage', color: 'border-l-orange-500 bg-orange-50' },
  { priority: 'MEDIUM', description: 'Moderate issues causing inconvenience', examples: 'Street light out, minor pothole, garbage not collected', color: 'border-l-amber-500 bg-amber-50' },
  { priority: 'LOW', description: 'Minor cosmetic or non-urgent issues', examples: 'Faded road markings, minor drainage issue', color: 'border-l-slate-400 bg-slate-50' },
];

const DEFAULT_SLA: SlaRule[] = [
  { id: 'CRITICAL', priority: 'CRITICAL', resolutionHours: 24, label: '24 hours', isActive: true },
  { id: 'HIGH', priority: 'HIGH', resolutionHours: 72, label: '3 days', isActive: true },
  { id: 'MEDIUM', priority: 'MEDIUM', resolutionHours: 168, label: '7 days', isActive: true },
  { id: 'LOW', priority: 'LOW', resolutionHours: 336, label: '14 days', isActive: true },
];

export default function SystemManagementPage() {
  const [activeTab, setActiveTab] = useState<SystemTab>('sla');
  const [slaRules, setSlaRules] = useState<SlaRule[]>(DEFAULT_SLA);
  const [slaEdit, setSlaEdit] = useState<Record<string, number>>({});
  const [savingSla, setSavingSla] = useState(false);
  const [user, setUser] = useState({ name: 'Admin', role: 'ADMIN' });

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((me) => setUser({ name: me.user?.name || 'Admin', role: me.user?.role || 'ADMIN' }))
      .catch(console.error);

    // Load SLA rules
    fetch('/api/admin/sla')
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.rules?.length > 0) {
          setSlaRules(data.rules);
          const editMap: Record<string, number> = {};
          data.rules.forEach((r: SlaRule) => { editMap[r.priority] = r.resolutionHours; });
          setSlaEdit(editMap);
        } else {
          const editMap: Record<string, number> = {};
          DEFAULT_SLA.forEach((r) => { editMap[r.priority] = r.resolutionHours; });
          setSlaEdit(editMap);
        }
      })
      .catch(() => {
        const editMap: Record<string, number> = {};
        DEFAULT_SLA.forEach((r) => { editMap[r.priority] = r.resolutionHours; });
        setSlaEdit(editMap);
      });
  }, []);

  async function saveSla() {
    setSavingSla(true);
    try {
      const res = await fetch('/api/admin/sla', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rules: slaEdit }),
      });
      if (res.ok) {
        toast.success('SLA rules updated successfully');
        // Refresh
        const data = await res.json();
        if (data.rules) setSlaRules(data.rules);
      } else {
        toast.error('Failed to save SLA rules');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setSavingSla(false);
    }
  }

  const tabs = [
    { key: 'sla', label: 'SLA Management', icon: Clock },
    { key: 'categories', label: 'Categories', icon: FolderTree },
    { key: 'priority', label: 'Priority Rules', icon: ShieldCheck },
    { key: 'workflow', label: 'Status Workflow', icon: Workflow },
  ] as { key: SystemTab; label: string; icon: React.ComponentType<any> }[];

  return (
    <AppShell user={{ name: user.name, role: user.role as any }}>
      <div className="space-y-6">
        <PageHeader
          title="System Management"
          description="Configure complaint categories, priority rules, SLA targets, and status workflows"
        />

        {/* Tabs */}
        <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-full overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                  activeTab === tab.key
                    ? 'bg-white text-ic-navy shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* SLA Management */}
        {activeTab === 'sla' && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="text-base font-semibold text-slate-800">SLA Resolution Targets</h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Set the maximum allowed resolution time per priority level
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={saveSla}
                  disabled={savingSla}
                  className="bg-ic-action hover:bg-ic-blue text-white border-0"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {savingSla ? 'Saving…' : 'Save SLA Rules'}
                </Button>
              </div>

              <div className="space-y-4">
                {slaRules.map((rule) => (
                  <div
                    key={rule.priority}
                    className={`border-l-4 rounded-r-xl p-4 ${
                      rule.priority === 'CRITICAL'
                        ? 'border-l-red-500 bg-red-50'
                        : rule.priority === 'HIGH'
                        ? 'border-l-orange-500 bg-orange-50'
                        : rule.priority === 'MEDIUM'
                        ? 'border-l-amber-500 bg-amber-50'
                        : 'border-l-slate-400 bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                      <div>
                        <div className="font-semibold text-sm text-slate-800">
                          {rule.priority}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          Current target: {rule.label}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min={1}
                          value={slaEdit[rule.priority] ?? rule.resolutionHours}
                          onChange={(e) =>
                            setSlaEdit((prev) => ({
                              ...prev,
                              [rule.priority]: parseInt(e.target.value) || rule.resolutionHours,
                            }))
                          }
                          className="w-24 text-sm"
                        />
                        <span className="text-sm text-slate-500 whitespace-nowrap">hours</span>
                        <span className="text-xs text-slate-400 whitespace-nowrap">
                          (
                          {(slaEdit[rule.priority] ?? rule.resolutionHours) >= 24
                            ? `${Math.round((slaEdit[rule.priority] ?? rule.resolutionHours) / 24)} day${Math.round((slaEdit[rule.priority] ?? rule.resolutionHours) / 24) !== 1 ? 's' : ''}`
                            : `${slaEdit[rule.priority] ?? rule.resolutionHours}h`}
                          )
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Categories */}
        {activeTab === 'categories' && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-800">Complaint Categories</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Manage the AI classification categories for civic complaints
                </p>
              </div>
              <Link href="/admin/categories">
                <Button size="sm" variant="outline">
                  <FolderTree className="w-4 h-4 mr-2" />
                  Open Category Manager
                </Button>
              </Link>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {[
                'Road Issues',
                'Water Supply',
                'Electricity',
                'Garbage & Sanitation',
                'Drainage Issues',
                'Street Lighting',
                'Public Property',
                'Other',
              ].map((cat) => (
                <div
                  key={cat}
                  className="flex items-center gap-2 p-3 rounded-lg bg-slate-50 border border-slate-200 text-sm text-slate-700"
                >
                  <FolderTree className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  {cat}
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-400 mt-2">
              * These are common examples. Actual categories are managed via the Category Manager.
            </p>
          </div>
        )}

        {/* Priority Rules */}
        {activeTab === 'priority' && (
          <div className="space-y-4">
            {PRIORITY_RULES.map((rule) => (
              <div
                key={rule.priority}
                className={`border-l-4 rounded-r-xl p-5 ${rule.color}`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <ShieldCheck className="w-4 h-4" />
                  <span className="font-bold text-sm">{rule.priority}</span>
                </div>
                <p className="text-sm text-slate-700 mb-1">{rule.description}</p>
                <p className="text-xs text-slate-500">
                  <strong>Examples:</strong> {rule.examples}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Status Workflow */}
        {activeTab === 'workflow' && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <h2 className="text-base font-semibold text-slate-800 mb-4">
              Complaint Status Workflow
            </h2>
            <div className="space-y-3">
              {STATUS_FLOW.map((step) => (
                <div key={step.status} className="flex items-start gap-3">
                  <span
                    className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium min-w-[160px] ${step.color}`}
                  >
                    {step.status}
                  </span>
                  {step.next.length > 0 ? (
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-slate-400 text-sm">→</span>
                      {step.next.map((n) => (
                        <span
                          key={n}
                          className="px-2 py-0.5 text-xs bg-slate-100 text-slate-600 rounded border border-slate-200"
                        >
                          {n}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-xs text-slate-400 italic">Terminal state</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
