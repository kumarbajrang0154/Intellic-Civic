'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  MapPin,
  Camera,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Play,
  Send,
  Building2,
  Clock,
  Sparkles,
  ShieldAlert,
  FileText,
  ExternalLink,
} from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Textarea } from '@/components/ui/textarea';
import { PhotoUpload } from '@/components/ui/photo-upload';
import { toast } from 'sonner';

interface EvidenceItem {
  id: string;
  imageUrl: string;
  stage: 'BEFORE' | 'DURING' | 'AFTER';
  uploadedAt: string;
}

interface ComplaintDetail {
  id: string;
  ticketId: string;
  title: string;
  description: string;
  status: string;
  priority?: string;
  readyForReview?: boolean;
  fieldWorkerRemarks?: string;
  createdAt: string;
  updatedAt: string;
  category?: { id: string; name: string } | null;
  department?: { id: string; name: string } | null;
  location?: { address?: string; latitude?: number; longitude?: number } | null;
  evidence: EvidenceItem[];
  statusHistory?: {
    id: string;
    toStatus: string;
    changedAt: string;
    changedByUser?: { name: string };
    notes?: string;
  }[];
}

export default function FieldWorkerComplaintDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [user, setUser] = React.useState<{ name: string; role: 'FIELD_WORKER' }>({
    name: 'Field Worker',
    role: 'FIELD_WORKER',
  });

  const [complaint, setComplaint] = React.useState<ComplaintDetail | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Action states
  const [startingWork, setStartingWork] = React.useState(false);
  const [uploadingStage, setUploadingStage] = React.useState<'BEFORE' | 'AFTER' | null>(null);
  const [submittingReview, setSubmittingReview] = React.useState(false);

  // Upload URLs state
  const [beforePhotos, setBeforePhotos] = React.useState<string[]>([]);
  const [afterPhotos, setAfterPhotos] = React.useState<string[]>([]);
  const [remarks, setRemarks] = React.useState('');
  const [submitError, setSubmitError] = React.useState<string | null>(null);

  const fetchDetail = React.useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);

    try {
      // Get user
      const meRes = await fetch('/api/auth/me');
      if (meRes.ok) {
        const meData = await meRes.json();
        if (meData.user) setUser({ name: meData.user.name || 'Field Worker', role: 'FIELD_WORKER' });
      }

      const res = await fetch(`/api/field-worker/complaints/${id}`);
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || 'Failed to load complaint details');
      }

      const data: ComplaintDetail = await res.json();
      setComplaint(data);

      if (data.fieldWorkerRemarks) {
        setRemarks(data.fieldWorkerRemarks);
      }

      // Populate existing uploaded evidence photos
      const beforeList = data.evidence?.filter((e) => e.stage === 'BEFORE').map((e) => e.imageUrl) || [];
      const afterList = data.evidence?.filter((e) => e.stage === 'AFTER').map((e) => e.imageUrl) || [];
      setBeforePhotos(beforeList);
      setAfterPhotos(afterList);
    } catch (err: any) {
      setError(err.message || 'Error loading detail');
    } fontally: {
      setLoading(false);
    }
  }, [id]);

  React.useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  // ---------------------------------------------------------------------------
  // HANDLERS
  // ---------------------------------------------------------------------------
  const handleStartWork = async () => {
    if (!complaint) return;
    setStartingWork(true);
    try {
      const res = await fetch(`/api/field-worker/complaints/${complaint.id}/start`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to start work');

      toast.success('Work initiated on site! You can now upload repair evidence.');
      fetchDetail();
    } catch (err: any) {
      toast.error(err.message || 'Error starting work');
    } finally {
      setStartingWork(false);
    }
  };

  const handleBeforePhotosChange = async (urls: string[]) => {
    setBeforePhotos(urls);
    if (!complaint) return;

    // Detect newly added photo URL
    const existing = complaint.evidence?.filter((e) => e.stage === 'BEFORE').map((e) => e.imageUrl) || [];
    const newUrl = urls.find((u) => !existing.includes(u));

    if (newUrl) {
      setUploadingStage('BEFORE');
      try {
        const res = await fetch(`/api/field-worker/complaints/${complaint.id}/evidence`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ stage: 'BEFORE', imageUrl: newUrl }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.message);
        }
        toast.success('BEFORE repair photo recorded!');
        fetchDetail();
      } catch (err: any) {
        toast.error(err.message || 'Failed to record BEFORE photo');
      } finally {
        setUploadingStage(null);
      }
    }
  };

  const handleAfterPhotosChange = async (urls: string[]) => {
    if (!complaint) return;

    // Sequence Guard Check
    const hasBefore = beforePhotos.length > 0 || complaint.evidence?.some((e) => e.stage === 'BEFORE');
    if (!hasBefore) {
      toast.error('Sequence Guard: At least one BEFORE repair photo must be uploaded first!');
      return;
    }

    setAfterPhotos(urls);
    const existing = complaint.evidence?.filter((e) => e.stage === 'AFTER').map((e) => e.imageUrl) || [];
    const newUrl = urls.find((u) => !existing.includes(u));

    if (newUrl) {
      setUploadingStage('AFTER');
      try {
        const res = await fetch(`/api/field-worker/complaints/${complaint.id}/evidence`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ stage: 'AFTER', imageUrl: newUrl }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message);

        toast.success('AFTER repair photo recorded!');
        fetchDetail();
      } catch (err: any) {
        toast.error(err.message || 'Failed to record AFTER photo');
      } finally {
        setUploadingStage(null);
      }
    }
  };

  const handleSubmitForReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!complaint) return;
    setSubmittingReview(true);
    setSubmitError(null);

    try {
      const res = await fetch(`/api/field-worker/complaints/${complaint.id}/submit-for-review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ remarks: remarks.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to submit work for review');

      toast.success('Work submitted successfully! Assigned officer notified for sign-off.');
      fetchDetail();
    } catch (err: any) {
      setSubmitError(err.message || 'Error submitting work');
      toast.error(err.message || 'Error submitting work');
    } finally {
      setSubmittingReview(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center space-y-4">
        <Loader2 className="h-8 w-8 text-primary animate-spin" />
        <p className="text-sm text-muted-foreground font-medium">Loading field task details...</p>
      </div>
    );
  }

  if (error || !complaint) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center border-destructive/20 bg-destructive/5">
          <CardContent className="pt-6 space-y-4">
            <AlertCircle className="h-8 w-8 text-destructive mx-auto" />
            <p className="text-sm text-destructive font-medium">{error || 'Task not found or access denied.'}</p>
            <Link href="/field-worker">
              <Button variant="outline" size="sm">
                Back to Task Queue
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Submission validation guards
  const hasBefore = beforePhotos.length > 0 || complaint.evidence?.some((e) => e.stage === 'BEFORE');
  const hasAfter = afterPhotos.length > 0 || complaint.evidence?.some((e) => e.stage === 'AFTER');
  const isRemarksValid = remarks.trim().length >= 5;
  const canSubmit = hasBefore && hasAfter && isRemarksValid && complaint.status === 'IN_PROGRESS' && !complaint.readyForReview;

  return (
    <AppShell user={user}>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Top Header */}
        <div className="flex items-center gap-4 border-b pb-4">
          <Link href="/field-worker">
            <Button variant="ghost" size="icon" aria-label="Back to Task Queue">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-sm font-bold text-primary">{complaint.ticketId}</span>
              {complaint.category && <Badge variant="outline">{complaint.category.name}</Badge>}
              {complaint.readyForReview ? (
                <Badge variant="warning" className="font-bold">Awaiting Officer Review</Badge>
              ) : (
                <Badge variant={complaint.status === 'IN_PROGRESS' ? 'info' : 'outline'}>
                  {complaint.status}
                </Badge>
              )}
            </div>
            <h1 className="text-xl font-bold text-foreground line-clamp-1">{complaint.title}</h1>
          </div>
        </div>

        {/* Status Callout Banner */}
        {complaint.status === 'ASSIGNED' && (
          <Card className="border-amber-500/40 bg-amber-500/10">
            <CardContent className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="font-bold text-sm text-amber-900 dark:text-amber-200 flex items-center gap-2">
                  <Play className="h-4 w-4 text-amber-600 fill-amber-600" />
                  <span>Task Assigned — Ready to Start On-Site Repairs</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Click 'Start Repair Work' when arriving on location to transition status to IN_PROGRESS.
                </p>
              </div>
              <Button
                onClick={handleStartWork}
                disabled={startingWork}
                className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs gap-1.5 shrink-0 w-full sm:w-auto"
              >
                {startingWork ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Starting...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 fill-white" />
                    Start Repair Work
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        )}

        {complaint.readyForReview && (
          <Card className="border-purple-500/40 bg-purple-500/10">
            <CardContent className="p-4 flex items-center gap-3 text-purple-900 dark:text-purple-200">
              <CheckCircle2 className="h-6 w-6 text-purple-600 shrink-0" />
              <div>
                <div className="font-bold text-sm">Work Submitted for Officer Review</div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Before/After photos and completion remarks have been submitted to the Department Officer for inspection and final resolution sign-off.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Complaint Info & Location Card */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-6">
            <Card className="shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold">Citizen Complaint Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-foreground leading-relaxed whitespace-pre-line">
                  {complaint.description}
                </p>

                {complaint.location?.address && (
                  <div className="p-3 rounded-lg border bg-muted/40 text-xs flex items-start gap-2.5">
                    <MapPin className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <span className="font-semibold text-foreground block">Site Location</span>
                      <span>{complaint.location.address}</span>
                      {complaint.location.latitude && complaint.location.longitude && (
                        <a
                          href={`https://maps.google.com/?q=${complaint.location.latitude},${complaint.location.longitude}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-primary hover:underline font-medium inline-flex items-center gap-1 block pt-1"
                        >
                          Open in Google Maps <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Evidence Upload & Management Section */}
            <Card className="shadow-md border-primary/20">
              <CardHeader className="pb-3 border-b">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <Camera className="h-5 w-5 text-primary" />
                    <span>Field Evidence Photo Uploads</span>
                  </CardTitle>
                  <Badge variant="outline" className="text-xs">
                    {complaint.evidence?.length || 0} Photo(s) Attached
                  </Badge>
                </div>
                <CardDescription className="text-xs">
                  Upload BEFORE starting work, and AFTER completing repairs.
                </CardDescription>
              </CardHeader>

              <CardContent className="p-6 space-y-6">
                {/* BEFORE Photos Upload */}
                <div className="space-y-2 p-4 rounded-lg border bg-amber-500/5 border-amber-500/20">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-amber-900 dark:text-amber-300 flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-amber-500 inline-block" />
                      BEFORE Repair Photos <span className="text-destructive">*</span>
                    </label>
                    <span className="text-[11px] text-muted-foreground">Required before starting work</span>
                  </div>

                  <PhotoUpload
                    value={beforePhotos}
                    onChange={handleBeforePhotosChange}
                    maxFiles={3}
                  />
                </div>

                {/* AFTER Photos Upload with Sequence Guard Warning */}
                <div className="space-y-2 p-4 rounded-lg border bg-emerald-500/5 border-emerald-500/20">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-emerald-900 dark:text-emerald-300 flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block" />
                      AFTER Repair Photos <span className="text-destructive">*</span>
                    </label>
                    <span className="text-[11px] text-muted-foreground">Required for completion sign-off</span>
                  </div>

                  {!hasBefore && (
                    <Alert variant="default" className="text-xs bg-amber-50 border-amber-200 text-amber-900">
                      <ShieldAlert className="h-4 w-4 text-amber-600" />
                      <AlertTitle className="font-bold text-xs">Sequence Guard Active</AlertTitle>
                      <AlertDescription className="text-[11px]">
                        You must upload at least one <strong>BEFORE</strong> photo prior to adding AFTER repair photos.
                      </AlertDescription>
                    </Alert>
                  )}

                  <PhotoUpload
                    value={afterPhotos}
                    onChange={handleAfterPhotosChange}
                    maxFiles={3}
                  />
                </div>

                {/* Submit for Review Form */}
                {complaint.status === 'IN_PROGRESS' && !complaint.readyForReview && (
                  <form onSubmit={handleSubmitForReview} className="space-y-4 pt-4 border-t">
                    {submitError && (
                      <Alert variant="destructive" className="text-xs">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>{submitError}</AlertDescription>
                      </Alert>
                    )}

                    <div className="space-y-1.5">
                      <label htmlFor="remarks" className="text-xs font-bold text-foreground">
                        Field Completion Remarks &amp; Site Notes <span className="text-destructive">*</span>
                      </label>
                      <Textarea
                        id="remarks"
                        rows={3}
                        placeholder="Describe repair work carried out, materials used, site condition... (min 5 characters)"
                        value={remarks}
                        onChange={(e) => setRemarks(e.target.value)}
                        className="text-xs"
                      />
                      {!isRemarksValid && remarks.length > 0 && (
                        <p className="text-[11px] text-destructive">Remarks must be at least 5 characters long.</p>
                      )}
                    </div>

                    {/* Requirements Validation Summary Box */}
                    <div className="p-3 bg-muted/40 rounded-lg text-xs space-y-1 text-muted-foreground">
                      <span className="font-bold text-foreground block mb-1">Pre-Submission Checklist:</span>
                      <div className="flex items-center gap-2">
                        {hasBefore ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-amber-500" />
                        )}
                        <span>BEFORE repair photo uploaded</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {hasAfter ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-amber-500" />
                        )}
                        <span>AFTER repair photo uploaded</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {isRemarksValid ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-amber-500" />
                        )}
                        <span>Completion remarks written</span>
                      </div>
                    </div>

                    <Button
                      type="submit"
                      disabled={!canSubmit || submittingReview}
                      className="w-full bg-primary hover:bg-primary/90 font-bold text-xs gap-2"
                    >
                      {submittingReview ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Submitting...
                        </>
                      ) : (
                        <>
                          <Send className="h-4 w-4" />
                          Submit Work for Officer Review
                        </>
                      )}
                    </Button>
                  </form>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <Card className="shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-primary" />
                  <span>Department &amp; Priority</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs space-y-3">
                <div className="flex justify-between border-b pb-2">
                  <span className="text-muted-foreground">Department</span>
                  <span className="font-semibold text-foreground">
                    {complaint.department?.name || 'Assigned Dept'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Priority Level</span>
                  <span className="font-bold text-primary">{complaint.priority || 'MEDIUM'}</span>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Clock className="h-4 w-4 text-primary" />
                  <span>Task Timeline</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs space-y-2">
                <div className="flex justify-between border-b pb-2">
                  <span className="text-muted-foreground">Created On</span>
                  <span>{new Date(complaint.createdAt).toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Last Updated</span>
                  <span>{new Date(complaint.updatedAt).toLocaleTimeString()}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
