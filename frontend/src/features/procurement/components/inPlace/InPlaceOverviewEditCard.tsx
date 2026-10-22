'use client';

import React from 'react';
import {
  FileText,
  Calendar,
  MapPin,
  IndianRupee,
  Layers,
  AlertCircle
} from 'lucide-react';
import { InPlaceProcurementDraft } from '../../hooks/useInPlaceProcurementEdit';

export interface InPlaceOverviewEditCardProps {
  draft: InPlaceProcurementDraft;
  updateDraft: <K extends keyof InPlaceProcurementDraft>(field: K, value: InPlaceProcurementDraft[K]) => void;
  validationErrors: Record<string, string>;
}

export function InPlaceOverviewEditCard({
  draft,
  updateDraft,
  validationErrors
}: InPlaceOverviewEditCardProps) {
  return (
    <div className="rounded-2xl border-2 border-indigo-200 bg-white p-5 sm:p-6 shadow-sm space-y-6">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-700">
            <Layers className="h-4 w-4" />
          </span>
          <div>
            <h3 className="text-sm font-black text-slate-900 tracking-tight">
              Edit Procurement Basics &amp; Schedule
            </h3>
            <p className="text-xs text-slate-500 font-medium">
              Update general requirement title, description, budget, and key dates.
            </p>
          </div>
        </div>
        <span className="text-[10px] font-bold uppercase tracking-wider bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-md">
          Live Form
        </span>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        {/* Title */}
        <div className="sm:col-span-2 space-y-1.5">
          <label htmlFor="proc-edit-title" className="text-xs font-bold text-slate-700 flex items-center justify-between">
            <span>Procurement Title / Subject <span className="text-rose-500">*</span></span>
            <span className="text-[11px] font-normal text-slate-400">{draft.title.length} characters</span>
          </label>
          <input
            id="proc-edit-title"
            type="text"
            value={draft.title}
            onChange={(e) => updateDraft('title', e.target.value)}
            placeholder="e.g. Supply of High-Grade Precision Valves for Industrial Facility"
            aria-invalid={Boolean(validationErrors.title)}
            aria-describedby={validationErrors.title ? "proc-edit-title-error" : undefined}
            className="w-full h-10 px-3.5 text-xs font-semibold rounded-xl border border-slate-300 bg-slate-50/50 text-slate-900 focus:bg-white focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 transition shadow-inner outline-none"
          />
          {validationErrors.title && (
            <p id="proc-edit-title-error" className="text-[11px] font-semibold text-rose-600 flex items-center gap-1">
              <AlertCircle className="h-3 w-3 shrink-0" />
              {validationErrors.title}
            </p>
          )}
        </div>

        {/* Scope Description */}
        <div className="sm:col-span-2 space-y-1.5">
          <label htmlFor="proc-edit-desc" className="text-xs font-bold text-slate-700 flex items-center justify-between">
            <span>Scope Description &amp; Specifications <span className="text-rose-500">*</span></span>
            <span className="text-[11px] font-normal text-slate-400">Min 10 characters</span>
          </label>
          <textarea
            id="proc-edit-desc"
            rows={4}
            value={draft.description}
            onChange={(e) => updateDraft('description', e.target.value)}
            placeholder="Detailed description of technical specifications, deliverables, and scope of supply..."
            aria-invalid={Boolean(validationErrors.description)}
            aria-describedby={validationErrors.description ? "proc-edit-desc-error" : undefined}
            className="w-full p-3.5 text-xs font-medium rounded-xl border border-slate-300 bg-slate-50/50 text-slate-900 focus:bg-white focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 transition shadow-inner outline-none leading-relaxed"
          />
          {validationErrors.description && (
            <p id="proc-edit-desc-error" className="text-[11px] font-semibold text-rose-600 flex items-center gap-1">
              <AlertCircle className="h-3 w-3 shrink-0" />
              {validationErrors.description}
            </p>
          )}
        </div>

        {/* Estimated Value */}
        <div className="space-y-1.5">
          <label htmlFor="proc-edit-budget" className="text-xs font-bold text-slate-700">
            Estimated Budget / Value (₹)
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">
              ₹
            </span>
            <input
              id="proc-edit-budget"
              type="number"
              min="0"
              step="0.01"
              value={draft.estimatedValue}
              onChange={(e) => updateDraft('estimatedValue', e.target.value)}
              placeholder="e.g. 250000"
              className="w-full h-10 pl-8 pr-3.5 text-xs font-semibold rounded-xl border border-slate-300 bg-slate-50/50 text-slate-900 focus:bg-white focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 transition shadow-inner outline-none"
            />
          </div>
          <p className="text-[10px] text-slate-400">Optional: Total estimated financial value.</p>
        </div>

        {/* Submission Deadline */}
        <div className="space-y-1.5">
          <label htmlFor="proc-edit-enddate" className="text-xs font-bold text-slate-700">
            Submission Deadline <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <input
              id="proc-edit-enddate"
              type="datetime-local"
              value={draft.endDate}
              onChange={(e) => updateDraft('endDate', e.target.value)}
              aria-invalid={Boolean(validationErrors.endDate)}
              aria-describedby={validationErrors.endDate ? "proc-edit-enddate-error" : undefined}
              className="w-full h-10 px-3.5 text-xs font-semibold rounded-xl border border-slate-300 bg-slate-50/50 text-slate-900 focus:bg-white focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 transition shadow-inner outline-none"
            />
          </div>
          {validationErrors.endDate ? (
            <p id="proc-edit-enddate-error" className="text-[11px] font-semibold text-rose-600 flex items-center gap-1">
              <AlertCircle className="h-3 w-3 shrink-0" />
              {validationErrors.endDate}
            </p>
          ) : (
            <p className="text-[10px] text-slate-400">Must be a future date and time.</p>
          )}
        </div>

        {/* Delivery / Site Location */}
        <div className="sm:col-span-2 pt-3 border-t border-slate-100 space-y-3">
          <h4 className="text-xs font-black uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 text-indigo-600" />
            Consignee &amp; Delivery Destination
          </h4>

          <div className="grid gap-3.5 sm:grid-cols-3">
            <div className="sm:col-span-3 space-y-1">
              <label htmlFor="proc-edit-location" className="text-xs font-bold text-slate-700">
                Delivery Site Address <span className="text-rose-500">*</span>
              </label>
              <input
                id="proc-edit-location"
                type="text"
                value={draft.deliveryLocation}
                onChange={(e) => updateDraft('deliveryLocation', e.target.value)}
                placeholder="Full delivery location / facility address..."
                aria-invalid={Boolean(validationErrors.deliveryLocation)}
                aria-describedby={validationErrors.deliveryLocation ? "proc-edit-location-error" : undefined}
                className="w-full h-10 px-3.5 text-xs font-semibold rounded-xl border border-slate-300 bg-slate-50/50 text-slate-900 focus:bg-white focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 transition shadow-inner outline-none"
              />
              {validationErrors.deliveryLocation && (
                <p id="proc-edit-location-error" className="text-[11px] font-semibold text-rose-600 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3 shrink-0" />
                  {validationErrors.deliveryLocation}
                </p>
              )}
            </div>

            <div className="space-y-1">
              <label htmlFor="proc-edit-state" className="text-xs font-bold text-slate-700">
                State
              </label>
              <input
                id="proc-edit-state"
                type="text"
                value={draft.state}
                onChange={(e) => updateDraft('state', e.target.value)}
                placeholder="e.g. Maharashtra"
                className="w-full h-10 px-3.5 text-xs font-semibold rounded-xl border border-slate-300 bg-slate-50/50 text-slate-900 focus:bg-white focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 transition shadow-inner outline-none"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="proc-edit-district" className="text-xs font-bold text-slate-700">
                District
              </label>
              <input
                id="proc-edit-district"
                type="text"
                value={draft.district}
                onChange={(e) => updateDraft('district', e.target.value)}
                placeholder="e.g. Pune"
                className="w-full h-10 px-3.5 text-xs font-semibold rounded-xl border border-slate-300 bg-slate-50/50 text-slate-900 focus:bg-white focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 transition shadow-inner outline-none"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="proc-edit-pincode" className="text-xs font-bold text-slate-700">
                PIN Code
              </label>
              <input
                id="proc-edit-pincode"
                type="text"
                maxLength={6}
                value={draft.pincode}
                onChange={(e) => updateDraft('pincode', e.target.value.replace(/\D/g, ''))}
                placeholder="e.g. 411001"
                className="w-full h-10 px-3.5 text-xs font-semibold rounded-xl border border-slate-300 bg-slate-50/50 text-slate-900 focus:bg-white focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 transition shadow-inner outline-none font-mono"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default InPlaceOverviewEditCard;
