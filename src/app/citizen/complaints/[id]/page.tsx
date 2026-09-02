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
  CheckCircle2,
  AlertCircle,
  ImageIcon,
  Loader2,
  FileQuestion,
  Star,
  RefreshCw,
  RotateCcw,
  ThumbsUp,
  MessageSquare,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Stepper } from '@/components/ui/stepper';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

interface ComplaintDetail {
  id: string;
  ticketId: string;
  title: string;
  description: string;
  status: string;
  priority?: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
  closedAt?: string;
  category?: { id: string; name: string } | null;
  originalCategory?: { id: string; name: string } | null;
  department?: { id: string; name: string } | null;
  location?: { address?: string; latitude?: number; longitude?: number } | null;
  evidence?: { id: string; imageUrl: string; stage: string; uploadedAt: string }[];
  statusHistory?: {
    id: string;
    fromStatus?: string;
    toStatus: string;
    changedAt: string;
    changedByUser?: { name: string };
    notes?: string;
  }[];
  aiPrediction?: {
    rawResponse?: {
      recommendation?: string;
      statusMessage?: string;
    };
  };
  reopenCount?: number;
  reopenedAt?: string;
  reopenReason?: string;
  resolutionNotes?: string;
  feedback?: {
    id: string;
    rating: number;
    comment?: string;
    createdAt: string;
  };
}

