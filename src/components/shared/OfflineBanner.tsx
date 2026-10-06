'use client';

import * as React from 'react';
import { Wifi, WifiOff } from 'lucide-react';

export function OfflineBanner() {
  const [isOnline, setIsOnline] = React.useState(true);
  const [showReconnected, setShowReconnected] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;

    setIsOnline(navigator.onLine);

    const triggerGlobalSync = async () => {
      if (typeof window === 'undefined' || !navigator.onLine) return;
      try {
        const { getDrafts, syncDrafts } = await import('@/lib/offline-queue');
        const drafts = await getDrafts();
        if (drafts.some((d) => d.status === 'pending' || d.status === 'syncing')) {
          await syncDrafts();
        }
      } catch {}
    };

    if (navigator.onLine) {
      triggerGlobalSync();
    }

    let timer: any = null;
    const handleOnline = () => {
      setIsOnline(true);
      setShowReconnected(true);
      triggerGlobalSync();
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => setShowReconnected(false), 4000);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowReconnected(false);
      if (timer) clearTimeout(timer);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        triggerGlobalSync();
      }
    };

    const intervalTimer = setInterval(() => {
      if (navigator.onLine) {
        triggerGlobalSync();
      }
    }, 30000);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (timer) clearTimeout(timer);
      clearInterval(intervalTimer);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  if (isOnline && !showReconnected) {
    return null;
  }

  if (!isOnline) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="w-full bg-amber-600 text-amber-50 px-4 py-2 text-xs md:text-sm font-medium flex items-center justify-center gap-2 shadow-sm transition-all"
      >
        <WifiOff className="w-4 h-4 shrink-0 animate-pulse text-amber-200" />
        <span>
          <strong>Offline Mode:</strong> You are currently offline. New complaints will be saved locally and submitted automatically once reconnected.
        </span>
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="w-full bg-emerald-600 text-emerald-50 px-4 py-2 text-xs md:text-sm font-medium flex items-center justify-center gap-2 shadow-sm animate-in fade-in transition-all"
    >
      <Wifi className="w-4 h-4 shrink-0 text-emerald-200" />
      <span>
        <strong>Back Online!</strong> Connection restored. Syncing pending complaints...
      </span>
    </div>
  );
}
