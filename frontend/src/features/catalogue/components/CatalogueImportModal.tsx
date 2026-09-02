'use client';
import React, { useRef, useState } from 'react';
import { Download, FileUp, Loader2, Upload, X, AlertTriangle, CheckCircle2, Package, Wrench, FileSpreadsheet, Sparkles, Check, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/card';
import { cn } from '../../../lib/utils';
import { catalogueApi, downloadCatalogueFile, type ImportPreviewResult } from '../api';

type ImportKind = 'product' | 'service';

export function CatalogueImportModal({ kind: initialKind, open, onClose, onComplete }: {
  kind: ImportKind;
  open: boolean;
  onClose: () => void;
  onComplete: () => void;
}) {
  const [selectedKind, setSelectedKind] = useState<ImportKind>(initialKind);
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<ImportPreviewResult | null>(null);

  if (!open) return null;

  const reset = () => {
    setFile(null);
    setPreview(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleKindChange = (newKind: ImportKind) => {
    setSelectedKind(newKind);
    reset();
  };

  const handleValidate = async () => {
    if (!file) {
      toast.error('Select an Excel (.xlsx) file first');
      return;
    }
    setLoading(true);
    try {
      const result = selectedKind === 'product'
        ? await catalogueApi.importProductsPreview(file)
        : await catalogueApi.importServicesPreview(file);
      setPreview(result);
      if (result.validRows > 0) {
        toast.success(`Validated ${result.validRows} of ${result.totalRows} rows successfully.`);
      } else {
        toast.error(`Validation found errors in all ${result.totalRows} rows. Check the error report.`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Validation failed');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async (publish: boolean) => {
    if (!preview?.batchId) return;
    setLoading(true);
    try {
      await catalogueApi.confirmImport(preview.batchId, publish);
      toast.success(publish ? 'Imported and published valid rows to marketplace.' : 'Imported valid rows as drafts.');
      reset();
      onComplete();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setLoading(false);
    }
  };

  const isProduct = selectedKind === 'product';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-3 sm:p-4 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="flex h-full w-full max-h-[90vh] flex-col overflow-hidden bg-white shadow-2xl rounded-2xl border border-slate-200 sm:max-w-3xl">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-200/90 px-5 py-3.5 bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className={cn(
              "h-8 w-8 rounded-xl flex items-center justify-center text-white shadow-xs text-xs",
              isProduct ? "bg-emerald-600" : "bg-[#12335f]"
            )}>
              {isProduct ? <Package className="h-4 w-4" /> : <Wrench className="h-4 w-4" />}
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 leading-tight">
                Bulk Import Catalogue {isProduct ? 'Products' : 'Services'}
              </h2>
              <p className="text-[11px] text-slate-500">
                Import multiple {selectedKind} offerings with full specifications, pricing, and media URLs.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => { reset(); onClose(); }}
            className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
          {/* Product / Service Switcher */}
          <div className="flex rounded-xl bg-slate-100 p-1 border border-slate-200/80">
            <button
              type="button"
              onClick={() => handleKindChange('product')}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-1.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer",
                selectedKind === 'product'
                  ? "bg-white text-slate-900 shadow-xs border border-slate-200"
                  : "text-slate-600 hover:text-slate-900"
              )}
            >
              <Package className={cn("h-3.5 w-3.5", selectedKind === 'product' ? "text-emerald-600" : "text-slate-400")} />
              <span>Products Import</span>
            </button>
            <button
              type="button"
              onClick={() => handleKindChange('service')}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-1.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer",
                selectedKind === 'service'
                  ? "bg-white text-slate-900 shadow-xs border border-slate-200"
                  : "text-slate-600 hover:text-slate-900"
              )}
            >
              <Wrench className={cn("h-3.5 w-3.5", selectedKind === 'service' ? "text-blue-600" : "text-slate-400")} />
              <span>Services Import</span>
            </button>
          </div>

          {/* Guidelines & Template Download Card */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/70 pb-3">
              <div>
                <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                  Official {isProduct ? 'Product' : 'Service'} Excel Template (.xlsx)
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Includes sample records, field instructions, and valid dropdown category values.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-xs font-bold text-emerald-800 border-emerald-300 bg-emerald-50 hover:bg-emerald-100/80 cursor-pointer shadow-xs"
                onClick={() => downloadCatalogueFile(
                  isProduct ? '/api/catalogue/import/templates/products' : '/api/catalogue/import/templates/services',
                  isProduct ? 'catalogue_products_template.xlsx' : 'catalogue_services_template.xlsx'
                ).catch(() => toast.error('Template download failed'))}
              >
                <Download className="mr-1.5 h-3.5 w-3.5" /> Download Template
              </Button>
            </div>

            {/* Field Breakdown Pills */}
            <div className="space-y-1.5 text-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Supported Fields in Template:</span>
              <div className="flex flex-wrap gap-1.5 text-[11px]">
                {isProduct ? (
                  <>
                    <span className="bg-emerald-100/80 text-emerald-800 font-semibold px-2 py-0.5 rounded-md border border-emerald-200/60">Product Name *</span>
                    <span className="bg-emerald-100/80 text-emerald-800 font-semibold px-2 py-0.5 rounded-md border border-emerald-200/60">Category *</span>
                    <span className="bg-emerald-100/80 text-emerald-800 font-semibold px-2 py-0.5 rounded-md border border-emerald-200/60">Price *</span>
                    <span className="bg-emerald-100/80 text-emerald-800 font-semibold px-2 py-0.5 rounded-md border border-emerald-200/60">Unit of Measure *</span>
                    <span className="bg-white text-slate-700 px-2 py-0.5 rounded-md border border-slate-200">GST Rate (%)</span>
                    <span className="bg-white text-slate-700 px-2 py-0.5 rounded-md border border-slate-200">HSN Code</span>
                    <span className="bg-white text-slate-700 px-2 py-0.5 rounded-md border border-slate-200">SKU</span>
                    <span className="bg-white text-slate-700 px-2 py-0.5 rounded-md border border-slate-200">Brand</span>
                    <span className="bg-white text-slate-700 px-2 py-0.5 rounded-md border border-slate-200">Model</span>
                    <span className="bg-white text-slate-700 px-2 py-0.5 rounded-md border border-slate-200">Condition</span>
                    <span className="bg-white text-slate-700 px-2 py-0.5 rounded-md border border-slate-200">MSME Made</span>
                    <span className="bg-white text-slate-700 px-2 py-0.5 rounded-md border border-slate-200">Discount & Offers</span>
                    <span className="bg-white text-slate-700 px-2 py-0.5 rounded-md border border-slate-200">Bulk MOQ</span>
                    <span className="bg-white text-slate-700 px-2 py-0.5 rounded-md border border-slate-200">Image URLs</span>
                    <span className="bg-white text-slate-700 px-2 py-0.5 rounded-md border border-slate-200">Document URLs</span>
                    <span className="bg-blue-50 text-blue-700 font-semibold px-2 py-0.5 rounded-md border border-blue-200">Technical Specs Sheet</span>
                  </>
                ) : (
                  <>
                    <span className="bg-emerald-100/80 text-emerald-800 font-semibold px-2 py-0.5 rounded-md border border-emerald-200/60">Service Name *</span>
                    <span className="bg-emerald-100/80 text-emerald-800 font-semibold px-2 py-0.5 rounded-md border border-emerald-200/60">Category *</span>
                    <span className="bg-emerald-100/80 text-emerald-800 font-semibold px-2 py-0.5 rounded-md border border-emerald-200/60">Pricing Model *</span>
                    <span className="bg-emerald-100/80 text-emerald-800 font-semibold px-2 py-0.5 rounded-md border border-emerald-200/60">Base Price *</span>
                    <span className="bg-emerald-100/80 text-emerald-800 font-semibold px-2 py-0.5 rounded-md border border-emerald-200/60">Service Area *</span>
                    <span className="bg-white text-slate-700 px-2 py-0.5 rounded-md border border-slate-200">GST Rate (%)</span>
                    <span className="bg-white text-slate-700 px-2 py-0.5 rounded-md border border-slate-200">Scope of Work</span>
                    <span className="bg-white text-slate-700 px-2 py-0.5 rounded-md border border-slate-200">Deliverables</span>
                    <span className="bg-white text-slate-700 px-2 py-0.5 rounded-md border border-slate-200">Inclusions</span>
                    <span className="bg-white text-slate-700 px-2 py-0.5 rounded-md border border-slate-200">Exclusions</span>
                    <span className="bg-white text-slate-700 px-2 py-0.5 rounded-md border border-slate-200">SLA Response</span>
                    <span className="bg-white text-slate-700 px-2 py-0.5 rounded-md border border-slate-200">Duration</span>
                    <span className="bg-white text-slate-700 px-2 py-0.5 rounded-md border border-slate-200">Discount & Offers</span>
                    <span className="bg-white text-slate-700 px-2 py-0.5 rounded-md border border-slate-200">Bulk MOQ</span>
                    <span className="bg-white text-slate-700 px-2 py-0.5 rounded-md border border-slate-200">Image URLs</span>
                    <span className="bg-white text-slate-700 px-2 py-0.5 rounded-md border border-slate-200">Document URLs</span>
                    <span className="bg-blue-50 text-blue-700 font-semibold px-2 py-0.5 rounded-md border border-blue-200">Service Specs Sheet</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* File Dropzone */}
          <label className={cn(
            "flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 transition-all duration-150",
            file
              ? "border-emerald-500 bg-emerald-50/30"
              : "border-slate-300 bg-white hover:bg-slate-50 hover:border-slate-400"
          )}>
            <Upload className={cn("mb-2 h-7 w-7", file ? "text-emerald-600" : "text-slate-400")} />
            <span className="text-xs font-bold text-slate-700">
              {file ? file.name : 'Choose or drop your filled .xlsx file here'}
            </span>
            <span className="text-[10px] text-slate-400 mt-0.5">
              Supports .xlsx up to 10MB (max 1000 items per batch)
            </span>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx"
              className="hidden"
              onChange={e => { setFile(e.target.files?.[0] || null); setPreview(null); }}
            />
          </label>

          {/* Validate & Preview Action Button */}
          <div className="flex items-center justify-between gap-2">
            <Button
              type="button"
              disabled={loading || !file}
              onClick={handleValidate}
              className="h-9 rounded-xl bg-slate-900 text-xs font-bold text-white hover:bg-slate-800 cursor-pointer shadow-xs px-4"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  Validating spreadsheet...
                </>
              ) : (
                <>
                  <FileUp className="mr-1.5 h-3.5 w-3.5" />
                  Validate & Preview Data
                </>
              )}
            </Button>
            {file && !loading && (
              <button
                type="button"
                onClick={reset}
                className="text-xs font-semibold text-slate-500 hover:text-slate-800 cursor-pointer"
              >
                Clear file
              </button>
            )}
          </div>

          {/* Preview & Validation Results Section */}
          {preview && (
            <div className="space-y-3 pt-2 border-t border-slate-200 animate-in fade-in duration-200">
              {/* Summary Counter Grid */}
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  ['Total Rows', preview.totalRows, 'text-slate-900'],
                  ['Valid Rows', preview.validRows, 'text-emerald-700'],
                  ['Invalid Rows', preview.invalidRows, preview.invalidRows > 0 ? 'text-red-600' : 'text-slate-500'],
                  ['Duplicate Rows', preview.duplicateRows, preview.duplicateRows > 0 ? 'text-amber-600' : 'text-slate-500']
                ].map(([label, val, colorClass]) => (
                  <div key={String(label)} className="rounded-xl border border-slate-200 bg-white p-3 text-center shadow-xs">
                    <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">{label}</p>
                    <p className={cn("text-lg font-extrabold mt-0.5", colorClass)}>{val}</p>
                  </div>
                ))}
              </div>

              {preview.warnings?.length > 0 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-3 text-xs text-amber-800">
                  {preview.warnings.map((w, i) => <p key={i}>{w}</p>)}
                </div>
              )}

              {/* Error Breakdown if any */}
              {preview.rowErrors?.length > 0 && (
                <div className="rounded-xl border border-red-200 bg-red-50/60 p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="flex items-center gap-1.5 text-xs font-bold text-red-800">
                      <AlertTriangle className="h-4 w-4 text-red-600" /> Row validation issues ({preview.rowErrors.length})
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-[10px] font-bold border-red-300 text-red-700 hover:bg-red-100/50 bg-white"
                      onClick={() => downloadCatalogueFile(`/api/catalogue/import/${preview.batchId}/errors/download`, `import_errors_${preview.batchId}.xlsx`).catch(() => toast.error('Error report download failed'))}
                    >
                      <Download className="mr-1 h-3 w-3" /> Download Error Report (.xlsx)
                    </Button>
                  </div>
                  <div className="max-h-36 overflow-y-auto text-[11px] bg-white rounded-lg border border-red-100 p-2">
                    <table className="w-full">
                      <thead>
                        <tr className="text-left text-red-800 font-bold border-b border-red-100 pb-1">
                          <th className="py-1 pr-2">Row</th>
                          <th className="py-1 pr-2">Field</th>
                          <th className="py-1">Error Message</th>
                        </tr>
                      </thead>
                      <tbody>
                        {preview.rowErrors.slice(0, 25).map((err, i) => (
                          <tr key={i} className="border-t border-red-50">
                            <td className="py-1 pr-2 font-mono font-bold text-red-700">{err.rowNumber}</td>
                            <td className="py-1 pr-2 font-semibold text-slate-700">{err.field || '—'}</td>
                            <td className="py-1 text-slate-600">{err.message}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Valid Rows Preview Table */}
              {preview.preview?.length > 0 && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-3.5 space-y-2">
                  <p className="flex items-center gap-1.5 text-xs font-bold text-emerald-900">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Preview of Valid Rows (Showing first {Math.min(preview.preview.length, 50)})
                  </p>
                  <div className="max-h-40 overflow-y-auto text-[11px] bg-white rounded-lg border border-emerald-100 p-2">
                    <table className="w-full">
                      <thead>
                        <tr className="text-left text-slate-600 font-bold border-b border-slate-100 pb-1">
                          <th className="py-1">Name</th>
                          <th className="py-1">Status</th>
                          <th className="py-1">Specs</th>
                          <th className="py-1">Images</th>
                        </tr>
                      </thead>
                      <tbody>
                        {preview.preview.map((row: any, i) => (
                          <tr key={i} className="border-t border-slate-100">
                            <td className="py-1 font-semibold text-slate-900">{row.name}</td>
                            <td className="py-1">
                              <span className="text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-bold">{row.status}</span>
                            </td>
                            <td className="py-1 text-slate-500">{row.specifications?.length || 0} attributes</td>
                            <td className="py-1 text-slate-500">{row.imageIds?.length || 0} media</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Final Import Submission Actions */}
              <div className="flex flex-wrap items-center gap-2.5 border-t border-slate-100 pt-3">
                <Button
                  type="button"
                  disabled={loading || preview.validRows === 0}
                  onClick={() => handleConfirm(false)}
                  className="h-9 rounded-xl bg-slate-900 text-xs font-bold text-white hover:bg-slate-800 cursor-pointer shadow-xs px-4"
                >
                  Confirm Import as Drafts
                </Button>
                <Button
                  type="button"
                  disabled={loading || preview.validRows === 0}
                  onClick={() => handleConfirm(true)}
                  className={cn(
                    "h-9 rounded-xl text-xs font-bold text-white cursor-pointer shadow-xs px-4",
                    isProduct ? "bg-emerald-600 hover:bg-emerald-700" : "bg-[#12335f] hover:bg-[#0e274a]"
                  )}
                >
                  <Check className="mr-1.5 h-3.5 w-3.5" />
                  Confirm & Publish ACTIVE Rows
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

