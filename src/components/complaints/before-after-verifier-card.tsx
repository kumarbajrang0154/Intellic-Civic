'use client';

import React, { useState } from 'react';
import { Camera, CheckCircle2, Loader2, ShieldAlert, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface VerificationState {
  beforeImageUrl: string;
  afterImageUrl: string;
  beforeSource: 'EVIDENCE_BEFORE' | 'INTAKE_IMAGE';
  verification: {
    workVerified: boolean;
    issueResolved: boolean;
    sameLocationLikelihood: number;
    confidence: number;
    summary: string;
    provider: 'gemini' | 'heuristic';
  };
}

export function BeforeAfterVerifierCard({ complaintId }: { complaintId: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<VerificationState | null>(null);

  async function runVerification() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/complaints/${complaintId}/verify-before-after`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.message || 'Unable to run before/after photo verification.');
      }
      setResult(data as VerificationState);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="shadow-sm border border-slate-200 bg-white">
      <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between gap-2">
        <div>
          <CardTitle className="text-sm font-bold flex items-center gap-1.5">
            <Camera className="h-4 w-4 text-primary" />
            Before / After AI Photo Verification
          </CardTitle>
          <CardDescription className="text-xs">
            Compare pre-work vs post-repair evidence before closing this complaint.
          </CardDescription>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={runVerification}
          disabled={loading}
          className="h-8 text-xs gap-1.5 shrink-0"
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Sparkles className="h-3.5 w-3.5 text-primary" />
          )}
          {loading ? 'Inspecting...' : 'Compare Photos'}
        </Button>
      </CardHeader>

      <CardContent className="p-4 pt-2 space-y-3">
        {error && (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            {error}
          </div>
        )}

        {result && (
          <div className="space-y-3">
            <div className="flex items-center flex-wrap gap-2">
              {result.verification.workVerified ? (
                <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-xs gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  Work Verified
                </Badge>
              ) : (
                <Badge className="bg-rose-100 text-rose-800 border-rose-200 text-xs gap-1">
                  <ShieldAlert className="h-3 w-3" />
                  Needs Officer Review
                </Badge>
              )}
              <Badge variant="outline" className="text-[11px]">
                Confidence: {Math.round(result.verification.confidence * 100)}%
              </Badge>
              <Badge variant="outline" className="text-[11px] uppercase">
                {result.verification.provider}
              </Badge>
            </div>
            <p className="text-xs text-slate-700 leading-relaxed">{result.verification.summary}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

