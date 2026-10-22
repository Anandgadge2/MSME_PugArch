'use client';

import React from 'react';
import {
  CreditCard,
  Truck,
  ShieldCheck,
  FileCheck,
  ScrollText
} from 'lucide-react';
import {
  InPlaceProcurementDraft,
  INCOTERMS_OPTIONS,
  INSPECTION_OPTIONS
} from '../../hooks/useInPlaceProcurementEdit';
import { PAYMENT_TERM_OPTIONS } from '../../../procurementWizard/procurementOptions';

export interface InPlaceTermsEditCardProps {
  draft: InPlaceProcurementDraft;
  updateDraft: <K extends keyof InPlaceProcurementDraft>(field: K, value: InPlaceProcurementDraft[K]) => void;
  validationErrors: Record<string, string>;
}

export function InPlaceTermsEditCard({
  draft,
  updateDraft
}: InPlaceTermsEditCardProps) {
  return (
    <div className="rounded-2xl border-2 border-indigo-200 bg-white p-5 sm:p-6 shadow-sm space-y-6">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-700">
            <CreditCard className="h-4 w-4" />
          </span>
          <div>
            <h3 className="text-sm font-black text-slate-900 tracking-tight">
              Edit Commercial Terms &amp; Compliance Clauses
            </h3>
            <p className="text-xs text-slate-500 font-medium">
              Update delivery incoterms, quality inspection mode, payment schedule, and terms.
            </p>
          </div>
        </div>
        <span className="text-[10px] font-bold uppercase tracking-wider bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-md">
          Commercial Clauses
        </span>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        {/* Delivery Terms / Incoterms */}
        <div className="space-y-1.5">
          <label htmlFor="proc-edit-incoterms" className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
            <Truck className="h-3.5 w-3.5 text-indigo-600" />
            Delivery Incoterms <span className="text-rose-500">*</span>
          </label>
          <select
            id="proc-edit-incoterms"
            value={draft.deliveryTerms}
            onChange={(e) => updateDraft('deliveryTerms', e.target.value)}
            className="w-full h-10 px-3 text-xs font-bold rounded-xl border border-slate-300 bg-white text-slate-800 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 transition shadow-xs outline-none cursor-pointer"
          >
            {INCOTERMS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <p className="text-[10px] text-slate-400">Specifies transportation and transit risk allocation.</p>
        </div>

        {/* Inspection Mode */}
        <div className="space-y-1.5">
          <label htmlFor="proc-edit-inspection" className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-indigo-600" />
            Quality Inspection Mode <span className="text-rose-500">*</span>
          </label>
          <select
            id="proc-edit-inspection"
            value={draft.inspectionMode}
            onChange={(e) => updateDraft('inspectionMode', e.target.value)}
            className="w-full h-10 px-3 text-xs font-bold rounded-xl border border-slate-300 bg-white text-slate-800 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 transition shadow-xs outline-none cursor-pointer"
          >
            {INSPECTION_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <p className="text-[10px] text-slate-400">Specifies pre-dispatch or consignee receipt inspection.</p>
        </div>

        {/* Payment Terms */}
        <div className="sm:col-span-2 space-y-1.5">
          <label htmlFor="proc-edit-payment" className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
            <CreditCard className="h-3.5 w-3.5 text-indigo-600" />
            Payment Terms &amp; Settlement <span className="text-rose-500">*</span>
          </label>
          <select
            id="proc-edit-payment"
            value={draft.paymentTerms}
            onChange={(e) => updateDraft('paymentTerms', e.target.value)}
            className="w-full h-10 px-3 text-xs font-bold rounded-xl border border-slate-300 bg-white text-slate-800 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 transition shadow-xs outline-none cursor-pointer"
          >
            {PAYMENT_TERM_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
          <p className="text-[10px] text-slate-400">Statutory payment settlement timeline against CRAC / GRN.</p>
        </div>

        {/* Specific Terms & Conditions */}
        <div className="sm:col-span-2 space-y-1.5">
          <label htmlFor="proc-edit-terms" className="text-xs font-bold text-slate-700 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <ScrollText className="h-3.5 w-3.5 text-indigo-600" />
              Special Terms &amp; Conditions (One per line)
            </span>
            <span className="text-[11px] font-normal text-slate-400">Optional</span>
          </label>
          <textarea
            id="proc-edit-terms"
            rows={5}
            value={draft.termsAndConditions}
            onChange={(e) => updateDraft('termsAndConditions', e.target.value)}
            placeholder={"e.g.\n1. Material must be accompanied by OEM Test Certificate.\n2. Warranty of 24 months from commissioning.\n3. LD penalty of 0.5% per week for delay up to 10% maximum."}
            className="w-full p-3.5 text-xs font-medium rounded-xl border border-slate-300 bg-slate-50/50 text-slate-900 focus:bg-white focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 transition shadow-inner outline-none leading-relaxed font-mono"
          />
          <p className="text-[10px] text-slate-400">Each non-empty line will be treated as an explicit contractual clause.</p>
        </div>
      </div>
    </div>
  );
}

export default InPlaceTermsEditCard;
