'use client';
import React, { useMemo } from 'react';
import {
  X,
  Search,
  FileText,
  Package,
  FileSpreadsheet,
  Check,
  Percent,
  Calculator,
  ArrowRight,
  AlertCircle,
  Sparkles,
  Building2,
  Receipt,
  Info,
  CheckCircle2,
  Layers,
  ArrowUpRight,
  ShieldCheck
} from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/card';
import { cn } from '../../../lib/utils';
import { formatCurrency } from '../../shared/format';
import { GST_STANDARD_RATES, formatTaxRate } from '../../shared/gstTax';

export interface CreateInvoiceModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: () => Promise<void>;
  submitting: boolean;
  error: string | null;

  // Source Type State
  sourceType: 'po' | 'quotation';
  onSourceTypeChange: (type: 'po' | 'quotation') => void;

  // Search
  search: string;
  onSearchChange: (value: string) => void;

  // Selection
  selectedPurchaseOrderId: number | null;
  onSelectPurchaseOrder: (po: any) => void;
  selectedQuotationId: number | null;
  onSelectQuotation: (quotation: any) => void;

  // Source Data
  acceptedPurchaseOrders: any[];
  filteredPurchaseOrders: any[];
  purchaseOrdersLoading: boolean;
  selectedPurchaseOrder: any;

  submittedQuotations: any[];
  filteredQuotations: any[];
  quotationsLoading: boolean;
  selectedQuotation: any;

  // Form Fields
  invoiceAmount: string;
  onInvoiceAmountChange: (value: string) => void;
  invoiceGstRate: string;
  onInvoiceGstRateChange: (value: string) => void;
  invoiceTdsRate: string;
  onInvoiceTdsRateChange: (value: string) => void;
  invoiceOtherTax: string;
  onInvoiceOtherTaxChange: (value: string) => void;
  invoiceInterstate: boolean;
  onInvoiceInterstateChange: (value: boolean) => void;
}

