'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, RefreshCw, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { PredictiveAnalyticsReport, SurgeRiskLevel } from '@/services/predictive-analytics-service';

const RISK_STYLES: Record<SurgeRiskLevel, string> = {
  HIGH: 'bg-rose-100 text-rose-800 border-rose-200',
  ELEVATED: 'bg-amber-100 text-amber-800 border-amber-200',
  STABLE: 'bg-emerald-100 text-emerald-800 border-emerald-200',
};

export function PredictiveAnalyticsCard() {
  const [report, setReport] = useState<PredictiveAnalyticsReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [horizonDays, setHorizonDays] = useState<14 | 30 | 60>(30);

  const loadForecast = useCallback(async (horizon: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/analytics/predictive?horizonDays=${horizon}&limit=8`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.message || 'Unable to compute predictive ward forecasts.');
      }
      setReport(data as PredictiveAnalyticsReport);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to compute predictive ward forecasts.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadForecast(horizonDays);
  }, [horizonDays, loadForecast]);

  return (
    <section className="rounded-xl border border-[#E5E2D9] bg-white p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-[#131E20] flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-[#0D6E6E]" />
            Predictive Analytics — Ward Complaint Surge Forecast
          </h2>
          <p className="text-xs text-[#6E6B64] mt-0.5">
            Forecasts which ward & category is likely to rise over the next {horizonDays} days using 90-day velocity & backlog pressure (aggregate only).
          </p>
        </div>

        <div className="flex items-center gap-2">
          {([14, 30, 60] as const).map((h) => (
            <Button
              key={h}
              type="button"
              size="sm"
              variant={horizonDays === h ? 'default' : 'outline'}
              onClick={() => setHorizonDays(h)}
              className="h-8 text-xs"
            >
              Next {h}d
            </Button>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => loadForecast(horizonDays)}
            disabled={loading}
            className="h-8 text-xs gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="h-40 rounded-lg border border-dashed border-[#E5E2D9] bg-[#FAF8F2] flex items-center justify-center text-xs text-[#6E6B64]">
          Computing ward & category forecasts...
        </div>
      ) : error ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-800 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : !report || report.topSurges.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[#E5E2D9] bg-[#FAF8F2] px-4 py-8 text-center text-xs text-[#6E6B64]">
          Insufficient historical complaints in the selected lookback window to project surges.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[#E5E2D9] text-[#6E6B64]">
                <th className="py-2 pr-3 font-medium">Ward / Zone</th>
                <th className="py-2 px-3 font-medium">Category</th>
                <th className="py-2 px-3 font-medium text-right">Last 30d</th>
                <th className="py-2 px-3 font-medium text-right">Growth</th>
                <th className="py-2 px-3 font-medium text-right">Projected ({horizonDays}d)</th>
                <th className="py-2 pl-3 font-medium">Risk</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F2EFE6]">
              {report.topSurges.map((row) => (
                <tr key={`${row.ward}-${row.category}`} className="hover:bg-[#FAF8F2]">
                  <td className="py-2.5 pr-3 font-semibold text-[#131E20]">{row.ward}</td>
                  <td className="py-2.5 px-3 text-[#464440]">
                    <div>{row.category}</div>
                    <div className="text-[11px] text-[#6E6B64]">{row.department}</div>
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-[#131E20]">{row.recent30Count}</td>
                  <td
                    className={`py-2.5 px-3 text-right font-mono ${
                      row.growthRatePct >= 20
                        ? 'text-rose-700 font-semibold'
                        : row.growthRatePct < 0
                        ? 'text-emerald-700'
                        : 'text-[#6E6B64]'
                    }`}
                  >
                    {row.growthRatePct >= 0 ? `+${row.growthRatePct}%` : `${row.growthRatePct}%`}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono font-semibold text-[#0D6E6E]">
                    ~{row.projectedNextHorizonCount}
                  </td>
                  <td className="py-2.5 pl-3">
                    <span
                      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${RISK_STYLES[row.riskLevel]}`}
                    >
                      {row.riskLevel}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

