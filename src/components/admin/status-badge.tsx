'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

type ComplaintStatus =
  | 'SUBMITTED'
  | 'AI_PROCESSING'
  | 'PENDING_DEPT_REVIEW'
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'RESOLVED'
  | 'CLOSED'
  | 'REJECTED'
  | 'DUPLICATE';

const STATUS_CONFIG: Record<
  ComplaintStatus,
  { label: string; className: string; dot: string }
> = {
  SUBMITTED: {
    label: 'Submitted',
    className: 'bg-slate-100 text-slate-900 border border-slate-300 font-semibold',
    dot: 'bg-slate-600',
  },
  AI_PROCESSING: {
    label: 'AI Processing',
    className: 'bg-purple-100 text-purple-950 border border-purple-300 font-semibold',
    dot: 'bg-purple-600',
  },
  PENDING_DEPT_REVIEW: {
    label: 'Pending Review',
    className: 'bg-amber-100 text-amber-950 border border-amber-300 font-semibold',
    dot: 'bg-amber-600',
  },
  ASSIGNED: {
    label: 'Assigned',
    className: 'bg-blue-100 text-blue-950 border border-blue-300 font-semibold',
    dot: 'bg-blue-600',
  },
  IN_PROGRESS: {
    label: 'In Progress',
    className: 'bg-indigo-100 text-indigo-950 border border-indigo-300 font-semibold',
    dot: 'bg-indigo-600',
  },
  RESOLVED: {
    label: 'Resolved',
    className: 'bg-emerald-100 text-emerald-950 border border-emerald-300 font-semibold',
    dot: 'bg-emerald-600',
  },
  CLOSED: {
    label: 'Closed',
    className: 'bg-slate-200 text-slate-900 border border-slate-400 font-semibold',
    dot: 'bg-slate-700',
  },
  REJECTED: {
    label: 'Rejected',
    className: 'bg-rose-100 text-rose-950 border border-rose-300 font-semibold',
    dot: 'bg-rose-600',
  },
  DUPLICATE: {
    label: 'Duplicate',
    className: 'bg-orange-100 text-orange-950 border border-orange-300 font-semibold',
    dot: 'bg-orange-600',
  },
};

interface StatusBadgeProps {
  status: ComplaintStatus | string;
  showDot?: boolean;
  className?: string;
}

export function StatusBadge({ status, showDot = true, className }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status as ComplaintStatus] ?? {
    label: status,
    className: 'bg-slate-100 text-slate-900 border border-slate-300 font-semibold',
    dot: 'bg-slate-600',
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
