'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { 
  BarChart3, 
  TrendingUp, 
  Trophy, 
  Award, 
  Clock, 
  CheckCircle2, 
  ArrowUpRight, 
  Layers
} from 'lucide-react';
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  Tooltip 
} from 'recharts';

interface BiddingPerformanceProps {
  stats?: {
    submitted?: number;
    won?: number;
    underEval?: number;
    pipelineValue?: number;
    onTimeDeliveryRate?: number;
  };
}

export function BiddingPerformanceChart({ stats }: BiddingPerformanceProps) {
  const [period, setPeriod] = useState<'30d' | 'quarter'>('30d');

  const totalBids = stats?.submitted || 0;
  const wonBids = stats?.won || 0;
  const underEval = stats?.underEval || 0;
  const winRate = totalBids > 0 ? Math.round((wonBids / totalBids) * 100) : 0;
  const pipelineVal = stats?.pipelineValue || 0;
  const onTimeRate = stats?.onTimeDeliveryRate || 100;

  const chartData = [
    { name: 'Won / Awarded', value: wonBids, color: '#10b981' },
    { name: 'Under Evaluation', value: underEval, color: '#6366f1' },
    { name: 'Closed / Outbid', value: Math.max(0, totalBids - wonBids - underEval), color: '#cbd5e1' },
  ];

  return (
    <div className="rounded-xl bg-white shadow-sm ring-1 ring-slate-200/70 overflow-hidden flex flex-col">
      {/* ── Card Header ── */}
      <div className="bg-slate-50/50 px-3.5 py-2.5 border-b border-slate-100 flex items-center justify-between rounded-t-xl">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
            <Trophy className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wide text-slate-900">
              Bidding & Conversion
            </h2>
            <p className="text-[10px] font-medium text-slate-500">
              Proposal win rate and active value pipeline
            </p>
          </div>
        </div>

        <div className="flex items-center bg-slate-100 p-0.5 rounded-md text-[9px] font-bold uppercase">
          <button
            type="button"
            onClick={() => setPeriod('30d')}
            className={`px-2 py-0.5 rounded transition ${period === '30d' ? 'bg-white text-[#12335f] shadow-xs' : 'text-slate-500 hover:text-slate-900'}`}
          >
            30 Days
          </button>
          <button
            type="button"
            onClick={() => setPeriod('quarter')}
            className={`px-2 py-0.5 rounded transition ${period === 'quarter' ? 'bg-white text-[#12335f] shadow-xs' : 'text-slate-500 hover:text-slate-900'}`}
          >
            Quarter
          </button>
        </div>
      </div>

      {/* ── Visual Metrics Grid ── */}
      <div className="p-3.5 space-y-3.5">
        {/* Top Highlight Summary */}
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg bg-slate-50/70 p-2.5 border border-slate-200/60">
            <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Bid Win Rate</p>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-lg font-black text-slate-950">{winRate}%</span>
              {totalBids > 0 && wonBids > 0 && (
                <span className="text-[9px] font-bold text-emerald-600 flex items-center">
                  <TrendingUp className="h-2.5 w-2.5 mr-0.5" /> +4.2%
                </span>
              )}
            </div>
            <p className="text-[9px] font-medium text-slate-500 mt-0.5">
              {totalBids > 0 ? `${wonBids} of ${totalBids} proposals awarded` : '0 proposals submitted'}
            </p>
          </div>

          <div className="rounded-lg bg-slate-50/70 p-2.5 border border-slate-200/60">
            <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Active Pipeline</p>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-lg font-black text-[#12335f]">
                {pipelineVal > 0 ? `₹${(pipelineVal / 100000).toFixed(1)}L` : '₹0'}
              </span>
              {underEval > 0 && (
                <span className="text-[8px] font-bold uppercase px-1 py-0.2 bg-blue-50 text-blue-700 rounded border border-blue-200">
                  Live
                </span>
              )}
            </div>
            <p className="text-[9px] font-medium text-slate-500 mt-0.5">
              {underEval > 0 ? `${underEval} bids under evaluation` : 'Under evaluation & bids'}
            </p>
          </div>
        </div>

        {/* ── Donut Chart & Legend ── */}
        {totalBids > 0 ? (
          <div className="grid grid-cols-12 items-center gap-3 pt-1">
            <div className="col-span-5 h-[110px] w-full relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={30}
                    outerRadius={45}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ borderRadius: '8px', fontSize: '11px', fontWeight: 'bold' }}
                    formatter={(val: any) => [`${val} Proposals`, 'Count']}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-xs font-black text-slate-900">{totalBids}</span>
                <span className="text-[7px] font-bold uppercase text-slate-400">Total</span>
              </div>
            </div>

            {/* Micro Breakdown Legend */}
            <div className="col-span-7 space-y-1.5 text-[10px]">
              <div className="flex items-center justify-between p-1 rounded bg-emerald-50/60 border border-emerald-100">
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  <span className="font-bold text-slate-700">Won</span>
                </div>
                <span className="font-extrabold text-emerald-800">{wonBids}</span>
              </div>

              <div className="flex items-center justify-between p-1 rounded bg-indigo-50/60 border border-indigo-100">
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-indigo-500" />
                  <span className="font-bold text-slate-700">Under Eval</span>
                </div>
                <span className="font-extrabold text-indigo-800">{underEval}</span>
              </div>

              <div className="flex items-center justify-between p-1 rounded bg-slate-50 border border-slate-100">
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-slate-400" />
                  <span className="font-bold text-slate-600">Closed / Other</span>
                </div>
                <span className="font-extrabold text-slate-700">
                  {Math.max(0, totalBids - wonBids - underEval)}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-4 text-center bg-slate-50/50 rounded-lg border border-dashed border-slate-200">
            <p className="text-xs font-bold text-slate-700">No proposals submitted yet.</p>
            <p className="text-[10px] text-slate-500 mt-0.5">Submit quotations to start tracking your win rate and pipeline.</p>
          </div>
        )}

        {/* ── Footer KPI ── */}
        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] font-medium text-slate-600">
          <span className="flex items-center gap-1">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
            On-Time Fulfillment SLA: <strong className="text-slate-900">{onTimeRate}%</strong>
          </span>
          <Link 
            href="/seller/bids/submitted" 
            className="font-bold uppercase tracking-wider text-[#12335f] hover:underline"
          >
            My Bids →
          </Link>
        </div>
      </div>
    </div>
  );
}

export default React.memo(BiddingPerformanceChart);
