'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

type PriorityLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

const PRIORITY_CONFIG: Record<PriorityLevel, { label: string; className: string; dot: string }> = {
  LOW: {
    label: 'Low',
    className: 'bg-slate-100 text-slate-600 border border-slate-200',
    dot: 'bg-slate-400',
  },
  MEDIUM: {
    label: 'Medium',
    className: 'bg-amber-50 text-amber-700 border border-amber-200',
    dot: 'bg-amber-500',
  },
  HIGH: {
    label: 'High',
    className: 'bg-orange-50 text-orange-700 border border-orange-200',
    dot: 'bg-orange-500',
  },
  CRITICAL: {
    label: 'Critical',
    className: 'bg-red-50 text-red-700 border border-red-200',
    dot: 'bg-red-500',
  },
};

interface PriorityBadgeProps {
  priority: PriorityLevel | string | null | undefined;
  showDot?: boolean;
  className?: string;
}

export function PriorityBadge({ priority, showDot = true, className }: PriorityBadgeProps) {
  if (!priority) {
    return (
      <span className={cn('inline-flex items-center text-xs text-slate-400 italic', className)}>
        Unset
      </span>
    );
  }

  const config = PRIORITY_CONFIG[priority as PriorityLevel] ?? {
    label: priority,
    className: 'bg-slate-100 text-slate-600 border border-slate-200',
    dot: 'bg-slate-400',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
        config.className,
        className,
      )}
    >
      {showDot && (
        <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', config.dot)} />
      )}
      {config.label}
    </span>
  );
}
