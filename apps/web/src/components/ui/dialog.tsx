import * as React from 'react';
import { cn } from '@/lib/utils';

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

export function Dialog({ open, onOpenChange, children }: DialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        className="fixed inset-0"
        onClick={() => onOpenChange(false)}
      />
      <div className="relative z-10 w-full max-w-lg rounded-lg bg-white p-6 shadow-lg border animate-in fade-in zoom-in-95">
        {children}
      </div>
    </div>
  );
}

export function DialogContent({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('space-y-4', className)}>{children}</div>;
}

export function DialogHeader({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('space-y-1.5 text-left', className)}>{children}</div>;
}

export function DialogTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return <h2 className={cn('text-lg font-semibold tracking-tight text-slate-900', className)}>{children}</h2>;
}

export function DialogDescription({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn('text-sm text-slate-500', className)}>{children}</p>;
}

export function DialogFooter({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-4 border-t', className)}>{children}</div>;
}
