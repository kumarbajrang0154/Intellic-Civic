import * as React from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

export function Dialog({ open, onOpenChange, children }: DialogProps) {
  const [mounted, setMounted] = React.useState(false);

  // Only mount the portal after hydration to avoid SSR mismatch
  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Lock body scroll while modal is open
  React.useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open || !mounted) return null;

  // createPortal renders the dialog as a direct child of <body>,
  // completely outside any parent stacking context, overflow:hidden, or transform.
  // This guarantees true overlay behavior regardless of where Dialog is used in the tree.
  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      {/* Backdrop — semi-transparent scrim, NOT a dark theme: temporary overlay only */}
      <div
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
        aria-hidden="true"
      />
      {/* Modal container — locked card spec + stronger shadow for floating context */}
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          'relative z-10 w-full max-w-lg',
          'bg-white border border-slate-200 shadow-md rounded-xl',
          'flex flex-col max-h-[90vh]',
          'animate-in fade-in zoom-in-95 duration-150',
        )}
      >
        {/* Close button */}
        <button
          type="button"
          aria-label="Close dialog"
          onClick={() => onOpenChange(false)}
          className="absolute top-4 right-4 p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors z-10"
        >
          <X className="w-4 h-4" />
        </button>
        {/* Scrollable inner area — handles tall forms gracefully */}
        <div className="overflow-y-auto p-6">
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}


export function DialogContent({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('space-y-4', className)}>{children}</div>;
}

export function DialogHeader({ children, className }: { children: React.ReactNode; className?: string }) {
  // pr-6 gives breathing room next to the absolute-positioned X close button
  return <div className={cn('space-y-1.5 text-left pr-6', className)}>{children}</div>;
}

export function DialogTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  // text-slate-900 on white = 18.1:1 contrast (far exceeds AA/AAA)
  return <h2 className={cn('text-lg font-semibold tracking-tight text-slate-900', className)}>{children}</h2>;
}

export function DialogDescription({ children, className }: { children: React.ReactNode; className?: string }) {
  // text-slate-600 on white = 6.9:1 (✓ AA) — upgraded from slate-500 (4.6:1, too close to limit)
  return <p className={cn('text-sm text-slate-600 leading-relaxed', className)}>{children}</p>;
}

export function DialogFooter({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-4 mt-4 border-t border-slate-200',
        className,
      )}
    >
      {children}
    </div>
  );
}

