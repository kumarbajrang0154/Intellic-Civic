'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, Building2, Check, RefreshCw } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select } from '@/components/ui/select';

interface Department {
  id: string;
  name: string;
}

interface Complaint {
  id: string;
  ticketId: string;
  title: string;
  description: string;
  status: string;
  createdAt: string;
  category?: { name: string };
  aiPrediction?: {
    suggestedDepartmentId?: string;
    suggestedDepartment?: { name: string };
    confidenceScore?: number;
    isRejected?: boolean;
  };
}

export default function AdminTriagePage() {
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [selectedDepts, setSelectedDepts] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const [cmpRes, deptRes] = await Promise.all([
        fetch('/api/complaints?needsTriage=true&limit=50'),
        fetch('/api/departments'),
      ]);

      if (cmpRes.ok) {
        const cmpData = await cmpRes.json();
        setComplaints(cmpData.data || []);
      }
      if (deptRes.ok) {
        const deptData = await deptRes.json();
        setDepartments(Array.isArray(deptData) ? deptData : deptData.data || []);
      }
    } catch (err) {
      console.error('Failed to load triage data:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleManualAssign(complaintId: string) {
    const deptId = selectedDepts[complaintId];
    if (!deptId) return;

    setAssigningId(complaintId);
    try {
      const res = await fetch(`/api/complaints/${complaintId}/assign`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ departmentId: deptId }),
      });

      if (res.ok) {
        setComplaints((prev) => prev.filter((c) => c.id !== complaintId));
      }
    } catch (err) {
      console.error('Failed to assign department:', err);
    } finally {
      setAssigningId(null);
    }
  }

  return (
    <AppShell user={{ name: 'Super Admin', role: 'ADMIN' }}>
      <div className="space-y-6 p-6 max-w-7xl mx-auto">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Admin Triage Queue
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Unassigned issues requiring Super Admin manual department allocation
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-500">Loading triage queue...</div>
        ) : complaints.length === 0 ? (
          <Card className="border p-12 text-center">
            <Check className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-slate-800">Triage Queue Clear!</h3>
            <p className="text-slate-500 text-sm mt-1">
              All complaints have been allocated to active departments.
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {complaints.map((c) => {
              const selectedDept = selectedDepts[c.id] || '';
              return (
                <Card key={c.id} className="border shadow-sm bg-white">
                  <CardHeader className="pb-3">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                            {c.ticketId}
                          </span>
                          <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-medium">
                            Needs Triage
                          </span>
                          {c.aiPrediction?.isRejected && (
                            <span className="text-xs bg-rose-100 text-rose-800 px-2 py-0.5 rounded-full font-medium">
                              Dept Rejected
                            </span>
                          )}
                        </div>
                        <Link href={`/admin/complaints/${c.id}`}>
                          <CardTitle className="text-lg font-bold text-slate-900 mt-1 hover:text-blue-600">
                            {c.title}
                          </CardTitle>
                        </Link>
                      </div>
                      <span className="text-xs text-slate-500">
                        {new Date(c.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-slate-600 line-clamp-2">{c.description}</p>

                    {/* AI Prediction Context */}
                    {c.aiPrediction && (
                      <div className="p-3 bg-slate-50 border rounded-md text-xs space-y-1">
                        <div className="font-semibold text-slate-700">AI Context:</div>
                        <div className="text-slate-600">
                          Suggested Dept:{' '}
                          <span className="font-medium text-slate-900">
                            {c.aiPrediction.suggestedDepartment?.name || 'Unmapped'}
                          </span>
                          {c.aiPrediction.confidenceScore && (
                            <span className="ml-2 text-slate-500">
                              (Confidence: {(c.aiPrediction.confidenceScore * 100).toFixed(0)}%)
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Manual Assign Action Bar */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2 border-t">
                      <div className="flex-1 min-w-[220px]">
                        <Select
                          value={selectedDept}
                          onChange={(e) =>
                            setSelectedDepts((prev) => ({ ...prev, [c.id]: e.target.value }))
                          }
                        >
                          <option value="">Select Target Department</option>
                          {departments.map((d) => (
                            <option key={d.id} value={d.id}>
                              {d.name}
                            </option>
                          ))}
                        </Select>
                      </div>
                      <Button
                        className="bg-blue-600 hover:bg-blue-700 text-white"
                        disabled={!selectedDept || assigningId === c.id}
                        onClick={() => handleManualAssign(c.id)}
                      >
                        <Building2 className="w-4 h-4 mr-2" />
                        {assigningId === c.id ? 'Assigning...' : 'Assign Department'}
                      </Button>
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
