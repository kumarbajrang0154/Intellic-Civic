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
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Stepper } from '@/components/ui/stepper';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface ComplaintDetail {
  id: string;
  ticketId: string;
  title: string;
  description: string;
  status: string;
  priority?: string;
  createdAt: string;
  resolvedAt?: string;
  closedAt?: string;
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
  aiPrediction?: {
    rawResponse?: {
      recommendation?: string;
      statusMessage?: string;
    };
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

  React.useEffect(() => {
    async function fetchDetail() {
      if (!id) return;
      setLoading(true);
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
      } catch (err: any) {
        setError(err.message || 'An error occurred loading complaint details');
      } finally {
        setLoading(false);
      }
    }

    fetchDetail();
  }, [id]);

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

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6 max-w-4xl mx-auto space-y-6">
      {/* Header Bar */}
      <div className="flex items-center justify-between border-b pb-4">
        <div className="flex items-center gap-3">
          <Link href="/citizen">
            <Button variant="ghost" size="icon" aria-label="Back to Dashboard">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
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
      </div>

      {/* Progress Stepper Card */}
      <Card className="shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">Resolution Progress</CardTitle>
        </CardHeader>
        <CardContent>
          <Stepper status={complaint.status} />
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
    </div>
  );
}
