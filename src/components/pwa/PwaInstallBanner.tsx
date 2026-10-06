'use client';

import * as React from 'react';
import Image from 'next/image';
import { Download, X, Smartphone, Share, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PwaInstallBannerProps {
  deferredPrompt?: any;
  onInstall: () => void;
  onDismiss: () => void;
  isIos: boolean;
}

export function PwaInstallBanner({
  deferredPrompt: _deferredPrompt,
  onInstall,
  onDismiss,
  isIos,
}: PwaInstallBannerProps) {
  const [showIosTooltip, setShowIosTooltip] = React.useState(false);

  return (
    <div className="fixed bottom-[max(0.75rem,env(safe-area-inset-bottom,0.75rem))] left-3 right-3 sm:left-4 sm:right-4 md:left-auto md:right-6 md:bottom-6 z-50 max-w-md animate-in slide-in-from-bottom-5 duration-300">
      <div className="relative flex items-center justify-between gap-2.5 rounded-2xl border border-[#E5E2D9] bg-white p-2.5 sm:p-3 shadow-lg text-[#131E20]">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-xl border border-[#E5E2D9] bg-slate-50 p-0.5 shadow-2xs">
            <Image
              src="/icons/icon-192.png"
              alt="IntelliCivic App Icon"
              width={36}
              height={36}
              className="h-full w-full object-cover rounded-lg"
            />
          </div>
          <div className="min-w-0">
            <h4 className="text-xs sm:text-sm font-bold text-[#131E20] truncate">Install IntelliCivic</h4>
            <p className="text-[11px] text-[#6E6B64] truncate">Offline-ready smart city app</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {isIos ? (
            <Button
              size="sm"
              onClick={() => setShowIosTooltip(!showIosTooltip)}
              className="h-11 px-3 text-xs font-semibold bg-[#1769AA] hover:bg-[#1769AA]/90 text-white shadow-xs gap-1 rounded-xl"
            >
              <Share className="h-3.5 w-3.5" />
              Install
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={onInstall}
              className="h-11 px-3 text-xs font-semibold bg-[#1769AA] hover:bg-[#1769AA]/90 text-white shadow-xs gap-1 rounded-xl"
            >
              <Download className="h-3.5 w-3.5" />
              Install
            </Button>
          )}
          <button
            onClick={onDismiss}
            className="rounded-xl inline-flex items-center justify-center h-11 w-11 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
            aria-label="Dismiss install banner"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {isIos && showIosTooltip && (
        <div className="mt-1.5 rounded-xl bg-white p-2.5 text-xs text-[#131E20] border border-[#E5E2D9] shadow-md animate-in fade-in duration-200 space-y-1">
          <p className="font-semibold text-[#1769AA] flex items-center gap-1">
            <Smartphone className="h-3.5 w-3.5" /> iOS Safari:
          </p>
          <ol className="list-decimal list-inside text-[11px] text-[#6E6B64]">
            <li>Tap <span className="font-semibold text-slate-800">Share</span> in Safari toolbar</li>
            <li>Tap <span className="font-semibold text-slate-800">&quot;Add to Home Screen&quot;</span></li>
          </ol>
        </div>
      )}
    </div>
  );
}
