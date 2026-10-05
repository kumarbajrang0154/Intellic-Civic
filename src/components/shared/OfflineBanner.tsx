'use client';

import * as React from 'react';
import { Wifi, WifiOff, RefreshCw } from 'lucide-react';

export function OfflineBanner() {
  const [isOnline, setIsOnline] = React.useState(true);
  const [showReconnected, setShowReconnected] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;

    setIsOnline(navigator.onLine);

    let timer: any = null;
    const handleOnline = () => {
      setIsOnline(true);
      setShowReconnected(true);
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => setShowReconnected(false), 4000);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowReconnected(false);
      if (timer) clearTimeout(timer);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
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
