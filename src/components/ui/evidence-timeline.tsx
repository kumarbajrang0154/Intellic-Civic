'use client';

import * as React from 'react';
import Image from 'next/image';
import { Camera, CheckCircle2, Clock, Image as ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface EvidenceItem {
  id: string;
  stage: 'BEFORE' | 'DURING' | 'AFTER';
  imageUrl: string;
  uploadedAt: string;
  notes?: string | null;
  uploadedByName?: string | null;
}

interface EvidenceTimelineProps {
  evidence: EvidenceItem[];
  className?: string;
}

const STAGE_CONFIG = {
  BEFORE: {
    title: 'BEFORE REPAIR',
    color: 'bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-950/20 dark:text-rose-300 dark:border-rose-900/50',
    badge: 'bg-rose-600 text-white',
    icon: Camera,
  },
  DURING: {
    title: 'WORK IN PROGRESS',
    color: 'bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950/20 dark:text-amber-300 dark:border-amber-900/50',
    badge: 'bg-amber-600 text-white',
    icon: Clock,
  },
  AFTER: {
    title: 'AFTER RESOLUTION',
    color: 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-300 dark:border-emerald-900/50',
    badge: 'bg-emerald-600 text-white',
    icon: CheckCircle2,
  },
};

export function EvidenceTimeline({ evidence, className }: EvidenceTimelineProps) {
  const stages: ('BEFORE' | 'DURING' | 'AFTER')[] = ['BEFORE', 'DURING', 'AFTER'];

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
          <Camera className="w-4 h-4 text-ic-blue" />
          Field Verification & Evidence Progression
        </h4>
        <span className="text-xs text-slate-500 font-mono">
          {evidence.length} Photo{evidence.length === 1 ? '' : 's'} Verified
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {stages.map((stageKey) => {
          const cfg = STAGE_CONFIG[stageKey];
          const item = evidence.find((e) => e.stage === stageKey);
          const Icon = cfg.icon;

          return (
            <div
              key={stageKey}
              className={cn(
                'rounded-xl border p-3.5 space-y-3 flex flex-col justify-between transition-all duration-200 shadow-sm',
                item ? cfg.color : 'bg-slate-50/70 border-slate-200 text-slate-400 dark:bg-slate-900/40 dark:border-slate-800',
              )}
            >
              {/* Header Badge */}
              <div className="flex items-center justify-between">
                <span className={cn('px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase shadow-xs', item ? cfg.badge : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400')}>
                  {stageKey}
                </span>
                <span className="text-[11px] font-semibold flex items-center gap-1">
                  <Icon className="w-3.5 h-3.5" />
                  {cfg.title}
                </span>
              </div>

              {/* Photo Box */}
              <div className="relative aspect-video w-full rounded-lg overflow-hidden border border-black/10 bg-slate-100 flex items-center justify-center">
                {item ? (
                  <Image
                    src={item.imageUrl}
                    alt={`${cfg.title} evidence photo`}
                    fill
                    className="object-cover transition-transform duration-300 hover:scale-105"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-1 text-slate-400 p-4 text-center">
                    <ImageIcon className="w-8 h-8 stroke-1 opacity-50" />
                    <span className="text-xs font-medium">Awaiting {stageKey.toLowerCase()} photo</span>
                  </div>
                )}
              </div>

              {/* Timestamp & Notes */}
              {item ? (
                <div className="space-y-1 text-xs pt-1 border-t border-black/5 dark:border-white/5">
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
                    <span>{new Date(item.uploadedAt).toLocaleDateString()}</span>
                    {item.uploadedByName && <span className="font-medium text-slate-700 dark:text-slate-300">{item.uploadedByName}</span>}
                  </div>
                  {item.notes && <p className="text-xs italic text-slate-700 dark:text-slate-300 line-clamp-2">"{item.notes}"</p>}
                </div>
              ) : (
                <div className="text-[11px] text-slate-400 text-center py-1 font-mono">Stage Not Uploaded</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
