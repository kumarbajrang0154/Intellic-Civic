import * as React from 'react';
import { Check, Clock, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

export interface StepperProps {
  status: string;
  className?: string;
}

interface StepItem {
  id: string;
  label: string;
  statuses: string[];
}

const STEPPER_STAGES: StepItem[] = [
  { id: 'submitted', label: 'Submitted', statuses: ['SUBMITTED', 'AI_PROCESSING'] },
  { id: 'review', label: 'Under Review', statuses: ['PENDING_DEPT_REVIEW'] },
  { id: 'assigned', label: 'Assigned', statuses: ['ASSIGNED'] },
  { id: 'progress', label: 'In Progress', statuses: ['IN_PROGRESS'] },
  { id: 'resolved', label: 'Resolved', statuses: ['RESOLVED', 'CLOSED'] },
];

export function Stepper({ status, className }: StepperProps) {
  // Handle Special/Terminal States
  if (status === 'REJECTED') {
    return (
      <div className="p-4 rounded-xl border border-destructive/30 bg-destructive/5 space-y-2 text-destructive">
        <div className="flex items-center gap-2 font-bold text-base">
          <AlertTriangle className="h-5 w-5" />
          <span>Complaint Rejected</span>
        </div>
        <p className="text-xs text-muted-foreground">
          This complaint has been reviewed and rejected by municipal authorities.
        </p>
      </div>
    );
  }

  if (status === 'DUPLICATE') {
    return (
      <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/5 space-y-2 text-amber-900 dark:text-amber-200">
        <div className="flex items-center gap-2 font-bold text-base">
          <AlertTriangle className="h-5 w-5 text-amber-600" />
          <span>Marked as Duplicate</span>
        </div>
        <p className="text-xs text-muted-foreground">
          This complaint was identified as a duplicate of an existing ticket in the same location.
        </p>
      </div>
    );
  }

  // Find active step index
  let activeIndex = STEPPER_STAGES.findIndex((stage) =>
    stage.statuses.includes(status),
  );

  if (activeIndex === -1) {
    activeIndex = 0; // Default fallback
  }

  return (
    <div className={cn('w-full py-4', className)}>
      <div className="flex items-center justify-between relative">
        {/* Connecting Line Background */}
        <div className="absolute top-4 left-6 right-6 h-0.5 bg-muted -z-0" />

        {/* Progress Fill Line */}
        <div
          className="absolute top-4 left-6 h-0.5 bg-primary transition-all duration-300 -z-0"
          style={{
            width: `${(activeIndex / (STEPPER_STAGES.length - 1)) * 100}%`,
          }}
        />

        {/* Step Nodes */}
        {STEPPER_STAGES.map((stage, idx) => {
          const isCompleted = idx < activeIndex;
          const isCurrent = idx === activeIndex;

          return (
            <div
              key={stage.id}
              className="flex flex-col items-center relative z-10 space-y-2 group"
            >
              <div
                className={cn(
                  'h-8 w-8 rounded-full flex items-center justify-center font-bold text-xs transition-colors border-2 bg-background',
                  {
                    'border-primary bg-primary text-primary-foreground': isCompleted,
                    'border-primary text-primary ring-4 ring-primary/20': isCurrent,
                    'border-muted text-muted-foreground': !isCompleted && !isCurrent,
                  },
                )}
              >
                {isCompleted ? (
                  <Check className="h-4 w-4" />
                ) : isCurrent ? (
                  <Clock className="h-4 w-4 animate-pulse" />
                ) : (
                  <span>{idx + 1}</span>
                )}
              </div>
              <span
                className={cn(
                  'text-xs font-medium text-center max-w-[70px] sm:max-w-none',
                  {
                    'text-primary font-semibold': isCurrent,
                    'text-foreground font-medium': isCompleted,
                    'text-muted-foreground': !isCompleted && !isCurrent,
                  },
                )}
              >
                {stage.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
