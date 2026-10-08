'use client';

import * as React from 'react';
import { AlertTriangle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  initGlobalErrorInterceptor,
  subscribeGlobalError,
  getLatestGlobalError,
  clearLatestGlobalError,
  GlobalErrorInfo,
} from '@/lib/api-client';

export function GlobalErrorPopup() {
  const [errorInfo, setErrorInfo] = React.useState<GlobalErrorInfo | null>(null);
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    initGlobalErrorInterceptor();

    const initial = getLatestGlobalError();
    if (initial) {
      setErrorInfo(initial);
      setOpen(true);
    }

    const unsubscribe = subscribeGlobalError((info) => {
      setErrorInfo(info);
      setOpen(true);
    });

    const handleCustom = (e: any) => {
      if (e.detail) {
        setErrorInfo(e.detail);
        setOpen(true);
      }
    };
    window.addEventListener('civic:global-error', handleCustom);

    return () => {
      unsubscribe();
      window.removeEventListener('civic:global-error', handleCustom);
    };
  }, []);

  const handleClose = () => {
    setOpen(false);
    clearLatestGlobalError();
  };

  if (!errorInfo) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen} data-testid="global-error-popup">
      <DialogContent className="max-w-md p-6" data-testid="global-error-content">
        <DialogHeader className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle data-testid="global-error-title" className="text-lg font-bold text-slate-900">
                {errorInfo.title}
              </DialogTitle>
              {errorInfo.statusCode && (
                <div className="text-xs font-semibold text-rose-600">
                  HTTP Error {errorInfo.statusCode}
                </div>
              )}
            </div>
          </div>
          <DialogDescription data-testid="global-error-message" className="text-sm text-slate-700 leading-relaxed font-medium">
            {errorInfo.message}
          </DialogDescription>
        </DialogHeader>

        {errorInfo.hint && (
          <div
            data-testid="global-error-hint"
            className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-xs text-slate-600 leading-relaxed"
          >
            {errorInfo.hint}
          </div>
        )}

        <DialogFooter className="mt-4 pt-3 flex sm:justify-end">
          <Button
            type="button"
            variant="default"
            data-testid="global-error-close"
            onClick={handleClose}
            className="w-full sm:w-auto font-medium"
          >
            Dismiss
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
