'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ArrowLeft,
  Building2,
  Calendar,
  CheckCircle2,
  FileText,
  MapPin,
  RefreshCw,
  Sparkles,
  User,
} from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select } from '@/components/ui/select';

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
  }>;
  statusHistory?: Array<{
    id: string;
    fromStatus: string | null;
    toStatus: string;
    changedAt: string;
  }>;
}

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
        <div className="p-12 text-center text-slate-500">Loading complaint detail...</div>
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

  return (
    <AppShell user={{ name: 'Super Admin', role: 'ADMIN' }}>
      <div className="space-y-6 p-6 max-w-7xl mx-auto">
        <div className="flex items-center gap-4">
          <Link href="/admin/complaints">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-bold text-slate-500">
                {complaint.ticketId}
              </span>
              <span className="text-xs bg-blue-100 text-blue-800 px-2.5 py-0.5 rounded-full font-medium">
                {complaint.status}
              </span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 mt-1">
              {complaint.title}
            </h1>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Info */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="border shadow-sm bg-white">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-slate-900">
                  Complaint Overview
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div>
                  <div className="font-semibold text-slate-700 mb-1">Description</div>
                  <p className="text-slate-600 leading-relaxed whitespace-pre-wrap">
                    {complaint.description}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-4 border-t text-xs">
                  <div>
                    <span className="text-slate-500 block">Category:</span>
                    <span className="font-semibold text-slate-800">
                      {complaint.category?.name || 'Uncategorized'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Assigned Department:</span>
                    <span className="font-semibold text-slate-800">
                      {complaint.department?.name || 'Unassigned (Needs Triage)'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Citizen Contact:</span>
                    <span className="font-semibold text-slate-800">
                      {complaint.citizen?.name || 'Anonymous'} ({complaint.citizen?.email || 'N/A'})
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Location Address:</span>
                    <span className="font-semibold text-slate-800">
                      {complaint.location?.address || 'City Center'}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* AI Reasoning Context */}
            {complaint.aiPrediction && (
              <Card className="border shadow-sm bg-purple-50/50 border-purple-200">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-purple-600" />
                    <CardTitle className="text-lg font-semibold text-purple-950">
                      Unsanitized AI Diagnostic Prediction
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 text-xs text-purple-900">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <span className="text-purple-700 block">Suggested Department:</span>
                      <span className="font-bold">
                        {complaint.aiPrediction.suggestedDepartment?.name || 'Unmapped'}
                      </span>
                    </div>
                    <div>
                      <span className="text-purple-700 block">Confidence Score:</span>
                      <span className="font-bold">
                        {complaint.aiPrediction.confidenceScore
                          ? `${(complaint.aiPrediction.confidenceScore * 100).toFixed(1)}%`
                          : 'N/A'}
                      </span>
                    </div>
                  </div>
                  {complaint.aiPrediction.rawResponse && (
                    <div className="pt-2 border-t border-purple-200">
                      <span className="text-purple-700 font-semibold block mb-1">
                        Raw LLM Reasoning Metadata:
                      </span>
                      <pre className="p-3 bg-purple-900 text-purple-100 rounded text-[11px] overflow-x-auto">
                        {JSON.stringify(complaint.aiPrediction.rawResponse, null, 2)}
                      </pre>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Work Evidence Gallery */}
            {complaint.evidence && complaint.evidence.length > 0 && (
              <Card className="border shadow-sm bg-white">
                <CardHeader>
                  <CardTitle className="text-lg font-semibold text-slate-900">
                    Resolution Work Evidence
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {complaint.evidence.map((ev) => (
                      <div key={ev.id} className="border rounded overflow-hidden">
                        <img src={ev.imageUrl} alt={ev.stage} className="w-full h-32 object-cover" />
                        <div className="p-2 text-[11px] bg-slate-50 flex justify-between">
                          <span className="font-bold text-slate-700">{ev.stage} Stage</span>
                          <span className="text-slate-400">
                            {new Date(ev.uploadedAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right Admin Controls */}
          <div className="space-y-6">
            <Card className="border shadow-sm bg-white border-blue-200">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-blue-600" />
                  <CardTitle className="text-base font-bold text-slate-900">
                    Super Admin Department Override
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-xs text-slate-500">
                  Reassign this complaint to a different municipal department at any stage.
                </p>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-700 block">
                    Target Department
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
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                  onClick={handleReassignDepartment}
                  disabled={!selectedDeptId || reassigning}
                >
                  {reassigning ? 'Reassigning...' : 'Confirm Reassignment'}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
