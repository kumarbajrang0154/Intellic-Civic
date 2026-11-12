'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ExternalLink, MapPin, Navigation, RefreshCw, Route } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { OptimizedFieldRoute } from '@/services/route-planning-service';

export function RoutePlanPanel() {
  const [route, setRoute] = useState<OptimizedFieldRoute | null>(null);
  const [mode, setMode] = useState<'distance' | 'priority'>('distance');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadRoute = useCallback(async (selectedMode: 'distance' | 'priority') => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/field-worker/route-plan?mode=${selectedMode}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.message || 'Unable to compute field route plan.');
      }
      setRoute(data as OptimizedFieldRoute);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load route plan.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRoute(mode);
  }, [mode, loadRoute]);

  return (
    <Card className="border border-slate-200 bg-white rounded-xl shadow-xs">
      <CardHeader className="p-4 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <CardTitle className="text-sm font-bold flex items-center gap-2 text-slate-900">
            <Route className="h-4 w-4 text-ic-blue" />
            Field Visit Route Plan
          </CardTitle>
          <CardDescription className="text-xs text-slate-500">
            Ordered stop sequence across your active ASSIGNED & IN_PROGRESS tasks.
          </CardDescription>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            type="button"
            size="sm"
            variant={mode === 'distance' ? 'default' : 'outline'}
            onClick={() => setMode('distance')}
            className="h-8 text-xs"
          >
            Shortest Distance
          </Button>
          <Button
            type="button"
            size="sm"
            variant={mode === 'priority' ? 'default' : 'outline'}
            onClick={() => setMode('priority')}
            className="h-8 text-xs"
          >
            Priority Weighted
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => loadRoute(mode)}
            disabled={loading}
            className="h-8 text-xs gap-1"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-4 pt-0 space-y-3">
        {loading ? (
          <p className="text-xs text-slate-500 py-2">Calculating nearest-stop sequence...</p>
        ) : error ? (
          <p className="text-xs text-rose-700 py-2">{error}</p>
        ) : !route || (route.stops.length === 0 && route.unmappedStops.length === 0) ? (
          <p className="text-xs text-slate-500 py-2">
            No open tasks available for routing.
          </p>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-xs">
              <div className="flex items-center gap-4 flex-wrap">
                <span>
                  Stops: <strong>{route.stops.length}</strong> mapped
                  {route.unmappedStops.length > 0 ? ` (+${route.unmappedStops.length} no-GPS)` : ''}
                </span>
                <span>
                  Total distance: <strong>{route.totalDistanceKm} km</strong>
                </span>
                <span>
                  Est. drive: <strong>{route.estimatedTotalMinutes} min</strong>
                </span>
              </div>
              {route.googleMapsUrl && (
                <a
                  href={route.googleMapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-ic-blue font-semibold hover:underline"
                >
                  <Navigation className="h-3.5 w-3.5" />
                  Open Multi-Stop Directions
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>

            {route.stops.length > 0 && (
              <ol className="space-y-2">
                {route.stops.map((stop) => (
                  <li
                    key={stop.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2 text-xs hover:bg-slate-50"
                  >
                    <div className="flex items-start gap-2.5 min-w-0">
                      <span className="h-5 w-5 rounded-full bg-ic-blue text-white font-bold flex items-center justify-center shrink-0 text-[11px]">
                        {stop.sequence}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Link
                            href={`/field-worker/complaints/${stop.id}`}
                            className="font-mono font-bold text-ic-blue hover:underline"
                          >
                            #{stop.ticketId}
                          </Link>
                          <Badge variant="outline" className="text-[10px]">
                            {stop.priority || 'MEDIUM'}
                          </Badge>
                          <span className="font-medium text-slate-900 truncate">
                            {stop.titleEn || stop.title}
                          </span>
                        </div>
                        {stop.address && (
                          <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5 truncate">
                            <MapPin className="h-3 w-3 shrink-0" />
                            {stop.address}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0 text-[11px] text-slate-600 font-mono">
                      <div>+{stop.legDistanceKm} km</div>
                      <div>~{stop.estimatedTravelMinutes} min</div>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