export default function CitizenComplaintDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [complaint, setComplaint] = React.useState<ComplaintDetail | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [notFound, setNotFound] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = React.useState<string | null>(null);

  // Post-resolution action states
  const [actionLoading, setActionLoading] = React.useState(false);
  const [reopenModalOpen, setReopenModalOpen] = React.useState(false);
  const [reopenReason, setReopenReason] = React.useState('');
  const [reopenError, setReopenError] = React.useState('');

  // Feedback form state
  const [feedbackRating, setFeedbackRating] = React.useState<number>(5);
  const [feedbackComment, setFeedbackComment] = React.useState('');
  const [submittingFeedback, setSubmittingFeedback] = React.useState(false);
  const [feedbackError, setFeedbackError] = React.useState('');

  const fetchDetail = React.useCallback(
    async (isBackground = false) => {
      if (!id) return;
      if (!isBackground) setLoading(true);
      setNotFound(false);

      try {
        const res = await fetch(`/api/complaints/${id}`);

        if (res.status === 404) {
          setNotFound(true);
          return;
        }

        if (!res.ok) {
          throw new Error('Failed to load complaint details');
        }

        const data = await res.json();
        setComplaint(data);
        setLastUpdated(new Date().toLocaleTimeString());
      } catch (err: any) {
        if (!isBackground) setError(err.message || 'An error occurred loading complaint details');
      } finally {
        if (!isBackground) setLoading(false);
      }
    },
    [id],
  );

  React.useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  // Batch D — 30-Second Polling Fallback for Status Updates
  React.useEffect(() => {
    const interval = setInterval(() => {
      fetchDetail(true);
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchDetail]);

  // ---------------------------------------------------------------------------
  // BATCH A — POST RESOLUTION HANDLERS
  // ---------------------------------------------------------------------------
  const handleMarkSatisfactory = async () => {
    if (!complaint) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/complaints/${complaint.id}/mark-satisfactory`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to mark as satisfactory');
      }
      toast.success('Complaint closed as satisfactory. Thank you for your feedback!');
      fetchDetail();
    } catch (err: any) {
      toast.error(err.message || 'Error updating complaint status');
    } fontally: {
      setActionLoading(false);
    }
  };

  const handleReopenComplaint = async () => {
    if (!complaint) return;
    if (!reopenReason.trim() || reopenReason.trim().length < 10) {
      setReopenError('Reopen reason must be at least 10 characters.');
      return;
    }

    setActionLoading(true);
    setReopenError('');
    try {
      const res = await fetch(`/api/complaints/${complaint.id}/reopen`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reopenReason.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to reopen complaint');
      }
      toast.success('Complaint reopened and routed back to handling department.');
      setReopenModalOpen(false);
      setReopenReason('');
      fetchDetail();
    } catch (err: any) {
      setReopenError(err.message || 'Error reopening complaint');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSubmitFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!complaint) return;
    setSubmittingFeedback(true);
    setFeedbackError('');

    try {
      const res = await fetch(`/api/complaints/${complaint.id}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rating: feedbackRating,
          comment: feedbackComment.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to submit feedback');
      }
      toast.success('Thank you! Your rating and comments have been recorded.');
      fetchDetail();
    } catch (err: any) {
      setFeedbackError(err.message || 'Error submitting feedback');
    } finally {
      setSubmittingFeedback(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center space-y-4">
        <Loader2 className="h-8 w-8 text-primary animate-spin" />
        <p className="text-sm text-muted-foreground font-medium">Loading complaint tracking detail...</p>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center shadow-lg border-muted">
          <CardHeader className="space-y-3">
            <div className="mx-auto h-16 w-16 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
              <FileQuestion className="h-8 w-8" />
            </div>
            <CardTitle className="text-xl">Complaint Not Found</CardTitle>
            <CardDescription>
              The requested complaint ticket does not exist or you do not have permission to view it.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/citizen">
              <Button className="w-full">Return to Dashboard</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !complaint) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center border-destructive/20 bg-destructive/5">
          <CardContent className="pt-6 space-y-4">
            <AlertCircle className="h-8 w-8 text-destructive mx-auto" />
            <p className="text-sm text-destructive font-medium">{error || 'Failed to load details'}</p>
            <Link href="/citizen">
              <Button variant="outline" size="sm">
                Back to Dashboard
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const sanitizedAiStatus =
    complaint.aiPrediction?.rawResponse?.statusMessage || 'Evidence submitted for staff review';

  // Batch C: AI category override detection
  const isCategoryOverridden =
    complaint.originalCategory &&
    complaint.category &&
    complaint.originalCategory.id !== complaint.category.id;

  // Latest resolution note or staff reason
  const latestReasonNote =
    complaint.resolutionNotes ||
    complaint.statusHistory?.find((h) => h.notes && h.notes.length > 0)?.notes;

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6 max-w-4xl mx-auto space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
        <div className="flex items-center gap-3">
          <Link href="/citizen">
            <Button variant="ghost" size="icon" aria-label="Back to Dashboard">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-sm font-bold text-primary">
                {complaint.ticketId}
              </span>
              {complaint.category && (
                <Badge variant="outline" className="text-xs">
                  {complaint.category.name}
                </Badge>
              )}
            </div>
            <h1 className="text-xl font-bold text-foreground line-clamp-1">
              {complaint.title}
            </h1>
          </div>
        </div>

        {/* Live Auto-Refresh Status Pill */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground self-end sm:self-center">
          <RefreshCw className="h-3.5 w-3.5 text-primary animate-spin" />
          <span>Auto-polling (Updated {lastUpdated})</span>
        </div>
      </div>

      {/* Progress Stepper Card */}
      <Card className="shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">Resolution Progress</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Stepper status={complaint.status} />

          {/* Batch C: Rejection / Duplicate Specific Staff Reason Display */}
          {(complaint.status === 'REJECTED' || complaint.status === 'DUPLICATE') && latestReasonNote && (
            <Alert variant={complaint.status === 'REJECTED' ? 'destructive' : 'default'} className="mt-3">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle className="font-bold text-sm">
                Official Municipal Note ({complaint.status.replace('_', ' ')})
              </AlertTitle>
              <AlertDescription className="text-xs mt-1 leading-relaxed">
                {latestReasonNote}
              </AlertDescription>
            </Alert>
          )}

          {/* Batch C: Category Override Badge Notice */}
          {isCategoryOverridden && (
            <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg text-xs flex items-center gap-2 text-foreground">
              <Sparkles className="h-4 w-4 text-primary shrink-0" />
              <span>
                <strong>Category Reclassified:</strong> Originally filed under{' '}
                <span className="underline">{complaint.originalCategory?.name}</span>, reclassified by AI/Staff to{' '}
                <span className="font-bold text-primary">{complaint.category?.name}</span> for faster resolution.
              </span>
            </div>
          )}

          {/* Batch A: Post-Resolution Decision Bar (Shown when RESOLVED) */}
          {complaint.status === 'RESOLVED' && (
            <div className="p-4 bg-emerald-500/10 border-2 border-emerald-500/30 rounded-xl space-y-3">
              <div className="flex items-center gap-2 text-emerald-900 dark:text-emerald-200 font-bold text-sm">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                <span>Department Marked This Complaint as Resolved!</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Please verify the work done. If satisfied, mark it satisfactory to close the ticket. If the issue persists, you may reopen this ticket.
              </p>
              <div className="flex flex-col sm:flex-row items-center gap-3 pt-1">
                <Button
                  onClick={handleMarkSatisfactory}
                  disabled={actionLoading}
                  className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs gap-1.5"
                >
                  <ThumbsUp className="h-4 w-4" />
                  {actionLoading ? 'Closing Ticket...' : 'Mark as Satisfactory & Close'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setReopenModalOpen(true)}
                  disabled={actionLoading}
                  className="w-full sm:w-auto border-amber-500 text-amber-700 hover:bg-amber-50 dark:text-amber-300 font-bold text-xs gap-1.5"
                >
                  <RotateCcw className="h-4 w-4" />
                  Reopen Complaint
                </Button>
              </div>
            </div>
          )}

          {/* Batch A: Feedback Rating Form (Shown when RESOLVED or CLOSED) */}
          {['RESOLVED', 'CLOSED'].includes(complaint.status) && (
            <Card className="border shadow-sm bg-muted/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                  <span>Resolution Experience Feedback</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {complaint.feedback ? (
                  /* Read-Only Submitted Feedback */
                  <div className="p-3 bg-background border rounded-lg text-xs space-y-1.5">
                    <div className="flex items-center gap-1">
                      <span className="font-bold text-foreground">Your Rating:</span>
                      <div className="flex items-center text-amber-500">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            className={`h-3.5 w-3.5 ${
                              star <= complaint.feedback!.rating
                                ? 'fill-amber-500 text-amber-500'
                                : 'text-slate-300'
                            }`}
                          />
                        ))}
                      </div>
                      <span className="font-bold ml-1">({complaint.feedback.rating}/5)</span>
                    </div>
                    {complaint.feedback.comment && (
                      <p className="text-muted-foreground italic">"{complaint.feedback.comment}"</p>
                    )}
                    <span className="text-[10px] text-muted-foreground block pt-1">
                      Submitted on {new Date(complaint.feedback.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                ) : (
                  /* Submit Feedback Form */
                  <form onSubmit={handleSubmitFeedback} className="space-y-3 text-xs">
                    {feedbackError && (
                      <Alert variant="destructive" className="text-xs">
                        <AlertDescription>{feedbackError}</AlertDescription>
                      </Alert>
                    )}
                    <div className="space-y-1">
                      <label className="font-semibold block">Rate overall resolution quality:</label>
                      <div className="flex items-center gap-2 py-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            type="button"
                            onClick={() => setFeedbackRating(star)}
                            className="p-1 hover:scale-110 transition-transform focus:outline-none"
                          >
                            <Star
                              className={`h-6 w-6 ${
                                star <= feedbackRating
                                  ? 'fill-amber-500 text-amber-500'
                                  : 'text-slate-300'
                              }`}
                            />
                          </button>
                        ))}
                        <span className="font-bold text-sm text-amber-600 ml-2">
                          {feedbackRating} / 5 Stars
                        </span>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label htmlFor="comment" className="font-semibold block">Comments / Review (Optional):</label>
                      <Textarea
                        id="comment"
                        rows={2}
                        placeholder="Share your thoughts on the promptness and quality of municipal work..."
                        value={feedbackComment}
                        onChange={(e) => setFeedbackComment(e.target.value)}
                        className="text-xs"
                      />
                    </div>

                    <Button
                      type="submit"
                      disabled={submittingFeedback}
                      size="sm"
                      className="bg-primary text-xs font-semibold"
                    >
                      {submittingFeedback ? 'Submitting...' : 'Submit Feedback'}
                    </Button>
                  </form>
                )}
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Main Complaint Info (Left 2 Columns) */}
        <div className="md:col-span-2 space-y-6">
          {/* Description Card */}
          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Complaint Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-foreground leading-relaxed whitespace-pre-line">
                {complaint.description}
              </p>

              {/* Location */}
              {complaint.location && (
                <div className="flex items-start gap-2.5 p-3 rounded-lg border bg-muted/40 text-xs text-muted-foreground">
                  <MapPin className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-foreground block mb-0.5">Location</span>
                    <span>{complaint.location.address || 'Coordinates provided'}</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Evidence Photos Gallery */}
          <Card className="shadow-sm">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold">Photo Evidence</CardTitle>
                <CardDescription className="text-xs">{sanitizedAiStatus}</CardDescription>
              </div>
              <Badge variant="secondary" className="text-xs">
                {complaint.evidence?.length || 0} Photo(s)
              </Badge>
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
                        alt="Complaint evidence"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <div className="absolute inset-x-0 bottom-0 bg-black/60 p-1.5 text-[10px] text-white font-medium flex items-center justify-between">
                        <span className="uppercase">{ev.stage}</span>
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic py-4 text-center">
                  No photo evidence attached to this complaint.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Timeline History */}
          {complaint.statusHistory && complaint.statusHistory.length > 0 && (
            <Card className="shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold">Activity & Status History</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="relative border-l-2 border-primary/20 pl-4 space-y-4 py-2">
                  {complaint.statusHistory.map((item) => (
                    <div key={item.id} className="relative space-y-1">
                      <div className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-primary ring-4 ring-background" />
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-foreground">
                          Status updated to {item.toStatus.replace(/_/g, ' ')}
                        </span>
                        <span className="text-muted-foreground">
                          {new Date(item.changedAt).toLocaleString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      {item.changedByUser && (
                        <p className="text-[11px] text-muted-foreground">
                          Updated by {item.changedByUser.name}
                        </p>
                      )}
                      {item.notes && (
                        <p className="text-xs text-slate-600 bg-muted/50 p-2 rounded border mt-1 font-mono">
                          {item.notes}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar Info (Right Column) */}
        <div className="space-y-6">
          {/* Department Handling */}
          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary" />
                <span>Assigned Department</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs space-y-2">
              {complaint.department ? (
                <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 font-medium text-foreground">
                  {complaint.department.name}
                </div>
              ) : (
                <div className="p-3 rounded-lg bg-muted border text-muted-foreground text-xs leading-relaxed">
                  Your complaint is currently being reviewed in triage and will be assigned to the right municipal department shortly.
                </div>
              )}
            </CardContent>
          </Card>

          {/* Submission Info */}
          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                <span>Ticket Details</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs space-y-3">
              <div className="flex justify-between border-b pb-2">
                <span className="text-muted-foreground">Submitted On</span>
                <span className="font-medium text-foreground">
                  {new Date(complaint.createdAt).toLocaleDateString()}
                </span>
              </div>
              <div className="flex justify-between border-b pb-2">
                <span className="text-muted-foreground">Category</span>
                <span className="font-medium text-foreground">
                  {complaint.category?.name || 'General'}
                </span>
              </div>
              {complaint.reopenCount && complaint.reopenCount > 0 ? (
                <div className="flex justify-between border-b pb-2 text-amber-700 font-bold">
                  <span>Reopen Bounces</span>
                  <span>{complaint.reopenCount} time(s)</span>
                </div>
              ) : null}
              {complaint.priority && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Priority Level</span>
                  <span className="font-semibold text-primary">{complaint.priority}</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Reopen Modal Dialog */}
      <Dialog open={reopenModalOpen} onOpenChange={setReopenModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-amber-700 flex items-center gap-2">
              <RotateCcw className="h-5 w-5" />
              Reopen Resolved Complaint
            </DialogTitle>
            <DialogDescription>
              If the municipal issue is not completely resolved or has recurred, describe why below. The ticket will be routed back to the department.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {reopenError && (
              <Alert variant="destructive" className="text-xs">
                <AlertDescription>{reopenError}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-1">
              <label htmlFor="reopenReason" className="text-xs font-semibold text-foreground">
                Detailed Reason for Reopening <span className="text-destructive">*</span>
              </label>
              <Textarea
                id="reopenReason"
                rows={4}
                placeholder="Explain why the resolution is incomplete or unsatisfactory (min 10 characters)..."
                value={reopenReason}
                onChange={(e) => setReopenReason(e.target.value)}
                className="text-xs"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReopenModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleReopenComplaint}
              disabled={actionLoading}
              className="bg-amber-600 hover:bg-amber-700 text-white font-bold"
            >
              {actionLoading ? 'Reopening...' : 'Confirm & Reopen Ticket'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
