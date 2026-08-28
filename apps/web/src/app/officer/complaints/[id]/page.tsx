'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  FileText,
  MapPin,
  MessageSquare,
  AlertCircle,
  Loader2,
  UserCheck,
  Phone,
  Mail,
  Camera,
  ShieldCheck,
  UploadCloud,
} from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Select } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { PhotoUpload } from '@/components/ui/photo-upload';

// Valid Status Transition map per backend specification
const VALID_STATUS_TRANSITIONS: Record<string, string[]> = {
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

interface ComplaintDetail {
  id: string;
  ticketId: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  createdAt: string;
  updatedAt: string;
  citizen?: {
    name: string;
    email?: string;
    mobileNumber?: string;
  };
  category?: { name: string };
  department?: { name: string };
  location?: {
    address?: string;
    latitude?: number;
    longitude?: number;
  };
  evidence?: Array<{
    id: string;
    stage: 'BEFORE' | 'DURING' | 'AFTER';
    imageUrl: string;
    notes?: string;
    uploadedAt: string;
    aiVerified?: boolean;
    aiConfidence?: number;
  }>;
  statusHistory?: Array<{
    id: string;
    fromStatus?: string;
    toStatus: string;
    changedAt: string;
    changedByUser?: { name?: string };
  }>;
}

export default function OfficerComplaintDetailPage() {
  const params = useParams();
  const router = useRouter();
  const complaintId = params?.id as string;

  const [user, setUser] = React.useState<{
    name: string;
    role: 'DEPARTMENT_OFFICER';
  }>({
    name: 'Department Officer',
    role: 'DEPARTMENT_OFFICER',
  });

  const [complaint, setComplaint] = React.useState<ComplaintDetail | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Status update state
  const [selectedNextStatus, setSelectedNextStatus] = React.useState<string>('');
  const [statusRemarks, setStatusRemarks] = React.useState('');
  const [statusUpdating, setStatusUpdating] = React.useState(false);
  const [statusSuccess, setStatusSuccess] = React.useState<string | null>(null);

  // Evidence upload state
  const [evidenceStage, setEvidenceStage] = React.useState<'DURING' | 'AFTER'>('DURING');
  const [evidencePhotos, setEvidencePhotos] = React.useState<string[]>([]);
  const [evidenceNotes, setEvidenceNotes] = React.useState('');
  const [evidenceUploading, setEvidenceUploading] = React.useState(false);
  const [evidenceSuccess, setEvidenceSuccess] = React.useState<string | null>(null);

  const fetchComplaintDetail = React.useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      try {
        const meRes = await fetch('/api/auth/me');
        if (meRes.ok) {
          const meData = await meRes.json();
          if (meData.user) {
            setUser({
              name: meData.user.name || 'Department Officer',
              role: 'DEPARTMENT_OFFICER',
            });
          }
        }
      } catch (meError) {
        // Silently handle auth fallback
      }

      if (!complaintId) return;

      const res = await fetch(`/api/complaints/${complaintId}`);
      if (!res.ok) {
        if (res.status === 404) {
          throw new Error('Complaint not found or access denied');
        }
        throw new Error('Failed to load complaint details');
      }

      const data = await res.json();
      setComplaint(data);

      // Set default next status option
      const currentStatus = data.status || 'ASSIGNED';
      const validNext = VALID_STATUS_TRANSITIONS[currentStatus] || [];
      if (validNext.length > 0) {
        setSelectedNextStatus(validNext[0]);
      }
    } catch (err: any) {
      setError(err.message || 'Error loading complaint detail');
    } finally {
      setLoading(false);
    }
  }, [complaintId]);

  React.useEffect(() => {
    fetchComplaintDetail();
  }, [fetchComplaintDetail]);

  const handleUpdateStatus = async () => {
    if (!selectedNextStatus) return;
    setStatusUpdating(true);
    setStatusSuccess(null);
    setError(null);

    try {
      const res = await fetch(`/api/complaints/${complaintId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: selectedNextStatus,
          remarks: statusRemarks.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Failed to update complaint status');
      }

      setStatusSuccess(`Status successfully updated to ${selectedNextStatus}`);
      setStatusRemarks('');
      await fetchComplaintDetail();
    } catch (err: any) {
      setError(err.message || 'Failed to update status');
    } finally {
      setStatusUpdating(false);
    }
  };

  const handleUploadWorkEvidence = async () => {
    if (evidencePhotos.length === 0) {
      setError('Please upload at least one work photo before submitting evidence.');
      return;
    }

    setEvidenceUploading(true);
    setEvidenceSuccess(null);
    setError(null);

    try {
      for (const imageUrl of evidencePhotos) {
        const res = await fetch(`/api/complaints/${complaintId}/evidence`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageUrl,
            stage: evidenceStage,
            notes: evidenceNotes.trim() || undefined,
          }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.message || 'Failed to attach work evidence');
        }
      }

      setEvidenceSuccess(`Work evidence (${evidenceStage} stage) successfully attached!`);
      setEvidencePhotos([]);
      setEvidenceNotes('');
      await fetchComplaintDetail();
    } catch (err: any) {
      setError(err.message || 'Failed to attach evidence');
    } finally {
      setEvidenceUploading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ASSIGNED':
        return <Badge variant="warning">Assigned</Badge>;
      case 'IN_PROGRESS':
        return <Badge variant="default" className="bg-blue-600 hover:bg-blue-700">In Progress</Badge>;
      case 'RESOLVED':
        return <Badge variant="success">Resolved</Badge>;
      case 'CLOSED':
        return <Badge variant="outline">Closed</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'CRITICAL':
        return <Badge variant="destructive">Critical</Badge>;
      case 'HIGH':
        return <Badge variant="destructive" className="bg-orange-600 hover:bg-orange-700">High</Badge>;
      case 'MEDIUM':
        return <Badge variant="warning">Medium</Badge>;
      default:
        return <Badge variant="secondary">Low</Badge>;
    }
  };

  if (loading) {
    return (
      <AppShell user={user}>
        <div className="space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-64 w-full" />
        </div>
      </AppShell>
    );
  }

  if (error && !complaint) {
    return (
      <AppShell user={user}>
        <div className="space-y-4">
          <Link href="/officer/complaints" className="text-xs text-primary flex items-center gap-1">
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Assigned Complaints
          </Link>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription className="text-xs">{error}</AlertDescription>
          </Alert>
        </div>
      </AppShell>
    );
  }

  if (!complaint) return null;

  const validNextTransitions = VALID_STATUS_TRANSITIONS[complaint.status] || [];

  return (
    <AppShell user={user}>
      <div className="space-y-6">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4">
          <div className="space-y-1">
            <Link
              href="/officer/complaints"
              className="text-xs text-primary flex items-center gap-1 hover:underline mb-1"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to Assigned Workload
            </Link>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-sm font-bold text-primary">
                {complaint.ticketId}
              </span>
              {getStatusBadge(complaint.status)}
              {getPriorityBadge(complaint.priority)}
              <Badge variant="outline" className="text-xs">
                {complaint.category?.name || 'General Issue'}
              </Badge>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {complaint.title}
            </h1>
          </div>

          {complaint.status === 'ASSIGNED' && (
            <Button
              size="sm"
              className="bg-blue-600 hover:bg-blue-700 text-xs"
              onClick={async () => {
                setSelectedNextStatus('IN_PROGRESS');
                await handleUpdateStatus();
              }}
              disabled={statusUpdating}
            >
              {statusUpdating ? 'Starting...' : 'Start Field Resolution (In Progress)'}
            </Button>
          )}
        </div>

        {statusSuccess && (
          <Alert className="border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <AlertTitle className="text-xs font-bold font-mono">Status Updated</AlertTitle>
            <AlertDescription className="text-xs">{statusSuccess}</AlertDescription>
          </Alert>
        )}

        {evidenceSuccess && (
          <Alert className="border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <AlertTitle className="text-xs font-bold">Evidence Attached</AlertTitle>
            <AlertDescription className="text-xs">{evidenceSuccess}</AlertDescription>
          </Alert>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription className="text-xs">{error}</AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Column — Info & Working Controls */}
          <div className="lg:col-span-2 space-y-6">
            {/* Description & Location Card */}
            <Card className="shadow-sm">
              <CardHeader className="p-5 pb-3">
                <CardTitle className="text-base font-bold">Complaint Overview</CardTitle>
              </CardHeader>
              <CardContent className="p-5 pt-0 space-y-4">
                <p className="text-xs text-foreground/90 leading-relaxed whitespace-pre-line">
                  {complaint.description}
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t text-xs">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-primary shrink-0" />
                    <div>
                      <span className="font-semibold block">Location</span>
                      <span className="text-muted-foreground">
                        {complaint.location?.address || 'Location details provided'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-primary shrink-0" />
                    <div>
                      <span className="font-semibold block">Submitted Date</span>
                      <span className="text-muted-foreground">
                        {new Date(complaint.createdAt).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Officer Working Controls — Status Transition */}
            <Card className="border-primary/30 shadow-sm">
              <CardHeader className="p-5 pb-3">
                <div className="flex items-center gap-2 text-primary font-bold text-sm">
                  <UserCheck className="h-4 w-4" />
                  <span>Update Workload Status</span>
                </div>
                <CardDescription className="text-xs">
                  Transition complaint status per department workflow rules.
                </CardDescription>
              </CardHeader>

              <CardContent className="p-5 pt-0 space-y-4">
                {validNextTransitions.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">
                    This complaint is in terminal status ({complaint.status}). No further transitions allowed.
                  </p>
                ) : (
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-foreground">
                        Next Status Pathway
                      </label>
                      <Select
                        value={selectedNextStatus}
                        onChange={(e) => setSelectedNextStatus(e.target.value)}
                        className="text-xs"
                      >
                        {validNextTransitions.map((st) => (
                          <option key={st} value={st}>
                            {st}
                          </option>
                        ))}
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-foreground">
                        Officer Remarks / Inspection Notes (Optional)
                      </label>
                      <Textarea
                        placeholder="Add field inspection notes, resolution rationale, or progress details..."
                        value={statusRemarks}
                        onChange={(e) => setStatusRemarks(e.target.value)}
                        rows={2}
                        className="text-xs"
                      />
                    </div>

                    <Button
                      size="sm"
                      onClick={handleUpdateStatus}
                      disabled={statusUpdating || !selectedNextStatus}
                      className="text-xs w-full sm:w-auto"
                    >
                      {statusUpdating ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                          Updating Status...
                        </>
                      ) : (
                        `Confirm Transition to ${selectedNextStatus}`
                      )}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Add Work Evidence Section (DURING / AFTER) */}
            <Card className="shadow-sm">
              <CardHeader className="p-5 pb-3">
                <div className="flex items-center gap-2 text-primary font-bold text-sm">
                  <Camera className="h-4 w-4" />
                  <span>Attach Work Evidence (DURING / AFTER)</span>
                </div>
                <CardDescription className="text-xs">
                  Upload inspection or resolution photo evidence as proof of department action.
                </CardDescription>
              </CardHeader>

              <CardContent className="p-5 pt-0 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold">Evidence Stage</label>
                    <Select
                      value={evidenceStage}
                      onChange={(e) => setEvidenceStage(e.target.value as 'DURING' | 'AFTER')}
                      className="text-xs"
                    >
                      <option value="DURING">DURING (In-Progress Field Work)</option>
                      <option value="AFTER">AFTER (Resolution Proof)</option>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold">Notes / Photo Caption</label>
                    <Input
                      type="text"
                      placeholder="e.g. Pipe repaired by field crew"
                      value={evidenceNotes}
                      onChange={(e) => setEvidenceNotes(e.target.value)}
                      className="text-xs"
                    />
                  </div>
                </div>

                <PhotoUpload
                  value={evidencePhotos}
                  onChange={setEvidencePhotos}
                  maxFiles={3}
                />

                <Button
                  size="sm"
                  onClick={handleUploadWorkEvidence}
                  disabled={evidenceUploading || evidencePhotos.length === 0}
                  className="text-xs w-full sm:w-auto"
                >
                  {evidenceUploading ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                      Attaching Evidence...
                    </>
                  ) : (
                    `Attach ${evidenceStage} Evidence`
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Evidence Gallery */}
            <Card className="shadow-sm">
              <CardHeader className="p-5 pb-3">
                <CardTitle className="text-base font-bold">Evidence Gallery</CardTitle>
              </CardHeader>
              <CardContent className="p-5 pt-0">
                {!complaint.evidence || complaint.evidence.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">
                    No photo evidence attached to this complaint yet.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {complaint.evidence.map((item) => (
                      <div key={item.id} className="border rounded-lg p-3 space-y-2 bg-card">
                        <div className="flex items-center justify-between">
                          <Badge variant="outline" className="text-xs font-mono">
                            {item.stage} STAGE
                          </Badge>
                          {item.aiVerified && (
                            <span className="text-[11px] text-emerald-600 flex items-center gap-1 font-semibold">
                              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                              AI Verified
                            </span>
                          )}
                        </div>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={item.imageUrl}
                          alt={`${item.stage} evidence`}
                          className="w-full h-40 object-cover rounded-md border"
                        />
                        {item.notes && (
                          <p className="text-xs text-muted-foreground italic">&quot;{item.notes}&quot;</p>
                        )}
                        <span className="text-[10px] text-muted-foreground block">
                          Uploaded {new Date(item.uploadedAt).toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Sidebar Column — Citizen Info & Timeline */}
          <div className="space-y-6">
            {/* Citizen Contact Info */}
            <Card className="shadow-sm">
              <CardHeader className="p-5 pb-3">
                <CardTitle className="text-base font-bold">Citizen Information</CardTitle>
              </CardHeader>
              <CardContent className="p-5 pt-0 space-y-3 text-xs">
                <div className="flex items-center gap-2">
                  <UserCheck className="h-4 w-4 text-primary shrink-0" />
                  <div>
                    <span className="font-semibold block">Citizen Name</span>
                    <span className="text-muted-foreground">
                      {complaint.citizen?.name || 'Anonymous Citizen'}
                    </span>
                  </div>
                </div>

                {complaint.citizen?.mobileNumber && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-primary shrink-0" />
                    <div>
                      <span className="font-semibold block">Mobile Number</span>
                      <span className="text-muted-foreground">
                        {complaint.citizen.mobileNumber}
                      </span>
                    </div>
                  </div>
                )}

                {complaint.citizen?.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-primary shrink-0" />
                    <div>
                      <span className="font-semibold block">Email Address</span>
                      <span className="text-muted-foreground">
                        {complaint.citizen.email}
                      </span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Status History Timeline */}
            <Card className="shadow-sm">
              <CardHeader className="p-5 pb-3">
                <CardTitle className="text-base font-bold">Status History Timeline</CardTitle>
              </CardHeader>
              <CardContent className="p-5 pt-0">
                {!complaint.statusHistory || complaint.statusHistory.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">No history records logged.</p>
                ) : (
                  <div className="relative border-l border-primary/30 ml-2 space-y-4 py-1">
                    {complaint.statusHistory.map((h) => (
                      <div key={h.id} className="relative pl-4 text-xs space-y-0.5">
                        <div className="absolute -left-1.5 top-1 h-3 w-3 rounded-full bg-primary" />
                        <div className="font-semibold text-foreground">
                          {h.fromStatus ? `${h.fromStatus} → ${h.toStatus}` : h.toStatus}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          By {h.changedByUser?.name || 'System'} &bull;{' '}
                          {new Date(h.changedAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
