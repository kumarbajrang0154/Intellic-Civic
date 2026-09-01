'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';

interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
  className?: string;
}

export function Sheet({
  open,
  onOpenChange,
  children,
  side = 'left',
  className,
}: SheetProps) {
  if (!open) return null;

  const sideStyles = {
    top: 'top-0 inset-x-0 border-b',
    bottom: 'bottom-0 inset-x-0 border-t',
    left: 'left-0 inset-y-0 w-3/4 max-w-sm border-r',
    right: 'right-0 inset-y-0 w-3/4 max-w-sm border-l',
  };

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
        onClick={() => onOpenChange(false)}
        aria-hidden="true"
      />

      {/* Drawer Content */}
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          'fixed z-50 bg-card p-6 shadow-lg transition ease-in-out duration-300',
          sideStyles[side],
          className,
        )}
      >
        <button
          onClick={() => onOpenChange(false)}
          className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          aria-label="Close panel"
        >
          <X className="h-4 w-4" />
        </button>
        {children}
      </div>
    </div>
  );
}
