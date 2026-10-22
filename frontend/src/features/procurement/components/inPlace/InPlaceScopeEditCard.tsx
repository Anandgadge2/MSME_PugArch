'use client';

import React from 'react';
import {
  Package,
  Plus,
  Trash2,
  FileSpreadsheet,
  AlertCircle,
  Wrench,
  Clock,
  Briefcase
} from 'lucide-react';
import { Button } from '../../../../components/ui/button';
import { InPlaceProcurementDraft, BoqLineItem } from '../../hooks/useInPlaceProcurementEdit';
import { UNIT_OPTIONS } from '../../../procurementWizard/procurementOptions';

export interface InPlaceScopeEditCardProps {
  draft: InPlaceProcurementDraft;
  updateDraft: <K extends keyof InPlaceProcurementDraft>(field: K, value: InPlaceProcurementDraft[K]) => void;
  updateBoqItem: (idx: number, field: keyof BoqLineItem, value: any) => void;
  addBoqItem: () => void;
  removeBoqItem: (idx: number) => void;
  validationErrors: Record<string, string>;
}

export function InPlaceScopeEditCard({
  draft,
  updateDraft,
  updateBoqItem,
  addBoqItem,
  removeBoqItem,
  validationErrors
}: InPlaceScopeEditCardProps) {
  const isBoq = draft.pricingFormat === 'BOQ';
  const isServices = draft.categoryType === 'SERVICES';
  const isWorks = draft.categoryType === 'WORKS';
  const isGoods = draft.categoryType === 'GOODS';

  return (
    <div className="rounded-2xl border-2 border-indigo-200 bg-white p-5 sm:p-6 shadow-sm space-y-6">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-700">
            <Package className="h-4 w-4" />
          </span>
          <div>
            <h3 className="text-sm font-black text-slate-900 tracking-tight">
              Edit Scope, Quantities &amp; Specifications
            </h3>
            <p className="text-xs text-slate-500 font-medium">
              Update line items, technical specifications, BOQ schedules, or SLA terms.
            </p>
          </div>
        </div>
        <span className="text-[10px] font-bold uppercase tracking-wider bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-md">
          {draft.categoryType} • {draft.pricingFormat}
        </span>
      </div>

      {/* Goods: Single Item Configuration */}
      {isGoods && !isBoq && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <label htmlFor="proc-edit-qty" className="text-xs font-bold text-slate-700">
              Required Quantity <span className="text-rose-500">*</span>
            </label>
            <input
              id="proc-edit-qty"
              type="number"
              min="1"
              value={draft.quantity}
              onChange={(e) => updateDraft('quantity', e.target.value)}
              placeholder="e.g. 50"
              aria-invalid={Boolean(validationErrors.quantity)}
              aria-describedby={validationErrors.quantity ? "proc-edit-qty-error" : undefined}
              className="w-full h-10 px-3.5 text-xs font-semibold rounded-xl border border-slate-300 bg-slate-50/50 text-slate-900 focus:bg-white focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 transition shadow-inner outline-none"
            />
            {validationErrors.quantity && (
              <p id="proc-edit-qty-error" className="text-[11px] font-semibold text-rose-600 flex items-center gap-1">
                <AlertCircle className="h-3 w-3 shrink-0" />
                {validationErrors.quantity}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="proc-edit-unit" className="text-xs font-bold text-slate-700">
              Unit of Measure <span className="text-rose-500">*</span>
            </label>
            <select
              id="proc-edit-unit"
              value={draft.unit}
              onChange={(e) => updateDraft('unit', e.target.value)}
              className="w-full h-10 px-3 text-xs font-bold rounded-xl border border-slate-300 bg-white text-slate-800 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 transition shadow-xs outline-none cursor-pointer"
            >
              {UNIT_OPTIONS.map((u) => (
                <option key={u.value} value={u.value}>
                  {u.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="proc-edit-hsn" className="text-xs font-bold text-slate-700">
              HSN / SAC Code
            </label>
            <input
              id="proc-edit-hsn"
              type="text"
              value={draft.hsnCode}
              onChange={(e) => updateDraft('hsnCode', e.target.value)}
              placeholder="e.g. 848180"
              className="w-full h-10 px-3.5 text-xs font-semibold rounded-xl border border-slate-300 bg-slate-50/50 text-slate-900 focus:bg-white focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 transition shadow-inner outline-none font-mono"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="proc-edit-brand" className="text-xs font-bold text-slate-700">
              Make / Brand Preference
            </label>
            <input
              id="proc-edit-brand"
              type="text"
              value={draft.brandPreference}
              onChange={(e) => updateDraft('brandPreference', e.target.value)}
              placeholder="e.g. Kirloskar / L&T / Any standard"
              className="w-full h-10 px-3.5 text-xs font-semibold rounded-xl border border-slate-300 bg-slate-50/50 text-slate-900 focus:bg-white focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 transition shadow-inner outline-none"
            />
          </div>
        </div>
      )}

      {/* BOQ Multi-Line Schedule */}
      {isBoq && (
        <div className="space-y-3.5">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <FileSpreadsheet className="h-4 w-4 text-indigo-600" />
              Bill of Quantities (BOQ) Schedule ({draft.boqItems.length} Line Items)
            </h4>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addBoqItem}
              className="h-8 px-3 text-xs font-bold border-indigo-200 text-indigo-700 hover:bg-indigo-50 rounded-xl cursor-pointer shadow-2xs gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Line Item
            </Button>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-[10px] font-black uppercase tracking-wider text-slate-500">
                  <th className="py-2.5 px-3 w-12 text-center">#</th>
                  <th className="py-2.5 px-3 min-w-[180px]">Item Name / Description <span className="text-rose-500">*</span></th>
                  <th className="py-2.5 px-3 min-w-[100px]">HSN</th>
                  <th className="py-2.5 px-3 w-28">Quantity <span className="text-rose-500">*</span></th>
                  <th className="py-2.5 px-3 w-32">Unit</th>
                  <th className="py-2.5 px-3 w-32">Est. Unit Rate (₹)</th>
                  <th className="py-2.5 px-3 w-12 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {draft.boqItems.map((item, idx) => (
                  <tr key={item.id || idx} className="hover:bg-slate-50/50 transition">
                    <td className="py-2.5 px-3 font-mono text-[11px] text-slate-400 text-center font-bold">
                      {idx + 1}
                    </td>
                    <td className="py-2.5 px-3 space-y-1">
                      <input
                        type="text"
                        value={item.itemName}
                        onChange={(e) => updateBoqItem(idx, 'itemName', e.target.value)}
                        placeholder="Item name..."
                        className="w-full h-8 px-2.5 text-xs font-semibold rounded-lg border border-slate-200 bg-white text-slate-900 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-100 outline-none"
                      />
                      <input
                        type="text"
                        value={item.description || ''}
                        onChange={(e) => updateBoqItem(idx, 'description', e.target.value)}
                        placeholder="Specs / details..."
                        className="w-full h-7 px-2.5 text-[11px] font-normal rounded-lg border border-slate-150 bg-slate-50/50 text-slate-600 focus:border-indigo-600 outline-none"
                      />
                    </td>
                    <td className="py-2.5 px-3">
                      <input
                        type="text"
                        value={item.hsnCode || ''}
                        onChange={(e) => updateBoqItem(idx, 'hsnCode', e.target.value)}
                        placeholder="HSN"
                        className="w-full h-8 px-2 text-xs font-mono rounded-lg border border-slate-200 bg-white text-slate-800 outline-none"
                      />
                    </td>
                    <td className="py-2.5 px-3">
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => updateBoqItem(idx, 'quantity', e.target.value)}
                        className="w-full h-8 px-2 text-xs font-bold rounded-lg border border-slate-200 bg-white text-slate-900 outline-none"
                      />
                    </td>
                    <td className="py-2.5 px-3">
                      <select
                        value={item.unitOfMeasure}
                        onChange={(e) => updateBoqItem(idx, 'unitOfMeasure', e.target.value)}
                        className="w-full h-8 px-2 text-xs font-bold rounded-lg border border-slate-200 bg-white text-slate-800 outline-none cursor-pointer"
                      >
                        {UNIT_OPTIONS.map((u) => (
                          <option key={u.value} value={u.value}>
                            {u.value}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2.5 px-3">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.estimatedUnitPrice || ''}
                        onChange={(e) => updateBoqItem(idx, 'estimatedUnitPrice', e.target.value)}
                        placeholder="Rate"
                        className="w-full h-8 px-2 text-xs font-mono font-semibold rounded-lg border border-slate-200 bg-white text-slate-800 outline-none"
                      />
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <button
                        type="button"
                        onClick={() => removeBoqItem(idx)}
                        disabled={draft.boqItems.length <= 1}
                        className="h-7 w-7 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition inline-flex items-center justify-center disabled:opacity-30 cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Services Specific Section */}
      {isServices && (
        <div className="pt-4 border-t border-slate-100 space-y-4">
          <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
            <Briefcase className="h-4 w-4 text-indigo-600" />
            Service Level Agreement (SLA) &amp; Deliverables
          </h4>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="proc-edit-sow-dur" className="text-xs font-bold text-slate-700">
                Contract Duration (Months)
              </label>
              <input
                id="proc-edit-sow-dur"
                type="number"
                min="1"
                value={draft.contractDurationMonths}
                onChange={(e) => updateDraft('contractDurationMonths', e.target.value)}
                className="w-full h-10 px-3.5 text-xs font-semibold rounded-xl border border-slate-300 bg-slate-50/50 text-slate-900 outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="proc-edit-sow-sla" className="text-xs font-bold text-slate-700">
                SLA &amp; Uptime Requirements
              </label>
              <input
                id="proc-edit-sow-sla"
                type="text"
                value={draft.slaRequirements}
                onChange={(e) => updateDraft('slaRequirements', e.target.value)}
                placeholder="e.g. 99.5% availability, 4-hour MTTR"
                className="w-full h-10 px-3.5 text-xs font-semibold rounded-xl border border-slate-300 bg-slate-50/50 text-slate-900 outline-none"
              />
            </div>

            <div className="sm:col-span-2 space-y-1.5">
              <label htmlFor="proc-edit-sow-deliv" className="text-xs font-bold text-slate-700">
                Key Deliverables Summary
              </label>
              <textarea
                id="proc-edit-sow-deliv"
                rows={2}
                value={draft.deliverablesSummary}
                onChange={(e) => updateDraft('deliverablesSummary', e.target.value)}
                placeholder="Monthly reporting, on-site personnel, software updates..."
                className="w-full p-3 text-xs font-medium rounded-xl border border-slate-300 bg-slate-50/50 text-slate-900 outline-none"
              />
            </div>
          </div>
        </div>
      )}

      {/* Works Specific Section */}
      {isWorks && (
        <div className="pt-4 border-t border-slate-100 space-y-4">
          <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
            <Wrench className="h-4 w-4 text-indigo-600" />
            Civil / Engineering Works Execution
          </h4>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="proc-edit-works-loc" className="text-xs font-bold text-slate-700">
                Work Site Location
              </label>
              <input
                id="proc-edit-works-loc"
                type="text"
                value={draft.workSiteLocation}
                onChange={(e) => updateDraft('workSiteLocation', e.target.value)}
                placeholder="Site premises / civil coordinates"
                className="w-full h-10 px-3.5 text-xs font-semibold rounded-xl border border-slate-300 bg-slate-50/50 text-slate-900 outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="proc-edit-works-defect" className="text-xs font-bold text-slate-700">
                Defect Liability Period (Months)
              </label>
              <input
                id="proc-edit-works-defect"
                type="number"
                min="0"
                value={draft.defectLiabilityPeriod}
                onChange={(e) => updateDraft('defectLiabilityPeriod', e.target.value)}
                placeholder="e.g. 12"
                className="w-full h-10 px-3.5 text-xs font-semibold rounded-xl border border-slate-300 bg-slate-50/50 text-slate-900 outline-none"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default InPlaceScopeEditCard;
