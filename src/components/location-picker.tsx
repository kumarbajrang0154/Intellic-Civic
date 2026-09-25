'use client';

import * as React from 'react';
import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';

interface LocationPickerProps {
  latitude: number | null;
  longitude: number | null;
  onChange: (lat: number, lng: number) => void;
  className?: string;
  defaultCenter?: [number, number];
  defaultZoom?: number;
}

const LocationPickerInner = dynamic(() => import('./location-picker-inner'), {
  ssr: false,
  loading: () => (
    <div className="h-[260px] w-full bg-slate-100 rounded-xl flex flex-col items-center justify-center p-6 text-slate-500 animate-pulse border border-slate-200">
      <Loader2 className="w-6 h-6 animate-spin text-blue-600 mb-2" />
      <span className="text-xs font-medium">Loading Interactive Map Location Picker...</span>
    </div>
  ),
});

export function LocationPicker(props: LocationPickerProps) {
  return <LocationPickerInner {...props} />;
}
