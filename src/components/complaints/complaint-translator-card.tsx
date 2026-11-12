'use client';

import React, { useState } from 'react';
import { Languages, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SUPPORTED_AUTO_TRANSLATION_LANGUAGES } from '@/lib/complaint-language';

export function ComplaintTranslatorCard({ complaintId }: { complaintId: string }) {
  const [selectedLang, setSelectedLang] = useState<'en' | 'hi' | 'ta' | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [translated, setTranslated] = useState<{
    title: string;
    description: string;
    provider: string;
    targetLanguage: string;
  } | null>(null);

  async function handleTranslate(lang: 'en' | 'hi' | 'ta') {
    setSelectedLang(lang);
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/complaints/${complaintId}/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetLanguage: lang }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.message || 'Unable to translate complaint.');
      }
      setTranslated({
        title: data.title,
        description: data.description,
        provider: data.provider,
        targetLanguage: data.targetLanguage,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Translation failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="shadow-sm border border-slate-200 bg-white">
      <CardHeader className="p-4 pb-2 flex flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle className="text-sm font-bold flex items-center gap-1.5">
          <Languages className="h-4 w-4 text-primary" />
          Auto-Translation (English / Hindi / Tamil)
        </CardTitle>
        <div className="flex items-center gap-1.5 flex-wrap">
          {SUPPORTED_AUTO_TRANSLATION_LANGUAGES.map((opt) => (
            <Button
              key={opt.code}
              type="button"
              size="sm"
              variant={selectedLang === opt.code ? 'default' : 'outline'}
              disabled={loading}
              onClick={() => handleTranslate(opt.code)}
              className="h-7 px-2.5 text-xs"
            >
              {loading && selectedLang === opt.code ? (
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
              ) : null}
              {opt.label}
            </Button>
          ))}
        </div>
      </CardHeader>

      <CardContent className="p-4 pt-2">
        {error && <p className="text-xs text-rose-700">{error}</p>}
        {translated && !error && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-1.5">
            <div className="flex items-center justify-between text-[11px] text-slate-500 uppercase">
              <span>Language: {translated.targetLanguage}</span>
              <span>Source: {translated.provider}</span>
            </div>
            <p className="text-sm font-semibold text-slate-900">{translated.title}</p>
            <p className="text-xs text-slate-700 whitespace-pre-wrap">{translated.description}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

