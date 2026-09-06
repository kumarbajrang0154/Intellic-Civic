'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ArrowLeft,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  FileText,
  MapPin,
  RefreshCw,
  Sparkles,
  User,
  ShieldCheck,
  AlertTriangle,
  Tag,
  Phone,
  Mail,
} from 'lucide-react';
import { AppShell } from '@/components/shared/app-shell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { AICard } from '@/components/ui/ai-card';
import { EvidenceTimeline, EvidenceItem } from '@/components/ui/evidence-timeline';

interface Department {
  id: string;
  name: string;
}

interface ComplaintDetail {
  id: string;
  ticketId: string;
  title: string;
  description: string;
  status: string;
  priority: string | null;
  createdAt: string;
  resolvedAt?: string | null;
  departmentId?: string | null;
  department?: { id: string; name: string };
  category?: { name: string };
  citizen?: { name: string; email: string; mobileNumber?: string };
  location?: { address?: string; latitude?: number; longitude?: number };
  aiPrediction?: {
    id: string;
    confidenceScore?: number;
    rawResponse?: any;
    isRejected?: boolean;
    suggestedDepartment?: { name: string };
    suggestedCategory?: { name: string };
  };
  assignment?: {
    assignedAt: string;
    departmentOfficer?: { name: string; email: string };
  };
  evidence?: Array<{
    id: string;
    stage: string;
    imageUrl: string;
    uploadedAt: string;
    notes?: string | null;
    uploadedByName?: string | null;
  }>;
  statusHistory?: Array<{
    id: string;
    fromStatus: string | null;
    toStatus: string;
    changedAt: string;
  }>;
}

const STATUS_BADGES: Record<string, { bg: string; text: string }> = {
  SUBMITTED: { bg: 'bg-blue-50 text-blue-700 border-blue-200', text: 'Submitted' },
  PENDING_TRIAGE: { bg: 'bg-purple-50 text-purple-700 border-purple-200', text: 'Pending AI Triage' },
  DEPARTMENT_PENDING: { bg: 'bg-amber-50 text-amber-700 border-amber-200', text: 'Dept Action Needed' },
  ASSIGNED: { bg: 'bg-sky-50 text-sky-700 border-sky-200', text: 'Assigned to Field' },
  IN_PROGRESS: { bg: 'bg-indigo-50 text-indigo-700 border-indigo-200', text: 'In Progress' },
  RESOLVED: { bg: 'bg-emerald-50 text-emerald-700 border-emerald-200', text: 'Resolved' },
  REJECTED: { bg: 'bg-rose-50 text-rose-700 border-rose-200', text: 'Rejected' },
};

const PRIORITY_BADGES: Record<string, { bg: string; text: string }> = {
  EMERGENCY: { bg: 'bg-rose-100 text-rose-800 font-bold border-rose-300', text: 'EMERGENCY' },
  HIGH: { bg: 'bg-amber-100 text-amber-800 font-semibold border-amber-300', text: 'HIGH' },
  MEDIUM: { bg: 'bg-blue-100 text-blue-800 font-medium border-blue-300', text: 'MEDIUM' },
  LOW: { bg: 'bg-slate-100 text-slate-700 border-slate-300', text: 'LOW' },
};

