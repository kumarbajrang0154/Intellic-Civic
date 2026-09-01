'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Calendar,
  MapPin,
  Building2,
  Clock,
  UserCheck,
  User,
  ShieldCheck,
  AlertTriangle,
  Loader2,
  FileQuestion,
  Sparkles,
  CheckCircle2,
  Brain,
  MessageSquare,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const VALID_TRANSITIONS: Record<string, string[]> = {
  SUBMITTED: ['AI_PROCESSING', 'PENDING_DEPT_REVIEW', 'ASSIGNED', 'REJECTED', 'DUPLICATE'],
  AI_PROCESSING: ['PENDING_DEPT_REVIEW', 'ASSIGNED', 'REJECTED', 'DUPLICATE'],
  PENDING_DEPT_REVIEW: ['ASSIGNED', 'IN_PROGRESS', 'REJECTED', 'DUPLICATE'],
  ASSIGNED: ['IN_PROGRESS', 'RESOLVED', 'REJECTED'],
  IN_PROGRESS: ['RESOLVED', 'REJECTED', 'CLOSED'],
  RESOLVED: ['CLOSED', 'IN_PROGRESS'],
  CLOSED: [],
  REJECTED: [],
  DUPLICATE: [],
};

interface Officer {
  id: string;
  name: string;
  email?: string;
  role: string;
}

interface ComplaintDetail {
  id: string;
  ticketId: string;
  title: string;
  description: string;
  status: string;
  priority?: string;
  createdAt: string;
  updatedAt: string;
  citizen?: {
    id: string;
    name: string;
    email?: string;
    mobileNumber?: string;
  };
  category?: { id: string; name: string } | null;
  department?: { id: string; name: string } | null;
  location?: { address?: string; latitude?: number; longitude?: number } | null;
  evidence?: { id: string; imageUrl: string; stage: string; uploadedAt: string }[];
  statusHistory?: {
    id: string;
    fromStatus?: string;
    toStatus: string;
    changedAt: string;
    changedByUser?: { name: string };
  }[];
  assignment?: {
    departmentOfficer?: { id: string; name: string; email: string };
    assignedByUser?: { name: string };
    notes?: string;
  } | null;
  aiPrediction?: {
    confidenceScore?: number;
    suggestedCategoryId?: string;
    suggestedDepartmentId?: string;
    suggestedPriority?: string;
    rawResponse?: any;
  } | null;
  aiSuggestion?: {
    suggestedCategoryId?: string;
    suggestedDepartmentId?: string;
    suggestedPriority?: string;
    confidenceScore?: number;
    reasoning?: string;
    routingDecision?: string;
    needsManualTriage?: boolean;
  } | null;
}

