'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import { 
  ShieldCheck, 
  CheckCircle2, 
  Info, 
  ChevronRight
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  Tooltip 
} from 'recharts';
import { Card, CardContent } from '../../../components/ui/card';
import { useQuery } from '@tanstack/react-query';
import { api, unwrapApiData } from '../../../lib/api';
import { useAuth } from '../../../hooks/useAuth';

interface BuyerSpendAndComplianceProps {
  stats?: {
    totalSpend?: number;
    msmeSpend?: number;
    scStSpend?: number;
    womenSpend?: number;
    generalMsmeSpend?: number;
    msmeSharePercent?: number;
    scStPercent?: number;
    womenPercent?: number;
    generalPercent?: number;
    isMandateMet?: boolean;
    activeOrdersCount?: number;
    estimatedSavings?: number;
    savingsPercent?: number;
  };
  granularity?: 'daily' | 'weekly' | 'monthly' | 'quarterly';
}

export function BuyerSpendAndCompliance({ 
  stats,
  granularity = 'monthly'
}: BuyerSpendAndComplianceProps) {
  const { token } = useAuth();

  const authHeaders: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
  const { data: summaryData } = useQuery({
    queryKey: ['dashboard', 'summary'],
    queryFn: async () => {
      const res = await api.fetch('/api/dashboard/summary', { headers: authHeaders });
      if (!res.ok) return null;
      const json = await res.json();
      return unwrapApiData<any>(json);
    },
    enabled: !!token,
    staleTime: 60_000,
    refetchOnWindowFocus: false
  });

  // Authentic period spend and order count — strictly authentic database records
  const totalSpend = stats?.totalSpend !== undefined 
    ? Number(stats.totalSpend) 
    : Number(summaryData?.buyerProcurementTotalSpentValue ?? 0);
  const activePOs = stats?.activeOrdersCount !== undefined
    ? Number(stats.activeOrdersCount)
    : Number(summaryData?.myActivePOsCount ?? 0);
  
  const msmePercent = stats?.msmeSharePercent ?? 0;
  const savings = stats?.estimatedSavings ?? 0;
  const savingsPercent = stats?.savingsPercent ?? 0;
  const isMandateMet = msmePercent >= 25.0;

  const timeframeLabel = useMemo(() => {
    switch (granularity) {
      case 'daily': return '14-Day Trajectory';
      case 'weekly': return '8-Week Trajectory';
      case 'quarterly': return '4-Quarter Trajectory';
      default: return '6-Month Trajectory';
    }
  }, [granularity]);

  // Donut Gauge Data
  const donutData = useMemo(() => {
    const achieved = Math.min(100, Math.max(0, msmePercent));
    const remainder = Math.max(0, 100 - achieved);
    return [
      { name: 'MSME Quota Achieved', value: achieved, color: isMandateMet ? '#10b981' : '#f59e0b' },
      { name: 'Remaining / General', value: remainder, color: '#f1f5f9' }
    ];
  }, [msmePercent, isMandateMet]);

  return (
    <Card className="rounded-xl bg-white shadow-sm ring-1 ring-slate-200/70 overflow-hidden">
      {/* ── Card Header (Clean & Focused, Filters Removed) ── */}
      <div className="bg-slate-50/50 px-3.5 py-2.5 border-b border-slate-100 flex items-center justify-between gap-2 rounded-t-xl">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wide text-slate-900">
              Procurement Spend & MSME Mandate
            </h2>
            <p className="text-[10px] font-medium text-slate-500">
              Mandatory 25% statutory public procurement compliance
            </p>
          </div>
        </div>

        <span className="text-[9px] font-bold text-emerald-800 bg-emerald-100/70 px-2 py-0.5 rounded-full shrink-0">
          Target: 25.0%
        </span>
      </div>

      <CardContent className="p-3.5 space-y-3.5">
        {/* ── Top Metric Highlights (Dynamically synchronized with filter) ── */}
        <div className="grid grid-cols-2 gap-2.5">
          {/* MSME Quota Compliance Metric */}
          <div className={`p-2.5 rounded-lg border space-y-1 ${
            isMandateMet 
              ? 'bg-emerald-50/70 border-emerald-200/70' 
              : 'bg-slate-50 border-slate-200'
          }`}>
            <div className="flex items-center justify-between">
              <span className={`text-[9px] font-bold uppercase tracking-wider ${
                isMandateMet ? 'text-emerald-800' : 'text-slate-500'
              }`}>
                MSME Share
              </span>
              {totalSpend > 0 ? (
                isMandateMet ? (
                  <span className="text-[8px] font-black uppercase px-1.5 py-0.2 rounded bg-emerald-600 text-white flex items-center gap-0.5">
                    <CheckCircle2 className="h-2.5 w-2.5" /> Mandate Met
                  </span>
                ) : (
                  <span className="text-[8px] font-bold uppercase px-1.5 py-0.2 rounded bg-amber-100 text-amber-800">
                    Below Quota
                  </span>
                )
              ) : (
                <span className="text-[8px] font-bold uppercase px-1.5 py-0.2 rounded bg-slate-200 text-slate-700">
                  Target 25%
                </span>
              )}
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-lg font-black text-slate-950">{msmePercent}%</span>
              <span className="text-[10px] font-bold text-slate-500">/ 25% target</span>
            </div>
            <p className="text-[9px] font-medium leading-tight text-slate-600">
              {totalSpend > 0 
                ? (isMandateMet ? `+${(msmePercent - 25).toFixed(1)}% above national mandate` : `${(25 - msmePercent).toFixed(1)}% to reach 25% quota`)
                : 'Mandated by Public Procurement Policy'}
            </p>
          </div>

          {/* Spend & Estimated Savings */}
          <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/70 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500">
                Period Spend
              </span>
              {savings > 0 && (
                <span className="text-[8px] font-bold uppercase px-1.5 py-0.2 rounded bg-blue-100 text-blue-800">
                  -{savingsPercent}% saved
                </span>
              )}
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-black text-[#12335f]">
                {totalSpend >= 100000 ? `₹${(totalSpend / 100000).toFixed(1)}L` : totalSpend > 0 ? `₹${(totalSpend / 1000).toFixed(1)}k` : '₹0'}
              </span>
            </div>
            <p className="text-[9px] font-medium text-slate-500 leading-tight">
              {totalSpend > 0 
                ? `${activePOs} purchase orders in period`
                : 'No orders in selected period'}
            </p>
          </div>
        </div>

       

       
      </CardContent>
    </Card>
  );
}

export default React.memo(BuyerSpendAndCompliance);