export default function AdminComplaintDetailPage() {
  const params = useParams();
  const complaintId = params?.id as string;

  const [complaint, setComplaint] = useState<ComplaintDetail | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDeptId, setSelectedDeptId] = useState<string>('');
  const [reassigning, setReassigning] = useState(false);

  useEffect(() => {
    if (complaintId) {
      fetchDetail();
    }
  }, [complaintId]);

  async function fetchDetail() {
    setLoading(true);
    try {
      const [cRes, dRes] = await Promise.all([
        fetch(`/api/complaints/${complaintId}`),
        fetch('/api/departments'),
      ]);

      if (cRes.ok) {
        const cData = await cRes.json();
        setComplaint(cData);
        setSelectedDeptId(cData.departmentId || '');
      }
      if (dRes.ok) {
        const dData = await dRes.json();
        setDepartments(Array.isArray(dData) ? dData : dData.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch complaint detail:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleReassignDepartment() {
    if (!selectedDeptId || !complaintId) return;
    setReassigning(true);
    try {
      const res = await fetch(`/api/complaints/${complaintId}/assign`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ departmentId: selectedDeptId }),
      });

      if (res.ok) {
        const updated = await res.json();
        setComplaint((prev) => (prev ? { ...prev, ...updated } : prev));
        fetchDetail();
      }
    } catch (err) {
      console.error('Failed to reassign department:', err);
    } finally {
      setReassigning(false);
    }
  }

  if (loading) {
    return (
      <AppShell user={{ name: 'Super Admin', role: 'ADMIN' }}>
        <div className="p-16 text-center space-y-3">
          <div className="w-8 h-8 border-4 border-ic-blue border-t-transparent rounded-full animate-spin mx-auto" />
          <div className="text-sm font-semibold text-slate-600">Loading Case Detail...</div>
        </div>
      </AppShell>
    );
  }

  if (!complaint) {
    return (
      <AppShell user={{ name: 'Super Admin', role: 'ADMIN' }}>
        <div className="p-12 text-center space-y-4">
          <div className="text-xl font-bold text-slate-800">Complaint Not Found</div>
          <Link href="/admin/complaints">
            <Button variant="outline">Back to All Complaints</Button>
          </Link>
        </div>
      </AppShell>
    );
  }

  const formattedEvidence: EvidenceItem[] = (complaint.evidence || []).map((ev) => ({
    id: ev.id,
    stage: (ev.stage.toUpperCase() as 'BEFORE' | 'DURING' | 'AFTER') || 'BEFORE',
    imageUrl: ev.imageUrl,
    uploadedAt: ev.uploadedAt,
    notes: ev.notes,
    uploadedByName: ev.uploadedByName,
  }));

  const statusBadge = STATUS_BADGES[complaint.status] || {
    bg: 'bg-slate-100 text-slate-800 border-slate-200',
    text: complaint.status,
  };

  const priorityBadge = complaint.priority ? PRIORITY_BADGES[complaint.priority] : null;

  return (
    <AppShell user={{ name: 'Super Admin', role: 'ADMIN' }}>
      <div className="space-y-6 p-6 max-w-7xl mx-auto">
        {/* Header navigation & title */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
          <div className="flex items-center gap-4">
            <Link href="/admin/complaints">
              <Button variant="ghost" size="sm" className="text-slate-600 hover:text-slate-900">
                <ArrowLeft className="w-4 h-4 mr-1.5" />
                Back to Cases
              </Button>
            </Link>
            <div>
              <div className="flex items-center gap-2.5">
                <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                  #{complaint.ticketId}
                </span>
                <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold border ${statusBadge.bg}`}>
                  {statusBadge.text}
                </span>
                {priorityBadge && (
                  <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold border ${priorityBadge.bg}`}>
                    {priorityBadge.text}
                  </span>
                )}
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 mt-1">
                {complaint.title}
              </h1>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Complaint Details + AI Intelligence + Evidence */}
          <div className="lg:col-span-2 space-y-6">
            {/* Complaint Overview Card */}
            <Card className="border border-slate-200 shadow-xs bg-white rounded-xl">
              <CardHeader className="border-b border-slate-100 pb-3">
                <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-ic-blue" />
                  Case Description & Particulars
                </CardTitle>
              </CardHeader>
              <CardContent className="p-5 space-y-5 text-sm">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Description</h4>
                  <p className="text-slate-700 leading-relaxed whitespace-pre-wrap bg-slate-50 p-4 rounded-lg border border-slate-100 text-sm">
                    {complaint.description}
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 text-xs">
                  <div className="flex items-start gap-2.5">
                    <Tag className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                    <div>
                      <span className="text-slate-500 block font-medium">Category</span>
                      <span className="font-semibold text-slate-800">
                        {complaint.category?.name || 'Uncategorized'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5">
                    <Building2 className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                    <div>
                      <span className="text-slate-500 block font-medium">Assigned Department</span>
                      <span className="font-semibold text-slate-800">
                        {complaint.department?.name || 'Unassigned (Needs Triage)'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5">
                    <User className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                    <div>
                      <span className="text-slate-500 block font-medium">Citizen Reporter</span>
                      <span className="font-semibold text-slate-800">
                        {complaint.citizen?.name || 'Anonymous'}
                      </span>
                      {complaint.citizen?.email && (
                        <span className="text-slate-500 block text-[11px]">{complaint.citizen.email}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5">
                    <MapPin className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                    <div>
                      <span className="text-slate-500 block font-medium">Incident Location</span>
                      <span className="font-semibold text-slate-800">
                        {complaint.location?.address || 'City Center / Location Unspecified'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5">
                    <Calendar className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                    <div>
                      <span className="text-slate-500 block font-medium">Reported Date</span>
                      <span className="font-semibold text-slate-800">
                        {new Date(complaint.createdAt).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {complaint.assignment?.departmentOfficer && (
                    <div className="flex items-start gap-2.5">
                      <ShieldCheck className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                      <div>
                        <span className="text-slate-500 block font-medium">Assigned Officer</span>
                        <span className="font-semibold text-slate-800">
                          {complaint.assignment.departmentOfficer.name}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* AI Diagnostics Card */}
            {complaint.aiPrediction && (
              <AICard
                title="AI Triage & Classification Analysis"
                subtitle="Automated LLM Categorization & Priority Recommendation"
                badgeText={complaint.aiPrediction.confidenceScore ? `${(complaint.aiPrediction.confidenceScore * 100).toFixed(0)}% Confidence` : 'AI Analyzed'}
                variant="subtle"
              >
                <div className="space-y-4 text-xs">
                  <div className="grid grid-cols-2 gap-4 p-3 bg-white dark:bg-slate-900 rounded-lg border border-indigo-100">
                    <div>
                      <span className="text-slate-500 block font-medium mb-0.5">Suggested Department</span>
                      <span className="font-bold text-indigo-950 dark:text-indigo-200 text-sm">
                        {complaint.aiPrediction.suggestedDepartment?.name || 'Unmapped'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block font-medium mb-0.5">Suggested Category</span>
                      <span className="font-bold text-indigo-950 dark:text-indigo-200 text-sm">
                        {complaint.aiPrediction.suggestedCategory?.name || 'Uncategorized'}
                      </span>
                    </div>
                  </div>

                  {complaint.aiPrediction.rawResponse && (
                    <div className="space-y-1.5">
                      <span className="text-slate-600 font-semibold block">
                        Raw Intelligence Output & Reason Code:
                      </span>
                      <pre className="p-3 bg-slate-900 text-indigo-200 rounded-lg text-[11px] font-mono overflow-x-auto border border-slate-800 max-h-48">
                        {JSON.stringify(complaint.aiPrediction.rawResponse, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              </AICard>
            )}

            {/* Evidence Progression Timeline Component */}
            <Card className="border border-slate-200 shadow-xs bg-white rounded-xl">
              <CardContent className="p-5">
                <EvidenceTimeline evidence={formattedEvidence} />
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Super Admin Controls & Audit Log */}
          <div className="space-y-6">
            <Card className="border border-ic-blue/30 shadow-xs bg-white rounded-xl overflow-hidden">
              <div className="h-1 bg-ic-blue" />
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-ic-blue" />
                  <CardTitle className="text-base font-bold text-slate-900">
                    Department Override
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-xs text-slate-500 leading-relaxed">
                  Super Admin authority: Reassign this complaint to any municipal department at any stage of resolution.
                </p>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-700 block">
                    Target Municipal Department
                  </label>
                  <Select value={selectedDeptId} onChange={(e) => setSelectedDeptId(e.target.value)}>
                    <option value="">Select Department</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </Select>
                </div>

                <Button
                  variant="default"
                  className="w-full bg-ic-blue hover:bg-blue-700 text-white font-medium"
                  onClick={handleReassignDepartment}
                  disabled={!selectedDeptId || reassigning}
                >
                  {reassigning ? (
                    <span className="flex items-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Reassigning...
                    </span>
                  ) : (
                    'Confirm Department Override'
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Audit Log / History Card */}
            {complaint.statusHistory && complaint.statusHistory.length > 0 && (
              <Card className="border border-slate-200 shadow-xs bg-white rounded-xl">
                <CardHeader className="pb-2 border-b border-slate-100">
                  <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-slate-500" />
                    Status Change Trail
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-3">
                  {complaint.statusHistory.map((hist) => (
                    <div key={hist.id} className="text-xs pb-2 border-b border-slate-100 last:border-0 last:pb-0">
                      <div className="flex items-center justify-between font-medium text-slate-700">
                        <span>
                          {hist.fromStatus ? `${hist.fromStatus} → ` : ''}
                          <span className="font-bold text-ic-blue">{hist.toStatus}</span>
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {new Date(hist.changedAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

