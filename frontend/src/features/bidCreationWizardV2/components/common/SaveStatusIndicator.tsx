import React from 'react';
import { CheckCircle2, Loader2, AlertTriangle } from 'lucide-react';
import type { SaveStatus } from '../../types/steps';

export default function SaveStatusIndicator({ status, lastSavedAt }: { status: SaveStatus; lastSavedAt: string | null }) {
  const label = status === 'saving' ? 'Saving...' : status === 'failed' ? 'Save failed' : lastSavedAt ? `Draft saved ${new Date(lastSavedAt).toLocaleTimeString()}` : 'Not saved';
  const Icon = status === 'saving' ? Loader2 : status === 'failed' ? AlertTriangle : CheckCircle2;
  return <span className="inline-flex items-center gap-2 text-xs font-black text-slate-600"><Icon className={`h-4 w-4 ${status === 'saving' ? 'animate-spin' : ''}`} />{label}</span>;
}
