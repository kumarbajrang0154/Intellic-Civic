'use client';

import * as React from 'react';
import { Sparkles, Brain } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AICardProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  subtitle?: string;
  badgeText?: string;
  children: React.ReactNode;
  variant?: 'indigo' | 'outline' | 'subtle';
}

export function AICard({
  title = 'AI Civic Intelligence',
  subtitle,
  badgeText = 'Automated Triaging',
  children,
  variant = 'indigo',
  className,
  ...props
}: AICardProps) {
  return (
    <div
      className={cn(
        'relative rounded-xl border border-slate-200 bg-white shadow-xs transition-all duration-200 overflow-hidden border-l-4 border-l-indigo-600',
        variant === 'indigo' && 'border-slate-200 text-slate-900',
        variant === 'outline' && 'border-indigo-200 text-slate-900',
        variant === 'subtle' && 'bg-slate-50/50 border-slate-200 text-slate-900',
        className,
      )}
      {...props}
    >
      <div className="p-5 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-sm sm:text-base tracking-tight text-slate-900 leading-tight">
                  {title}
                </h3>
              </div>
              {subtitle && (
                <p className="text-xs text-slate-500 mt-0.5">
                  {subtitle}
                </p>
              )}
            </div>
          </div>

          {badgeText && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold tracking-wide uppercase bg-indigo-50 text-indigo-700 border border-indigo-200">
              <Brain className="w-3 h-3 text-indigo-600" />
              {badgeText}
            </span>
          )}
        </div>

        {/* Card Body */}
        <div className="text-sm space-y-3 text-slate-700">{children}</div>
      </div>
    </div>
  );
}

