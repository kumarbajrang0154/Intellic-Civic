'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  listFieldWorkerOfflineActions,
  onFieldWorkerQueueChange,
  syncFieldWorkerOfflineActions,
} from '@/lib/field-worker-offline';

export function FieldWorkerOfflineSyncBanner({
  userId,
  onSynced,
}: {
  userId?: string;
  onSynced?: () => void;
}) {
  const [isOnline, setIsOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);

  const refreshCount = useCallback(async () => {
    try {
      const items = await listFieldWorkerOfflineActions(userId);
      setPendingCount(items.length);
    } catch {
      setPendingCount(0);
    }
  }, [userId]);

  const handleSync = useCallback(async () => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;
    setSyncing(true);
    try {
      const res = await syncFieldWorkerOfflineActions(userId);
      setPendingCount(res.remaining);
      if (res.synced > 0) {
        toast.success(`Synced ${res.synced} offline field action(s).`);
        onSynced?.();
      }
    } finally {
      setSyncing(false);
    }
  }, [userId, onSynced]);

  useEffect(() => {
    setIsOnline(typeof navigator !== 'undefined' ? navigator.onLine : true);
    refreshCount();

    const offCleanup = onFieldWorkerQueueChange(() => {
      refreshCount();
    });
    const onOnline = () => {
      setIsOnline(true);
      handleSync();
    };
    const onOffline = () => setIsOnline(false);

    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      offCleanup();
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [refreshCount, handleSync]);

  if (isOnline && pendingCount === 0) {
    return null;
  }

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 flex items-center justify-between gap-3 text-xs text-amber-900">
      <div className="flex items-center gap-2">
        <WifiOff className="h-4 w-4 text-amber-700 shrink-0" />
        <span>
          {!isOnline
            ? `Offline field mode active — work updates and photos will queue locally (${pendingCount} pending).`
            : `${pendingCount} offline field action(s) queued and ready to sync.`}
        </span>
      </div>

      {isOnline && pendingCount > 0 && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={handleSync}
          disabled={syncing}
          className="h-7 text-xs border-amber-300 bg-white hover:bg-amber-100 gap-1"
        >
          <RefreshCw className={`h-3 w-3 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? 'Syncing...' : 'Sync Now'}
        </Button>
      )}
    </div>
  );
}

