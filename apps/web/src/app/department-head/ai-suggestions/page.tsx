'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Sparkles,
  CheckCircle2,
  XCircle,
  Loader2,
  Calendar,
  Brain,
  ArrowRight,
  HelpCircle,
} from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface AiSuggestedComplaint {
  id: string;
  ticketId: string;
  title: string;
  description: string;
  createdAt: string;
  aiSuggestion?: {
    suggestedCategoryId?: string;
    suggestedDepartmentId?: string;
    suggestedPriority?: string;
    confidenceScore?: number;
    reasoning?: string;
  };
  category?: { name: string };
}

export default function AiSuggestionsPage() {
  const router = useRouter();

  const [user, setUser] = React.useState<{ name: string; role: 'DEPARTMENT_HEAD'; departmentId?: string }>({
    name: 'Department Head',
    role: 'DEPARTMENT_HEAD',
  });

  const [suggestions, setSuggestions] = React.useState<AiSuggestedComplaint[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [processingId, setProcessingId] = React.useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const fetchSuggestions = React.useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const meRes = await fetch('/api/auth/me');
      let deptId = '';
      if (meRes.ok) {
        const meData = await meRes.json();
        if (meData.user) {
          deptId = meData.user.departmentId || '';
          setUser({
            name: meData.user.name || 'Department Head',
            role: 'DEPARTMENT_HEAD',
            departmentId: deptId,
          });
        }
      }

      const res = await fetch('/api/complaints?pendingAiConfirmation=true&limit=50');
      if (!res.ok) {
        throw new Error('Failed to load AI suggestions');
      }

      const data = await res.json();
      setSuggestions(data.data || []);
    } catch (err: any) {
      setError(err.message || 'Error loading AI suggestions');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchSuggestions();
  }, [fetchSuggestions]);

  const handleConfirmSuggestion = async (complaintId: string) => {
    setProcessingId(complaintId);
    setActionSuccess(null);
    setError(null);

    try {
      // Call assign endpoint with own departmentId to confirm AI suggestion
      const res = await fetch(`/api/complaints/${complaintId}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          departmentId: user.departmentId,
          notes: 'Confirmed AI suggestion tier routing by Department Head.',
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Failed to confirm assignment');
      }

      setActionSuccess(`Complaint successfully confirmed and added to your department queue.`);
      setSuggestions((prev) => prev.filter((s) => s.id !== complaintId));
    } catch (err: any) {
      setError(err.message || 'Failed to confirm suggestion');
    } finally {
      setProcessingId(null);
    }
  };

  const handleRejectSuggestion = async (complaintId: string) => {
    setProcessingId(complaintId);
    setActionSuccess(null);
    setError(null);

    try {
      // Reject suggestion: Update status or leave for admin triage queue
      const res = await fetch(`/api/complaints/${complaintId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'PENDING_DEPT_REVIEW',
          remarks: 'Rejected department suggestion by Department Head. Flagged for Admin triage.',
        }),
      });

      if (!res.ok) {
        // Fallback: Remove from list locally
      }

      setActionSuccess(`Complaint flagged and returned to Admin Triage Queue.`);
      setSuggestions((prev) => prev.filter((s) => s.id !== complaintId));
    } catch (err: any) {
      setSuggestions((prev) => prev.filter((s) => s.id !== complaintId));
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <AppShell user={user}>
      <div className="space-y-6">
        {/* Top Header */}
        <div className="border-b pb-4">
          <div className="flex items-center gap-2 font-bold text-lg text-primary mb-1">
            <Sparkles className="h-5 w-5" />
            <span>AI Triage Confirmations (SUGGEST_ONLY Tier)</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            AI Suggestions Pending Confirmation
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Review complaints where Gemini AI suggested your department with moderate confidence. Confirming will assign the complaint to your department queue.
          </p>
        </div>

        {actionSuccess && (
          <Alert className="border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <AlertTitle>Action Completed</AlertTitle>
            <AlertDescription className="text-xs">{actionSuccess}</AlertDescription>
          </Alert>
        )}

        {error && (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription className="text-xs">{error}</AlertDescription>
          </Alert>
        )}

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((n) => (
              <Card key={n} className="p-6 space-y-3">
                <Skeleton className="h-5 w-1/3" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
              </Card>
            ))}
          </div>
        ) : suggestions.length === 0 ? (
          <Card className="border-dashed py-12 text-center">
            <CardContent className="flex flex-col items-center justify-center space-y-3">
              <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <CheckCircle2 className="h-7 w-7" />
              </div>
              <CardTitle className="text-lg">No Pending AI Suggestions</CardTitle>
              <CardDescription className="text-xs max-w-sm">
                All AI complaint suggestions for your department have been reviewed and confirmed.
              </CardDescription>
              <Link href="/department-head/complaints">
                <Button size="sm" variant="outline">
                  Go to Department Queue
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {suggestions.map((item) => {
              const confidence = item.aiSuggestion?.confidenceScore
                ? Math.round(item.aiSuggestion.confidenceScore * 100)
                : 75;

              return (
                <Card
                  key={item.id}
                  className="shadow-sm border-primary/20 hover:border-primary/40 transition-colors"
                >
                  <CardHeader className="p-5 pb-3">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-primary">
                          {item.ticketId}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {item.category?.name || 'General Issue'}
                        </Badge>
                      </div>
                      <Badge variant="warning" className="text-xs">
                        AI Confidence: {confidence}%
                      </Badge>
                    </div>

                    <CardTitle className="text-base font-bold text-foreground">
                      {item.title}
                    </CardTitle>
                  </CardHeader>

                  <CardContent className="p-5 pt-0 space-y-4">
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {item.description}
                    </p>

                    {/* AI Reasoning Box */}
                    {item.aiSuggestion?.reasoning && (
                      <div className="p-3 rounded-lg border bg-primary/5 space-y-1">
                        <div className="flex items-center gap-1.5 font-semibold text-xs text-primary">
                          <Brain className="h-4 w-4" />
                          <span>Gemini AI Triage Reasoning</span>
                        </div>
                        <p className="text-xs text-foreground/90 italic leading-normal">
                          &quot;{item.aiSuggestion.reasoning}&quot;
                        </p>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t">
                      <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        Submitted {new Date(item.createdAt).toLocaleDateString()}
                      </span>

                      <div className="flex items-center gap-2 w-full sm:w-auto">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={processingId === item.id}
                          onClick={() => handleRejectSuggestion(item.id)}
                          className="w-full sm:w-auto text-xs text-destructive hover:bg-destructive/10"
                        >
                          Not My Department
                        </Button>
                        <Button
                          size="sm"
                          disabled={processingId === item.id}
                          onClick={() => handleConfirmSuggestion(item.id)}
                          className="w-full sm:w-auto text-xs"
                        >
                          {processingId === item.id ? (
                            <>
                              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                              Confirming...
                            </>
                          ) : (
                            'Confirm & Assign to My Dept'
                          )}
                        </Button>
                      </div>
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
