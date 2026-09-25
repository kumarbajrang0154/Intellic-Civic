'use client';

import * as React from 'react';
import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';
import type { ComplaintMapItem } from './complaints-map-inner';

export type { ComplaintMapItem };

interface ComplaintsMapProps {
  complaints: ComplaintMapItem[];
  detailRoutePrefix?: string;
  className?: string;
  defaultCenter?: [number, number];
  defaultZoom?: number;
}

const ComplaintsMapInner = dynamic(() => import('./complaints-map-inner'), {
  ssr: false,
  loading: () => (
    <div className="h-[500px] w-full bg-slate-100 rounded-xl flex flex-col items-center justify-center p-6 text-slate-500 animate-pulse border border-slate-200">
      <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-2" />
      <span className="text-sm font-medium">Loading Interactive GIS Map...</span>
    </div>
  ),
});

export function ComplaintsMap(props: ComplaintsMapProps) {
  return <ComplaintsMapInner {...props} />;
}
