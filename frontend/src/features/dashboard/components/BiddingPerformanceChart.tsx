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

const BID_STATUS_DATA = [
  { name: 'Won / Awarded', value: 5, color: '#10b981', textColor: 'text-emerald-700', bg: 'bg-emerald-50' },
  { name: 'Under Evaluation', value: 4, color: '#6366f1', textColor: 'text-indigo-700', bg: 'bg-indigo-50' },
  { name: 'Closed / Not Awarded', value: 3, color: '#94a3b8', textColor: 'text-slate-600', bg: 'bg-slate-100' },
];

export function BiddingPerformanceChart({ stats }: BiddingPerformanceProps) {
  const [period, setPeriod] = useState<'30d' | 'quarter'>('30d');

  const totalBids = stats?.submitted ?? 12;
  const wonBids = stats?.won ?? 5;
  const winRate = Math.round((wonBids / (totalBids || 1)) * 100);
  const pipelineVal = stats?.pipelineValue ?? 1845000;
  const onTimeRate = stats?.onTimeDeliveryRate ?? 98.4;

  const chartData = [
    { name: 'Won / Awarded', value: wonBids, color: '#10b981' },
    { name: 'Under Evaluation', value: stats?.underEval ?? 4, color: '#6366f1' },
    { name: 'Closed / Outbid', value: Math.max(0, totalBids - wonBids - (stats?.underEval ?? 4)), color: '#cbd5e1' },
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
              <span className="text-[9px] font-bold text-emerald-600 flex items-center">
                <TrendingUp className="h-2.5 w-2.5 mr-0.5" /> +4.2%
              </span>
            </div>
            <p className="text-[9px] font-medium text-slate-500 mt-0.5">{wonBids} of {totalBids} proposals awarded</p>
          </div>

          <div className="rounded-lg bg-indigo-50/40 p-2.5 border border-indigo-100/60">
            <p className="text-[9px] font-bold uppercase tracking-wider text-indigo-900/60">Active Pipeline</p>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-lg font-black text-[#12335f]">₹{(pipelineVal / 100000).toFixed(1)}L</span>
              <span className="text-[9px] font-bold text-indigo-600 uppercase">Live</span>
            </div>
            <p className="text-[9px] font-medium text-indigo-700/70 mt-0.5">Under evaluation & bids</p>
          </div>
        </div>

        {/* ── Donut Chart & Legend ── */}
        <div className="flex items-center gap-3 pt-1">
          <div className="h-24 w-24 shrink-0 relative flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={28}
                  outerRadius={42}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(val: any, name: any) => [`${val} Proposals`, name]}
                  contentStyle={{ fontSize: '11px', borderRadius: '8px', padding: '4px 8px' }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-xs font-black text-slate-800">{totalBids}</span>
              <span className="text-[7px] font-bold uppercase tracking-wider text-slate-400">Bids</span>
            </div>
          </div>

          {/* Legend Details */}
          <div className="flex-1 space-y-1.5 min-w-0">
            {BID_STATUS_DATA.map((item, idx) => (
              <div key={item.name} className="flex items-center justify-between text-[10px]">
                <div className="flex items-center gap-1.5 truncate">
                  <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                  <span className="font-semibold text-slate-600 truncate">{item.name}</span>
                </div>
                <span className="font-extrabold text-slate-900 ml-2">
                  {chartData[idx]?.value ?? item.value}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Fulfillment Quality Indicator ── */}
        <div className="rounded-lg bg-emerald-50/50 p-2.5 border border-emerald-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-md bg-emerald-600 text-white flex items-center justify-center">
              <CheckCircle2 className="h-3.5 w-3.5" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-emerald-950">On-Time Fulfillment SLA</p>
              <p className="text-[9px] font-medium text-emerald-700/80">Complies with MSME delivery standards</p>
            </div>
          </div>
          <span className="text-xs font-black text-emerald-700">{onTimeRate}%</span>
        </div>
      </div>

      {/* ── Card Footer ── */}
      <div className="bg-slate-50/80 px-3.5 py-2 border-t border-slate-100 flex items-center justify-between text-[10px]">
        <Link 
          href="/seller/bids/submitted" 
          className="font-bold uppercase tracking-wider text-[#12335f] hover:text-[#0b2445] inline-flex items-center gap-1 transition"
        >
          View Submitted Bids ({totalBids})
          <ArrowUpRight className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}

export default React.memo(BiddingPerformanceChart);
