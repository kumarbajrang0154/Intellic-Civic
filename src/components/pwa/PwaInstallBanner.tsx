'use client';

import * as React from 'react';
import Image from 'next/image';
import { Download, X, Smartphone, Share, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PwaInstallBannerProps {
  deferredPrompt: any;
  onInstall: () => void;
  onDismiss: () => void;
  isIos: boolean;
}

export function PwaInstallBanner({
  deferredPrompt,
  onInstall,
  onDismiss,
  isIos,
}: PwaInstallBannerProps) {
  const [showIosTooltip, setShowIosTooltip] = React.useState(false);

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-6 md:bottom-6 z-50 max-w-md animate-in slide-in-from-bottom-5 duration-300">
      <div className="relative overflow-hidden rounded-2xl border border-primary/30 bg-slate-900/90 p-4 shadow-2xl backdrop-blur-xl text-slate-100 dark:border-primary/40 dark:bg-slate-950/95">
        {/* Ambient Gradient Glow */}
        <div className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-blue-500/20 blur-2xl pointer-events-none" />

        <button
          onClick={onDismiss}
          className="absolute right-2.5 top-2.5 rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors"
          aria-label="Dismiss install banner"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-start gap-3.5 pr-6">
          <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-blue-500/30 bg-blue-950/50 p-1 shadow-md">
            <Image
              src="/icons/icon-192.png"
              alt="IntelliCivic PWA App Icon"
              width={48}
              height={48}
              className="h-full w-full object-cover rounded-lg"
            />
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-1.5">
              <h4 className="text-sm font-bold text-slate-100">Install IntelliCivic App</h4>
              <span className="inline-flex items-center rounded-full bg-blue-500/20 px-2 py-0.5 text-[10px] font-semibold text-blue-400 border border-blue-500/30">
                PWA
              </span>
            </div>
            <p className="text-xs text-slate-300 leading-snug">
              Add IntelliCivic to your home screen for quick offline complaint tracking & instant field updates.
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="mt-3.5 flex items-center justify-between gap-2 pt-2 border-t border-slate-800/80">
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
            <span>Fast & Offline Ready</span>
          </div>

          {isIos ? (
            <Button
              size="sm"
              onClick={() => setShowIosTooltip(!showIosTooltip)}
              className="h-8 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-md gap-1.5"
            >
              <Share className="h-3.5 w-3.5" />
              How to Install (iOS)
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={onInstall}
              className="h-8 text-xs font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-md gap-1.5"
            >
              <Download className="h-3.5 w-3.5" />
              Install App
            </Button>
          )}
        </div>

        {/* iOS Tooltip Instructions */}
        {isIos && showIosTooltip && (
          <div className="mt-2.5 rounded-xl bg-slate-800/90 p-2.5 text-xs text-slate-200 border border-slate-700/60 animate-in fade-in duration-200 space-y-1">
            <p className="font-semibold text-blue-400 flex items-center gap-1">
              <Smartphone className="h-3.5 w-3.5" /> iOS Safari Installation:
            </p>
            <ol className="list-decimal list-inside space-y-0.5 text-[11px] text-slate-300">
              <li>Tap the <span className="font-semibold text-slate-100">Share</span> button at bottom of Safari</li>
              <li>Scroll down & tap <span className="font-semibold text-slate-100">"Add to Home Screen"</span></li>
            </ol>
          </div>
        )}
      </div>
    </div>
  );
}
