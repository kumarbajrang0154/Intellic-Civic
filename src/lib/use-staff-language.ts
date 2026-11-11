'use client';

import * as React from 'react';
import { normalizeStaffLanguage } from '@/lib/complaint-language';

const STORAGE_KEY = 'ic_staff_preferred_language';
const CHANGE_EVENT = 'ic-staff-language-change';

function readCookieLanguage(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(/(?:^|;\s*)ic_staff_lang=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export function getStoredStaffLanguage(): 'en' | 'original' {
  if (typeof window === 'undefined') return 'en';
  try {
    const localVal = window.localStorage.getItem(STORAGE_KEY);
    if (localVal) {
      return normalizeStaffLanguage(localVal) === 'original' ? 'original' : 'en';
    }
    const cookieVal = readCookieLanguage();
    if (cookieVal) {
      return normalizeStaffLanguage(cookieVal) === 'original' ? 'original' : 'en';
    }
  } catch {
    // Ignore storage access errors
  }
  return 'en';
}

export function broadcastStaffLanguageChange(language: 'en' | 'original') {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, language);
  } catch {
    // Ignore storage quota errors
  }
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: language }));
}

export function useStaffComplaintLanguage(): 'en' | 'original' {
  const [language, setLanguage] = React.useState<'en' | 'original'>('en');

  React.useEffect(() => {
    setLanguage(getStoredStaffLanguage());

    const handleCustom = (e: Event) => {
      const next = (e as CustomEvent<string>).detail;
      setLanguage(normalizeStaffLanguage(next) === 'original' ? 'original' : 'en');
    };
    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        setLanguage(normalizeStaffLanguage(e.newValue) === 'original' ? 'original' : 'en');
      }
    };

    window.addEventListener(CHANGE_EVENT, handleCustom);
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener(CHANGE_EVENT, handleCustom);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  return language;
}