export function CreateInvoiceModal({
  open,
  onClose,
  onSubmit,
  submitting,
  error,
  sourceType,
  onSourceTypeChange,
  search,
  onSearchChange,
  selectedPurchaseOrderId,
  onSelectPurchaseOrder,
  selectedQuotationId,
  onSelectQuotation,
  acceptedPurchaseOrders,
  filteredPurchaseOrders,
  purchaseOrdersLoading,
  selectedPurchaseOrder,
  submittedQuotations,
  filteredQuotations,
  quotationsLoading,
  selectedQuotation,
  invoiceAmount,
  onInvoiceAmountChange,
  invoiceGstRate,
  onInvoiceGstRateChange,
  invoiceTdsRate,
  onInvoiceTdsRateChange,
  invoiceOtherTax,
  onInvoiceOtherTaxChange,
  invoiceInterstate,
  onInvoiceInterstateChange,
}: CreateInvoiceModalProps) {
  // Live Financial Computations
  const numAmount = useMemo(() => {
    const parsed = parseFloat(invoiceAmount);
    return isNaN(parsed) || parsed < 0 ? 0 : parsed;
  }, [invoiceAmount]);

  const numGstRate = useMemo(() => {
    const parsed = parseFloat(invoiceGstRate);
    return isNaN(parsed) || parsed < 0 ? 0 : parsed;
  }, [invoiceGstRate]);

  const numOtherTaxRate = useMemo(() => {
    const parsed = parseFloat(invoiceOtherTax);
    return isNaN(parsed) || parsed < 0 ? 0 : parsed;
  }, [invoiceOtherTax]);

  const numTdsRate = useMemo(() => {
    const parsed = parseFloat(invoiceTdsRate);
    return isNaN(parsed) || parsed < 0 ? 0 : parsed;
  }, [invoiceTdsRate]);

  const gstAmount = useMemo(() => (numAmount * numGstRate) / 100, [numAmount, numGstRate]);
  const otherTaxAmount = useMemo(() => (numAmount * numOtherTaxRate) / 100, [numAmount, numOtherTaxRate]);
  const tdsAmount = useMemo(() => (numAmount * numTdsRate) / 100, [numAmount, numTdsRate]);
  const grossInvoiceTotal = useMemo(() => numAmount + gstAmount + otherTaxAmount, [numAmount, gstAmount, otherTaxAmount]);
  const netReceivable = useMemo(() => grossInvoiceTotal - tdsAmount, [grossInvoiceTotal, tdsAmount]);

  if (!open) return null;

  const hasSelectedDocument = sourceType === 'po' ? Boolean(selectedPurchaseOrderId) : Boolean(selectedQuotationId);

  const selectedTitle = sourceType === 'po'
    ? selectedPurchaseOrder?.poNumber || 'Selected Purchase Order'
    : `Quote #Q-${selectedQuotation?.id}` || 'Selected Quotation';

  const selectedSubtitle = sourceType === 'po'
    ? selectedPurchaseOrder?.title || 'Purchase Order Items'
    : selectedQuotation?.requirement?.title || 'B2B Quotation';

  const selectedTotalValue = sourceType === 'po'
    ? (selectedPurchaseOrder?.totalValue || selectedPurchaseOrder?.amount || 0)
    : ((Number(selectedQuotation?.offeredPrice || 0) * Number(selectedQuotation?.offeredQuantity || 1)) || Number(selectedQuotation?.offeredPrice || 0));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/70 p-2 sm:p-4 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative flex max-h-[94vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-2xl">
        
        {/* Premium Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200/80 bg-linear-to-r from-slate-900 via-[#12335f] to-slate-900 px-5 py-4 text-white">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-white backdrop-blur-md ring-1 ring-white/20 shadow-xs">
              <Receipt className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">
                  Tax Invoice Generator
                </span>
                <span className="inline-flex items-center rounded-full bg-white/15 px-2 py-0.5 text-[9px] font-bold text-white">
                  GST Compliant
                </span>
              </div>
              <h2 className="text-lg font-bold tracking-tight text-white sm:text-xl">
                Create Tax Invoice
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-white/15 bg-white/10 p-2 text-white/80 transition-colors hover:bg-white/20 hover:text-white cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Modal Body - 2-Column Responsive Split */}
        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
            
            {/* LEFT COLUMN: Source Document Selector (5 Cols) */}
            <div className="space-y-3.5 lg:col-span-5 lg:border-r lg:border-slate-200 lg:pr-5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#12335f] text-[10px] font-bold text-white">1</span>
                  Select Source Document
                </label>
                <span className="text-[11px] text-slate-500 font-medium">
                  {sourceType === 'po' ? `${acceptedPurchaseOrders.length} Available` : `${submittedQuotations.length} Available`}
                </span>
              </div>

              {/* Source Switcher Tabs */}
              <div className="flex rounded-xl bg-slate-100 p-1 border border-slate-200/80">
                <button
                  type="button"
                  onClick={() => onSourceTypeChange('po')}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
                    sourceType === 'po'
                      ? "bg-white text-slate-900 shadow-xs border border-slate-200"
                      : "text-slate-600 hover:text-slate-900"
                  )}
                >
                  <Package className={cn("h-3.5 w-3.5", sourceType === 'po' ? "text-[#12335f]" : "text-slate-400")} />
                  <span>Purchase Orders ({acceptedPurchaseOrders.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => onSourceTypeChange('quotation')}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
                    sourceType === 'quotation'
                      ? "bg-white text-slate-900 shadow-xs border border-slate-200"
                      : "text-slate-600 hover:text-slate-900"
                  )}
                >
                  <FileSpreadsheet className={cn("h-3.5 w-3.5", sourceType === 'quotation' ? "text-[#12335f]" : "text-slate-400")} />
                  <span>Quotations ({submittedQuotations.length})</span>
                </button>
              </div>

              {/* Search Bar */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={e => onSearchChange(e.target.value)}
                  placeholder={sourceType === 'po' ? "Search PO #, title, or order value..." : "Search quote ID, requirement title..."}
                  className="h-9 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-xs font-medium placeholder:text-slate-400 focus:border-[#12335f] focus:outline-none focus:ring-2 focus:ring-[#12335f]/15"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => onSearchChange('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-[11px] font-bold"
                  >
                    Clear
                  </button>
                )}
              </div>

              {/* Scrollable Document Cards List */}
              <div className="max-h-[300px] lg:max-h-[380px] space-y-2 overflow-y-auto pr-1">
                {sourceType === 'po' ? (
                  purchaseOrdersLoading ? (
                    <div className="flex flex-col items-center justify-center py-12 text-slate-400 text-xs">
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-[#12335f] mb-2" />
                      Loading accepted purchase orders...
                    </div>
                  ) : filteredPurchaseOrders.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/50 p-6 text-center">
                      <Package className="h-6 w-6 text-slate-400 mx-auto mb-1.5" />
                      <p className="text-xs font-bold text-slate-700">No Accepted Purchase Orders</p>
                      <p className="text-[11px] text-slate-500 mt-1">
                        {search ? 'No purchase orders match your search query.' : 'Invoices can only be created for POs accepted by the buyer.'}
                      </p>
                    </div>
                  ) : (
                    filteredPurchaseOrders.map(po => {
                      const isSelected = selectedPurchaseOrderId === po.id;
                      const orderVal = po.totalValue || po.amount || 0;
                      return (
                        <div
                          key={po.id}
                          onClick={() => onSelectPurchaseOrder(po)}
                          className={cn(
                            "group relative rounded-xl p-3 border transition-all cursor-pointer text-left",
                            isSelected
                              ? "border-[#12335f] bg-[#12335f]/5 shadow-xs ring-1 ring-[#12335f]/20"
                              : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60"
                          )}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono text-xs font-bold text-slate-900 group-hover:text-[#12335f]">
                                  {po.poNumber}
                                </span>
                                {po.buyer?.name && (
                                  <span className="text-[10px] text-slate-400 font-medium truncate">
                                    · {po.buyer.name}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-slate-600 line-clamp-1 mt-0.5 font-medium">
                                {po.title || 'Purchase Order'}
                              </p>
                            </div>
                            <div className="text-right shrink-0">
                              <span className="text-xs font-extrabold text-slate-900 block">
                                {formatCurrency(orderVal)}
                              </span>
                              {isSelected ? (
                                <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-700 mt-0.5">
                                  <CheckCircle2 className="h-3 w-3 text-emerald-600" /> Selected
                                </span>
                              ) : (
                                <span className="text-[10px] text-slate-400 group-hover:text-slate-600">
                                  Click to link
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )
                ) : (
                  quotationsLoading ? (
                    <div className="flex flex-col items-center justify-center py-12 text-slate-400 text-xs">
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-[#12335f] mb-2" />
                      Loading submitted quotations...
                    </div>
                  ) : filteredQuotations.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/50 p-6 text-center">
                      <FileSpreadsheet className="h-6 w-6 text-slate-400 mx-auto mb-1.5" />
                      <p className="text-xs font-bold text-slate-700">No Submitted Quotations</p>
                      <p className="text-[11px] text-slate-500 mt-1">
                        {search ? 'No quotations match your search.' : 'Submit a bid response to a buyer requirement first.'}
                      </p>
                    </div>
                  ) : (
                    filteredQuotations.map(q => {
                      const isSelected = selectedQuotationId === q.id;
                      const totalVal = (Number(q.offeredPrice || 0) * Number(q.offeredQuantity || 1)) || Number(q.offeredPrice || 0);
                      return (
                        <div
                          key={q.id}
                          onClick={() => onSelectQuotation(q)}
                          className={cn(
                            "group relative rounded-xl p-3 border transition-all cursor-pointer text-left",
                            isSelected
                              ? "border-[#12335f] bg-[#12335f]/5 shadow-xs ring-1 ring-[#12335f]/20"
                              : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60"
                          )}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono text-xs font-bold text-slate-900 group-hover:text-[#12335f]">
                                  Quote #Q-{q.id}
                                </span>
                                <span className="text-[9px] font-bold uppercase px-1.5 py-0.2 rounded bg-blue-50 text-blue-700">
                                  {q.status || 'SUBMITTED'}
                                </span>
                              </div>
                              <p className="text-xs text-slate-600 line-clamp-1 mt-0.5 font-medium">
                                {q.requirement?.title || 'Requirement Quotation'}
                              </p>
                            </div>
                            <div className="text-right shrink-0">
                              <span className="text-xs font-extrabold text-slate-900 block">
                                {formatCurrency(totalVal)}
                              </span>
                              {isSelected ? (
                                <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-700 mt-0.5">
                                  <CheckCircle2 className="h-3 w-3 text-emerald-600" /> Selected
                                </span>
                              ) : (
                                <span className="text-[10px] text-slate-400 group-hover:text-slate-600">
                                  Click to link
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )
                )}
              </div>
            </div>

            {/* RIGHT COLUMN: Invoice Financials, Taxes & Live Receipt (7 Cols) */}
            <div className="space-y-4 lg:col-span-7">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#12335f] text-[10px] font-bold text-white">2</span>
                  Invoice Financials & Taxes
                </label>
                {hasSelectedDocument && (
                  <span className="text-[11px] font-semibold text-emerald-700 flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                    <Check className="h-3 w-3" /> Linked to {sourceType === 'po' ? 'PO' : 'Quote'}
                  </span>
                )}
              </div>

              {/* Linked Document Card Banner */}
              {hasSelectedDocument ? (
                <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-blue-700">
                      Linked Source Document
                    </p>
                    <p className="text-xs font-bold text-slate-900 truncate mt-0.5">
                      {selectedTitle} · {selectedSubtitle}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Original Order Value: <strong className="text-slate-800">{formatCurrency(selectedTotalValue)}</strong>
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-[10px] font-bold bg-white text-blue-800 border-blue-200 shrink-0 cursor-pointer hover:bg-blue-50"
                    onClick={() => {
                      if (selectedTotalValue) onInvoiceAmountChange(String(selectedTotalValue));
                    }}
                  >
                    Reset Amount
                  </Button>
                </div>
              ) : (
                <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3 flex items-start gap-2.5">
                  <Info className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-900">
                    Please select an accepted purchase order or submitted quotation from the left panel to auto-populate the invoice.
                  </p>
                </div>
              )}

              {/* Amount & GST Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                
                {/* Invoice Taxable Base Amount */}
                <div className="space-y-1">
                  <label htmlFor="inv-amount-input" className="text-xs font-bold text-slate-700 flex items-center justify-between">
                    <span>Taxable Base Amount (₹) *</span>
                    <span className="text-[10px] font-normal text-slate-400">Excl. Taxes</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">₹</span>
                    <input
                      id="inv-amount-input"
                      type="number"
                      min={0}
                      step="any"
                      value={invoiceAmount}
                      onChange={e => onInvoiceAmountChange(e.target.value)}
                      placeholder="0.00"
                      className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-7 pr-3 text-xs font-bold text-slate-900 focus:border-[#12335f] focus:outline-none focus:ring-2 focus:ring-[#12335f]/15"
                    />
                  </div>
                </div>

                {/* GST Rate Preset Chips & Select */}
                <div className="space-y-1">
                  <label htmlFor="inv-gst-select" className="text-xs font-bold text-slate-700 flex items-center justify-between">
                    <span>GST Tax Rate (%) *</span>
                    <span className="text-[10px] font-normal text-slate-400">Standard GST</span>
                  </label>
                  <div className="flex gap-1.5">
                    <select
                      id="inv-gst-select"
                      value={invoiceGstRate}
                      onChange={e => onInvoiceGstRateChange(e.target.value)}
                      className="h-10 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-900 focus:border-[#12335f] focus:outline-none focus:ring-2 focus:ring-[#12335f]/15 cursor-pointer"
                    >
                      {GST_STANDARD_RATES.map(rate => (
                        <option key={`gst-${rate}`} value={String(rate)}>
                          {formatTaxRate(rate)}% GST
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Quick GST Pill Selectors */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Quick GST:</span>
                {GST_STANDARD_RATES.map(rate => (
                  <button
                    key={`quick-gst-${rate}`}
                    type="button"
                    onClick={() => onInvoiceGstRateChange(String(rate))}
                    className={cn(
                      "px-2 py-0.5 rounded-md text-[11px] font-bold border transition-all cursor-pointer",
                      invoiceGstRate === String(rate)
                        ? "bg-[#12335f] text-white border-[#12335f]"
                        : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                    )}
                  >
                    {rate}%
                  </button>
                ))}
              </div>

              {/* Interstate / Supply Type Switch */}
              <div
                onClick={() => onInvoiceInterstateChange(!invoiceInterstate)}
                className={cn(
                  "flex items-center justify-between rounded-xl border p-3 cursor-pointer transition-all",
                  invoiceInterstate
                    ? "border-purple-300 bg-purple-50/50 ring-1 ring-purple-200"
                    : "border-slate-200 bg-slate-50/50 hover:bg-slate-100/50"
                )}
              >
                <div className="flex items-center gap-2.5">
                  <div className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold",
                    invoiceInterstate ? "bg-purple-600 text-white" : "bg-slate-200 text-slate-700"
                  )}>
                    {invoiceInterstate ? 'IGST' : 'GST'}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-900">
                      {invoiceInterstate ? 'Interstate Supply (Out of State)' : 'Intrastate Supply (Within State)'}
                    </p>
                    <p className="text-[10px] text-slate-500">
                      {invoiceInterstate
                        ? `Applies unified IGST @ ${numGstRate}%`
                        : `Splits into CGST (${(numGstRate / 2).toFixed(1)}%) + SGST (${(numGstRate / 2).toFixed(1)}%)`}
                    </p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={invoiceInterstate}
                  onChange={e => onInvoiceInterstateChange(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-[#12335f] focus:ring-[#12335f]"
                />
              </div>

              {/* TDS & Other Tax Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="space-y-1">
                  <label htmlFor="inv-tds-input" className="text-xs font-bold text-slate-700 flex items-center justify-between">
                    <span>TDS Rate (%)</span>
                    <span className="text-[10px] font-normal text-slate-400">Withholding Tax</span>
                  </label>
                  <div className="flex gap-1.5">
                    <input
                      id="inv-tds-input"
                      type="number"
                      min={0}
                      max={100}
                      step="any"
                      value={invoiceTdsRate}
                      onChange={e => onInvoiceTdsRateChange(e.target.value)}
                      placeholder="0"
                      className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-900 focus:border-[#12335f] focus:outline-none focus:ring-2 focus:ring-[#12335f]/15"
                    />
                  </div>
                  <div className="flex gap-1 mt-1">
                    {[
                      ['0', '0% None'],
                      ['1', '1% 194C (Goods)'],
                      ['2', '2% 194J (Services)']
                    ].map(([rate, label]) => (
                      <button
                        key={rate}
                        type="button"
                        onClick={() => onInvoiceTdsRateChange(rate)}
                        className={cn(
                          "text-[10px] px-1.5 py-0.5 rounded border transition-all cursor-pointer",
                          invoiceTdsRate === rate
                            ? "bg-slate-800 text-white border-slate-800 font-bold"
                            : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                        )}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1">
                  <label htmlFor="inv-other-tax-input" className="text-xs font-bold text-slate-700 flex items-center justify-between">
                    <span>Other Tax / Cess (%)</span>
                    <span className="text-[10px] font-normal text-slate-400">Optional</span>
                  </label>
                  <input
                    id="inv-other-tax-input"
                    type="number"
                    min={0}
                    max={100}
                    step="any"
                    value={invoiceOtherTax}
                    onChange={e => onInvoiceOtherTaxChange(e.target.value)}
                    placeholder="0"
                    className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-900 focus:border-[#12335f] focus:outline-none focus:ring-2 focus:ring-[#12335f]/15"
                  />
                </div>
              </div>

              {/* Real-time Calculation Receipt Breakdown Card */}
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 space-y-2.5">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                    <Calculator className="h-3.5 w-3.5 text-[#12335f]" /> Real-Time Invoice Calculation
                  </span>
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    Live Breakdown
                  </span>
                </div>

                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Taxable Base Value</span>
                    <span className="font-mono font-bold text-slate-900">{formatCurrency(numAmount)}</span>
                  </div>

                  {invoiceInterstate ? (
                    <div className="flex justify-between text-slate-600">
                      <span>IGST ({numGstRate}%)</span>
                      <span className="font-mono font-bold text-purple-700">+{formatCurrency(gstAmount)}</span>
                    </div>
                  ) : (
                    <>
                      <div className="flex justify-between text-slate-600">
                        <span>CGST ({(numGstRate / 2).toFixed(1)}%)</span>
                        <span className="font-mono font-bold text-slate-700">+{formatCurrency(gstAmount / 2)}</span>
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span>SGST ({(numGstRate / 2).toFixed(1)}%)</span>
                        <span className="font-mono font-bold text-slate-700">+{formatCurrency(gstAmount / 2)}</span>
                      </div>
                    </>
                  )}

                  {otherTaxAmount > 0 && (
                    <div className="flex justify-between text-slate-600">
                      <span>Other Taxes ({numOtherTaxRate}%)</span>
                      <span className="font-mono font-bold text-slate-700">+{formatCurrency(otherTaxAmount)}</span>
                    </div>
                  )}

                  {tdsAmount > 0 && (
                    <div className="flex justify-between text-amber-700">
                      <span>TDS Withholding ({numTdsRate}%)</span>
                      <span className="font-mono font-bold text-amber-700">-{formatCurrency(tdsAmount)}</span>
                    </div>
                  )}

                  <div className="border-t border-slate-200 pt-2 flex items-center justify-between">
                    <div>
                      <span className="text-xs font-extrabold text-slate-900 block">Gross Invoice Value</span>
                      <span className="text-[10px] text-slate-400">Total Billed to Buyer</span>
                    </div>
                    <div className="text-right">
                      <span className="text-base font-black text-slate-950 block">
                        {formatCurrency(grossInvoiceTotal)}
                      </span>
                      {tdsAmount > 0 && (
                        <span className="text-[10px] font-bold text-emerald-700">
                          Net Receivable: {formatCurrency(netReceivable)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Error Banner */}
              {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-bold text-red-800 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
                  <span>{error}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer Controls */}
        <div className="flex shrink-0 flex-col-reverse sm:flex-row items-center justify-between gap-3 border-t border-slate-200 bg-slate-50/70 px-5 py-3.5">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            <span>Invoice automatically transitions to delivery tracking on submission</span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={submitting}
              className="h-10 flex-1 sm:flex-none rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-100 cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={onSubmit}
              disabled={submitting || !hasSelectedDocument || numAmount <= 0}
              className="h-10 flex-1 sm:flex-none rounded-xl bg-[#12335f] px-5 text-xs font-bold text-white hover:bg-slate-800 cursor-pointer shadow-xs"
            >
              {submitting ? (
                <>
                  <div className="mr-2 h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Generating Invoice...
                </>
              ) : (
                <>
                  Create Tax Invoice ({formatCurrency(grossInvoiceTotal)})
                  <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
