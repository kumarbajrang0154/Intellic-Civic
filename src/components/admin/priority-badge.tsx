'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

type PriorityLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

const PRIORITY_CONFIG: Record<PriorityLevel, { label: string; className: string; dot: string }> = {
  LOW: {
    label: 'Low',
    className: 'bg-blue-100 text-blue-950 border border-blue-300 font-semibold',
    dot: 'bg-blue-600',
  },
  MEDIUM: {
    label: 'Medium',
    className: 'bg-amber-100 text-amber-950 border border-amber-300 font-semibold',
    dot: 'bg-amber-600',
  },
  HIGH: {
    label: 'High',
    className: 'bg-orange-100 text-orange-950 border border-orange-300 font-bold',
    dot: 'bg-orange-600',
  },
  CRITICAL: {
    label: 'Critical',
    className: 'bg-rose-100 text-rose-950 border border-rose-300 font-bold',
    dot: 'bg-rose-600',
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
      <span className={cn('inline-flex items-center text-xs text-slate-600 italic font-medium', className)}>
        Unset
      </span>
    );
  }

  const config = PRIORITY_CONFIG[priority as PriorityLevel] ?? {
    label: priority,
    className: 'bg-blue-100 text-blue-950 border border-blue-300 font-semibold',
    dot: 'bg-blue-600',
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