export default function StaffComplaintDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [complaint, setComplaint] = React.useState<ComplaintDetail | null>(null);
  const [officers, setOfficers] = React.useState<Officer[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Status update state
  const [nextStatus, setNextStatus] = React.useState('');
  const [statusRemarks, setStatusRemarks] = React.useState('');
  const [updatingStatus, setUpdatingStatus] = React.useState(false);
  const [statusSuccess, setStatusSuccess] = React.useState<string | null>(null);

  // Assignment state
  const [selectedOfficerId, setSelectedOfficerId] = React.useState('');
  const [assignNotes, setAssignNotes] = React.useState('');
  const [assigning, setAssigning] = React.useState(false);
  const [assignSuccess, setAssignSuccess] = React.useState<string | null>(null);

  const fetchDetailAndStaff = React.useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/complaints/${id}`);
      if (!res.ok) {
        throw new Error('Failed to load complaint detail');
      }

      const data: ComplaintDetail = await res.json();
      setComplaint(data);

      if (data.assignment?.departmentOfficer?.id) {
        setSelectedOfficerId(data.assignment.departmentOfficer.id);
      }

      // Fetch department staff roster if department ID exists
      const deptId = data.department?.id || data.aiPrediction?.suggestedDepartmentId;
      if (deptId) {
        const staffRes = await fetch(`/api/departments/${deptId}/staff`);
        if (staffRes.ok) {
          const staffData = await staffRes.json();
          setOfficers(staffData.officers || []);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Error loading details');
    } finally {
      setLoading(false);
    }
  }, [id]);

  React.useEffect(() => {
    fetchDetailAndStaff();
  }, [fetchDetailAndStaff]);

  const handleUpdateStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nextStatus) return;

    setUpdatingStatus(true);
    setStatusSuccess(null);
    setError(null);

    try {
      const res = await fetch(`/api/complaints/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: nextStatus,
          remarks: statusRemarks.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Failed to update status');
      }

      setStatusSuccess(`Status successfully updated to ${nextStatus.replace(/_/g, ' ')}`);
      setNextStatus('');
      setStatusRemarks('');
      fetchDetailAndStaff();
    } catch (err: any) {
      setError(err.message || 'Status update failed');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleAssignOfficer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOfficerId) return;

    setAssigning(true);
    setAssignSuccess(null);
    setError(null);

    try {
      const res = await fetch(`/api/complaints/${id}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignedOfficerId: selectedOfficerId,
          notes: assignNotes.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Failed to assign officer');
      }

      setAssignSuccess('Officer successfully assigned to complaint.');
      fetchDetailAndStaff();
    } catch (err: any) {
      setError(err.message || 'Assignment failed');
    } finally {
      setAssigning(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center space-y-4">
        <Loader2 className="h-8 w-8 text-primary animate-spin" />
        <p className="text-sm text-muted-foreground font-medium">Loading staff complaint detail...</p>
      </div>
    );
  }

  if (error || !complaint) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center border-destructive/20 bg-destructive/5">
          <CardContent className="pt-6 space-y-4">
            <AlertTriangle className="h-8 w-8 text-destructive mx-auto" />
            <p className="text-sm text-destructive font-medium">{error || 'Failed to load details'}</p>
            <Link href="/department-head/complaints">
              <Button variant="outline" size="sm">
                Back to Queue
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const allowedNextStatuses = VALID_TRANSITIONS[complaint.status] || [];
  const rawAi = complaint.aiPrediction?.rawResponse || {};

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6 max-w-5xl mx-auto space-y-6">
      {/* Top Navigation */}
      <div className="flex items-center justify-between border-b pb-4">
        <div className="flex items-center gap-3">
          <Link href="/department-head/complaints">
            <Button variant="ghost" size="icon" aria-label="Back to Queue">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-bold text-primary">
                {complaint.ticketId}
              </span>
              <Badge variant="outline">{complaint.status}</Badge>
              {complaint.priority && <Badge variant="secondary">{complaint.priority}</Badge>}
            </div>
            <h1 className="text-xl font-bold text-foreground line-clamp-1">
              {complaint.title}
            </h1>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content (Left 2 Columns) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Complaint Details Card */}
          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Complaint Overview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-foreground whitespace-pre-line leading-relaxed">
                {complaint.description}
              </p>

              {/* Location */}
              {complaint.location && (
                <div className="flex items-start gap-2 p-3 rounded-lg border bg-muted/30 text-xs text-muted-foreground">
                  <MapPin className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-foreground block mb-0.5">Location</span>
                    <span>{complaint.location.address || 'Coordinates provided'}</span>
                  </div>
                </div>
              )}

              {/* Citizen Details */}
              {complaint.citizen && (
                <div className="p-3 rounded-lg border bg-muted/20 text-xs space-y-1">
                  <span className="font-semibold text-foreground block mb-1">Citizen Information</span>
                  <div className="grid grid-cols-2 gap-2 text-muted-foreground">
                    <div>Name: <span className="font-medium text-foreground">{complaint.citizen.name}</span></div>
                    {complaint.citizen.mobileNumber && (
                      <div>Mobile: <span className="font-medium text-foreground">{complaint.citizen.mobileNumber}</span></div>
                    )}
                    {complaint.citizen.email && (
                      <div>Email: <span className="font-medium text-foreground">{complaint.citizen.email}</span></div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Unsanitized Staff AI Verification Details */}
          {complaint.aiPrediction && (
            <Card className="shadow-sm border-primary/20 bg-primary/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold flex items-center gap-2 text-primary">
                  <Brain className="h-5 w-5" />
                  <span>Gemini AI Triage Analysis (Staff Unsanitized View)</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-xs">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="p-2.5 rounded border bg-background">
                    <span className="text-muted-foreground block text-[10px] uppercase">Confidence</span>
                    <span className="font-bold text-sm text-primary">
                      {complaint.aiPrediction.confidenceScore
                        ? `${Math.round(complaint.aiPrediction.confidenceScore * 100)}%`
                        : 'N/A'}
                    </span>
                  </div>

                  <div className="p-2.5 rounded border bg-background">
                    <span className="text-muted-foreground block text-[10px] uppercase">Recommendation</span>
                    <span className="font-bold text-sm text-foreground">
                      {rawAi?.recommendation || 'MANUAL_REVIEW'}
                    </span>
                  </div>

                  <div className="p-2.5 rounded border bg-background">
                    <span className="text-muted-foreground block text-[10px] uppercase">Routing Decision</span>
                    <span className="font-bold text-sm text-foreground">
                      {rawAi?.routing_decision || 'SUGGEST_ONLY'}
                    </span>
                  </div>
                </div>

                {complaint.aiSuggestion?.reasoning && (
                  <div className="p-3 rounded border bg-background text-foreground/90 space-y-1">
                    <span className="font-semibold block">AI Classification Reasoning:</span>
                    <p className="italic leading-normal">&quot;{complaint.aiSuggestion.reasoning}&quot;</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Photo Evidence Gallery */}
          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Evidence Photo Gallery</CardTitle>
            </CardHeader>
            <CardContent>
              {complaint.evidence && complaint.evidence.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {complaint.evidence.map((ev) => (
                    <div
                      key={ev.id}
                      className="relative group aspect-square rounded-lg border bg-muted overflow-hidden shadow-sm"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={ev.imageUrl}
                        alt="Evidence"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-x-0 bottom-0 bg-black/60 p-1.5 text-[10px] text-white flex items-center justify-between">
                        <span className="uppercase">{ev.stage}</span>
                        <span>{new Date(ev.uploadedAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic py-3 text-center">
                  No evidence photos attached.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Status History Timeline */}
          {complaint.statusHistory && complaint.statusHistory.length > 0 && (
            <Card className="shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold">Status History Timeline</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="relative border-l-2 border-primary/20 pl-4 space-y-3 py-1">
                  {complaint.statusHistory.map((h) => (
                    <div key={h.id} className="relative space-y-0.5">
                      <div className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-primary ring-4 ring-background" />
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-foreground">
                          {h.fromStatus ? `${h.fromStatus} ➔ ` : ''}{h.toStatus}
                        </span>
                        <span className="text-muted-foreground">
                          {new Date(h.changedAt).toLocaleString()}
                        </span>
                      </div>
                      {h.changedByUser && (
                        <p className="text-[11px] text-muted-foreground">
                          Changed by {h.changedByUser.name}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar Controls (Right 1 Column) */}
        <div className="space-y-6">
          {/* Status Update Control */}
          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary" />
                <span>Update Complaint Status</span>
              </CardTitle>
              <CardDescription className="text-xs">
                Only valid state machine transitions are enabled below.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {statusSuccess && (
                <div className="mb-3 p-2.5 text-xs text-emerald-800 bg-emerald-100 rounded border border-emerald-300">
                  {statusSuccess}
                </div>
              )}

              {allowedNextStatuses.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">
                  This complaint is in terminal status ({complaint.status}). No further transitions allowed.
                </p>
              ) : (
                <form onSubmit={handleUpdateStatus} className="space-y-3">
                  <Select
                    value={nextStatus}
                    onChange={(e) => setNextStatus(e.target.value)}
                    required
                    className="text-xs"
                  >
                    <option value="">Select next valid status...</option>
                    {allowedNextStatuses.map((st) => (
                      <option key={st} value={st}>
                        {st.replace(/_/g, ' ')}
                      </option>
                    ))}
                  </Select>

                  <Textarea
                    placeholder="Remarks / notes for status change (optional)..."
                    value={statusRemarks}
                    onChange={(e) => setStatusRemarks(e.target.value)}
                    rows={3}
                    className="text-xs"
                  />

                  <Button
                    type="submit"
                    size="sm"
                    disabled={updatingStatus || !nextStatus}
                    className="w-full text-xs"
                  >
                    {updatingStatus ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                        Updating Status...
                      </>
                    ) : (
                      'Update Status'
                    )}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>

          {/* Officer Assignment Control */}
          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <UserCheck className="h-4 w-4 text-primary" />
                <span>Assign Department Officer</span>
              </CardTitle>
              <CardDescription className="text-xs">
                Assign an officer to handle field resolution.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {assignSuccess && (
                <div className="mb-3 p-2.5 text-xs text-emerald-800 bg-emerald-100 rounded border border-emerald-300">
                  {assignSuccess}
                </div>
              )}

              <form onSubmit={handleAssignOfficer} className="space-y-3">
                <Select
                  value={selectedOfficerId}
                  onChange={(e) => setSelectedOfficerId(e.target.value)}
                  required
                  className="text-xs"
                >
                  <option value="">Select officer from department...</option>
                  {officers.map((off) => (
                    <option key={off.id} value={off.id}>
                      {off.name} ({off.role})
                    </option>
                  ))}
                </Select>

                <Input
                  placeholder="Assignment notes (optional)..."
                  value={assignNotes}
                  onChange={(e) => setAssignNotes(e.target.value)}
                  className="text-xs"
                />

                <Button
                  type="submit"
                  size="sm"
                  disabled={assigning || !selectedOfficerId}
                  className="w-full text-xs"
                >
                  {assigning ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                      Assigning...
                    </>
                  ) : (
                    'Assign Officer'
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
