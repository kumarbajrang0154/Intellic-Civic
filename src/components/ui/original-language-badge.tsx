import React from 'react';

interface OriginalLanguageBadgeProps {
  className?: string;
}

export function OriginalLanguageBadge({ className = '' }: OriginalLanguageBadgeProps) {
  return (
    <span
      data-testid="original-language-badge"
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700 shrink-0 ${className}`}
      title="Original language"
    >
      Original language
    </span>
  );
}
