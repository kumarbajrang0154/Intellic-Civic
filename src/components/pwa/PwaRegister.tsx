'use client';

import * as React from 'react';
import { PwaInstallBanner } from './PwaInstallBanner';

export function PwaRegister() {
  const [deferredPrompt, setDeferredPrompt] = React.useState<any>(null);
  const [showBanner, setShowBanner] = React.useState(false);
  const [isIos, setIsIos] = React.useState(false);

  React.useEffect(() => {
    // 1. Service Worker Registration
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => console.log('[PWA] ServiceWorker registered with scope:', reg.scope))
        .catch((err) => console.warn('[PWA] ServiceWorker registration failed:', err));
    } else if ('serviceWorker' in navigator) {
      // Register in dev mode too for testing offline functionality
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => console.log('[PWA Dev] ServiceWorker registered with scope:', reg.scope))
        .catch((err) => console.warn('[PWA Dev] ServiceWorker registration failed:', err));
    }

    // 2. Check if already running in standalone mode (already installed)
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;

    if (isStandalone) {
      return;
    }

    // 3. Detect iOS Safari
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIos(isIosDevice);

    // 4. Check dismissal preference in localStorage
    const isDismissed = localStorage.getItem('ic_pwa_install_dismissed');
    if (isDismissed) {
      const dismissedAt = parseInt(isDismissed, 10);
      // Suppress for 7 days
      if (Date.now() - dismissedAt < 7 * 24 * 60 * 60 * 1000) {
        return;
      }
    }

    // 5. Capture `beforeinstallprompt` event for Android/Chrome/Desktop
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowBanner(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Show banner after 3 seconds for iOS devices (since iOS doesn't support beforeinstallprompt)
    if (isIosDevice) {
      const timer = setTimeout(() => {
        setShowBanner(true);
      }, 3000);
      return () => clearTimeout(timer);
    }

    // Fallback timer for desktop/Android testing if beforeinstallprompt fired early or delayed
    const devTimer = setTimeout(() => {
      setShowBanner(true);
    }, 2500);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      clearTimeout(devTimer);
    };
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      console.log(`[PWA] User response to install prompt: ${outcome}`);
      setDeferredPrompt(null);
      setShowBanner(false);
    }
  };

  const handleDismiss = () => {
    setShowBanner(false);
    localStorage.setItem('ic_pwa_install_dismissed', Date.now().toString());
  };

  if (!showBanner) {
    return null;
  }

  return (
    <PwaInstallBanner
      deferredPrompt={deferredPrompt}
      onInstall={handleInstall}
      onDismiss={handleDismiss}
      isIos={isIos}
    />
  );
}
