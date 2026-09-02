'use client';

import React, { useMemo, useState, useCallback } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  BadgeCheck,
  Box,
  Building2,
  Check,
  ChevronDown,
  ChevronUp,
  Download,
  ExternalLink,
  Eye,
  FileCheck,
  FileCode,
  FileDown,
  FileSpreadsheet,
  FileText,
  GitCompareArrows,
  Info,
  Layers,
  MapPin,
  Maximize2,
  Package,
  PackageSearch,
  Percent,
  Plus,
  Printer,
  Share2,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Tag,
  Trash2,
  Truck,
  Wrench,
  X
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../../../components/ui/button';
import { Card, CardContent } from '../../../components/ui/card';
import { EmptyState, InlineError, LoadingState } from '../../shared/FeatureStates';
import { KpiCard } from '../../shared/KpiCard';
import { formatCurrency, formatDate } from '../../shared/format';
import { openFileAsset } from '../../../lib/files';
import { marketplaceApi } from '../api';
import { useCompare } from '../hooks/useCompare';
import { useMarketplaceCart } from '../hooks/useMarketplaceCart';
import {
  buildProductFallbackImage,
  buildServiceFallbackImage,
  getMarketplaceImageCandidates,
  resolveMarketplaceImage
} from '../utils/marketplaceImages';

/* -------------------------------------------------------------------------
   Types & Interfaces
   ------------------------------------------------------------------------- */

type DocumentItem = {
  id: string | number;
  name: string;
  issuingAuthority?: string | null;
  certificateNumber?: string | null;
  verificationStatus?: string | null;
  issuedAt?: string | null;
  expiresAt?: string | null;
  mimeType?: string | null;
  fileAsset?: any;
  url?: string | null;
};

type SpecEntry = {
  name: string;
  value: string;
  unit?: string;
};

type CompareRow = {
  key: string;
  label: string;
  group: 'Overview & Pricing' | 'Technical Identifiers' | 'Specifications' | 'Documents & Compliance' | 'Service Scope & SLA' | 'Description';
  description?: string;
  render: (item: any, isDiff: boolean, isLowestPrice?: boolean) => React.ReactNode;
  getRawValue: (item: any) => unknown;
};

/* -------------------------------------------------------------------------
   Helper Utilities
   ------------------------------------------------------------------------- */

const isImageFile = (file: any) => {
  const mime = String(file?.mimeType || file?.fileAsset?.mimeType || '').toLowerCase();
  const name = String(file?.originalName || file?.name || file?.fileAsset?.originalName || file?.url || '').toLowerCase();
  return mime.startsWith('image/') || /\.(png|jpe?g|webp|gif|svg|avif|bmp)$/i.test(name);
};

const getDocumentIcon = (fileName: string, mimeType?: string | null) => {
  const name = String(fileName || '').toLowerCase();
  const mime = String(mimeType || '').toLowerCase();
  if (name.endsWith('.pdf') || mime.includes('pdf')) {
    return <FileText className="h-4 w-4 text-rose-600 shrink-0" />;
  }
  if (name.endsWith('.xlsx') || name.endsWith('.xls') || name.endsWith('.csv') || mime.includes('spreadsheet') || mime.includes('excel')) {
    return <FileSpreadsheet className="h-4 w-4 text-emerald-600 shrink-0" />;
  }
  if (name.endsWith('.docx') || name.endsWith('.doc') || mime.includes('word') || mime.includes('officedocument')) {
    return <FileText className="h-4 w-4 text-blue-600 shrink-0" />;
  }
  return <FileCode className="h-4 w-4 text-slate-500 shrink-0" />;
};

const text = (value: unknown): string => {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value).replace(/_/g, ' ');
};

const hasValue = (value: unknown): boolean => {
  if (value === null || value === undefined || value === '') return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'boolean') return true;
  return String(value).trim() !== '' && String(value).trim() !== '—';
};

const normalizeVal = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return String(value);
  if (Array.isArray(value)) return JSON.stringify(value);
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value).trim().toLowerCase();
};

const parseItemSpecifications = (item: any): SpecEntry[] => {
  const raw = item?.specifications || item?.technicalSpecs || item?.specs || item?.attributes;
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw
      .map((entry: any) => {
        if (typeof entry === 'object' && entry !== null) {
          const name = String(entry.name || entry.key || entry.label || entry.param || '').trim();
          const value = String(entry.value || entry.val || '').trim();
          const unit = entry.unit ? String(entry.unit).trim() : undefined;
          if (name && value) return { name, value, unit };
        }
        return null;
      })
      .filter(Boolean) as SpecEntry[];
  }
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return parseItemSpecifications({ specifications: parsed });
    } catch {
      return [];
    }
  }
  if (typeof raw === 'object' && raw !== null) {
    return Object.entries(raw)
      .map(([k, v]) => {
        if (v === null || v === undefined || v === '') return null;
        return { name: k.trim(), value: String(v).trim() };
      })
      .filter(Boolean) as SpecEntry[];
  }
  return [];
};

const extractItemDocuments = (item: any): DocumentItem[] => {
  if (!item) return [];
  const rawList: any[] = [
    ...(item.documents || []),
    ...(item.certifications || []),
    ...(item.attachments || []),
    ...(item.files || []).filter((f: any) => !isImageFile(f)),
    ...(item.catalogueFiles || []).filter((f: any) => !isImageFile(f))
  ];

  const docs: DocumentItem[] = [];
  const seen = new Set<string>();

  for (const doc of rawList) {
    if (!doc) continue;
    const id = doc.id || doc.fileAssetId || `doc-${Math.random().toString(36).slice(2, 7)}`;
    const name = doc.name || doc.originalName || doc.title || 'Technical Document';
    const key = `${id}:${name}:${doc.fileAsset?.url || doc.url || ''}`;
    if (seen.has(key)) continue;
    seen.add(key);

    docs.push({
      id,
      name,
      issuingAuthority: doc.issuingAuthority,
      certificateNumber: doc.certificateNumber,
      verificationStatus: doc.verificationStatus || 'UPLOADED',
      issuedAt: doc.issuedAt,
      expiresAt: doc.expiresAt,
      mimeType: doc.mimeType || doc.fileAsset?.mimeType,
      fileAsset: doc.fileAsset || doc,
      url: doc.url || doc.fileAsset?.url || null
    });
  }

  return docs;
};

/* -------------------------------------------------------------------------
   Component: Product / Service Image with Fallback & Thumbnail Rail
   ------------------------------------------------------------------------- */

function CompareItemImage({
  item,
  onZoom
}: {
  item: any;
  onZoom: (url: string) => void;
}) {
  const itemType = String(item.type || '').toLowerCase() as 'product' | 'service';
  const candidates = useMemo(() => getMarketplaceImageCandidates(item), [item]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [failedImgs, setFailedImgs] = useState<string[]>([]);

  const validCandidates = candidates.filter(url => !failedImgs.includes(url));
  const activeUrl = validCandidates[activeIdx] || validCandidates[0] || resolveMarketplaceImage(item, itemType);

  const handleImgError = (failedUrl: string) => {
    setFailedImgs(prev => (prev.includes(failedUrl) ? prev : [...prev, failedUrl]));
  };

  const isFallbackSvg = activeUrl.startsWith('data:image/svg+xml');

  return (
    <div className="space-y-2">
      <div className="group relative aspect-4/3 w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-center p-2 transition">
        <img
          src={activeUrl}
          alt={item.name}
          onError={() => handleImgError(activeUrl)}
          className={`h-full w-full ${isFallbackSvg ? 'object-cover' : 'object-contain'} transition-transform duration-300 group-hover:scale-105`}
        />
        {!isFallbackSvg && (
          <button
            type="button"
            onClick={() => onZoom(activeUrl)}
            className="absolute right-2 top-2 rounded-lg bg-slate-900/60 p-1.5 text-white backdrop-blur-sm opacity-0 group-hover:opacity-100 hover:bg-[#0b2447] transition shadow-sm"
            title="Zoom image"
            aria-label={`Zoom photo of ${item.name}`}
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
        )}
        <div className="absolute left-2 top-2 flex flex-wrap gap-1">
          <span
            className={`rounded px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider ${
              itemType === 'service'
                ? 'bg-blue-100 text-blue-800'
                : 'bg-emerald-100 text-emerald-800'
            }`}
          >
            {item.type}
          </span>
          {item.isMsmeMade && (
            <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-amber-800">
              MSME
            </span>
          )}
        </div>
      </div>

      {validCandidates.length > 1 && (
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
          {validCandidates.map((url, idx) => (
            <button
              key={`${url}-${idx}`}
              type="button"
              onClick={() => setActiveIdx(idx)}
              className={`relative h-11 w-11 shrink-0 overflow-hidden rounded-lg border-2 bg-slate-50 transition ${
                idx === activeIdx
                  ? 'border-[#0b2447] ring-2 ring-[#0b2447]/20'
                  : 'border-slate-200 opacity-60 hover:opacity-100'
              }`}
              aria-label={`View photo ${idx + 1}`}
            >
              <img
                src={url}
                alt=""
                onError={() => handleImgError(url)}
                className="h-full w-full object-contain p-0.5"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}



/* -------------------------------------------------------------------------
   Main Page Component
   ------------------------------------------------------------------------- */

export default function MarketplaceComparePage() {
  const compare = useCompare();
  const { add: addToCart } = useMarketplaceCart();
  const [differencesOnly, setDifferencesOnly] = useState(false);
  const [zoomImageUrl, setZoomImageUrl] = useState<string | null>(null);
  const [expandedDescriptions, setExpandedDescriptions] = useState<Record<string, boolean>>({});

  const query = useQuery({
    queryKey: ['marketplace-compare', compare.ids],
    queryFn: () => marketplaceApi.getCompareItems(compare.ids),
    enabled: compare.ids.length > 0,
    staleTime: 30_000
  });

  const items = query.data?.items || [];
  const hasProducts = items.some(item => String(item.type).toUpperCase() === 'PRODUCT');
  const hasServices = items.some(item => String(item.type).toUpperCase() === 'SERVICE');

  // Collect all unique specification keys across all items
  const allSpecNames = useMemo(() => {
    const specOrder: string[] = [];
    const seen = new Set<string>();

    for (const item of items) {
      const specs = parseItemSpecifications(item);
      for (const spec of specs) {
        const normalizedName = spec.name.trim();
        if (normalizedName && !seen.has(normalizedName.toLowerCase())) {
          seen.add(normalizedName.toLowerCase());
          specOrder.push(normalizedName);
        }
      }
    }

    return specOrder;
  }, [items]);

  // Build rows configuration
  const rows: CompareRow[] = useMemo(() => {
    const baseRows: CompareRow[] = [
      // Overview & Pricing
      {
        key: 'type',
        label: 'Category Type',
        group: 'Overview & Pricing',
        getRawValue: item => item.type,
        render: item => (
          <span className="inline-flex items-center gap-1 font-bold text-slate-800">
            {item.type === 'SERVICE' ? <Wrench className="h-3.5 w-3.5 text-blue-600" /> : <Package className="h-3.5 w-3.5 text-emerald-600" />}
            {item.type}
          </span>
        )
      },
      {
        key: 'seller',
        label: 'Seller / Organization',
        group: 'Overview & Pricing',
        getRawValue: item => item.sellerOrganization?.organizationName || item.seller?.name,
        render: item => {
          const sellerName = item.sellerOrganization?.organizationName || item.seller?.name || 'Verified Supplier';
          const isVerified = String(item.verificationStatus || '').toUpperCase() === 'VERIFIED';
          return (
            <div className="space-y-1">
              <p className="font-bold text-slate-900 line-clamp-2">{sellerName}</p>
              {isVerified && (
                <span className="inline-flex items-center gap-1 rounded bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                  <BadgeCheck className="h-3 w-3" /> Verified Supplier
                </span>
              )}
            </div>
          );
        }
      },
      {
        key: 'category',
        label: 'Category',
        group: 'Overview & Pricing',
        getRawValue: item => item.category?.name,
        render: item => <span className="font-medium text-slate-800">{item.category?.name || 'General Category'}</span>
      },
      {
        key: 'price',
        label: 'Price / Rate',
        group: 'Overview & Pricing',
        getRawValue: item => item.price,
        render: (item, _isDiff, isLowestPrice) => {
          const price = Number(item.price || 0);
          const origPrice = Number(item.originalPrice || 0);
          const discountPercent = Number(item.discountPercent || item.discount || 0);

          if (!price) {
            return <span className="font-bold text-slate-600">Quote Based</span>;
          }

          return (
            <div className="space-y-1">
              <div className="flex flex-wrap items-baseline gap-1.5">
                <span className={`text-base font-black ${isLowestPrice ? 'text-emerald-700' : 'text-slate-950'}`}>
                  {formatCurrency(price)}
                </span>
                {origPrice > price && (
                  <span className="text-xs text-slate-400 line-through">
                    {formatCurrency(origPrice)}
                  </span>
                )}
              </div>
              {discountPercent > 0 && (
                <span className="inline-flex items-center gap-0.5 rounded bg-rose-50 px-1.5 py-0.5 text-[10px] font-black text-rose-700">
                  <Percent className="h-2.5 w-2.5" /> {discountPercent}% OFF
                </span>
              )}
              {isLowestPrice && items.length > 1 && (
                <span className="inline-block rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-emerald-800">
                  ★ Lowest Price
                </span>
              )}
            </div>
          );
        }
      },
      {
        key: 'taxInfo',
        label: 'GST / Tax Rate',
        group: 'Overview & Pricing',
        getRawValue: item => item.taxInfo,
        render: item => (
          <span className="font-medium text-slate-700">
            {hasValue(item.taxInfo) ? `${text(item.taxInfo)}% GST` : 'Included / Standard'}
          </span>
        )
      },
      {
        key: 'unit',
        label: 'Unit / Pricing Model',
        group: 'Overview & Pricing',
        getRawValue: item => item.unit || item.pricingModel,
        render: item => <span className="font-medium text-slate-700">{text(item.unit || item.pricingModel)}</span>
      },
      {
        key: 'bulkDeal',
        label: 'Bulk Orders',
        group: 'Overview & Pricing',
        getRawValue: item => item.bulkDealAvailable,
        render: item => (
          <div>
            {item.bulkDealAvailable ? (
              <div className="space-y-0.5">
                <span className="inline-flex items-center gap-1 rounded bg-purple-50 px-2 py-0.5 text-[10px] font-black text-purple-700">
                  <Sparkles className="h-3 w-3" /> Available
                </span>
                {item.bulkMinQuantity && (
                  <p className="text-[11px] text-slate-500">Min. {item.bulkMinQuantity} units</p>
                )}
              </div>
            ) : (
              <span className="text-xs text-slate-400">Standard Quantity</span>
            )}
          </div>
        )
      },
      {
        key: 'location',
        label: 'Location / Region',
        group: 'Overview & Pricing',
        getRawValue: item => item.location || item.serviceArea,
        render: item => {
          const loc = item.location || item.serviceArea;
          return loc ? (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-700">
              <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              {loc}
            </span>
          ) : (
            <span className="text-slate-400">—</span>
          );
        }
      },
      {
        key: 'deliveryTime',
        label: 'Lead / Delivery Time',
        group: 'Overview & Pricing',
        getRawValue: item => item.deliveryTime,
        render: item => (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-700">
            <Truck className="h-3.5 w-3.5 text-slate-400 shrink-0" />
            {text(item.deliveryTime || 'Standard Delivery')}
          </span>
        )
      },

      // Technical Identifiers
      {
        key: 'brand',
        label: 'Brand Name',
        group: 'Technical Identifiers',
        getRawValue: item => item.brand,
        render: item => <span className="font-bold text-slate-900">{text(item.brand)}</span>
      },
      {
        key: 'modelNumber',
        label: 'Model Number / Ref',
        group: 'Technical Identifiers',
        getRawValue: item => item.modelNumber,
        render: item => <span className="font-mono text-xs font-bold text-slate-800">{text(item.modelNumber)}</span>
      },
      {
        key: 'sku',
        label: 'SKU Code',
        group: 'Technical Identifiers',
        getRawValue: item => item.sku,
        render: item => <span className="font-mono text-xs text-slate-600">{text(item.sku)}</span>
      },
      {
        key: 'hsnCode',
        label: 'HSN / SAC Code',
        group: 'Technical Identifiers',
        getRawValue: item => item.hsnCode,
        render: item => <span className="font-mono text-xs font-bold text-slate-700">{text(item.hsnCode)}</span>
      },
      {
        key: 'itemCondition',
        label: 'Item Condition',
        group: 'Technical Identifiers',
        getRawValue: item => item.itemCondition,
        render: item => (
          <span className="inline-block rounded bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-700">
            {text(item.itemCondition || 'New / Original')}
          </span>
        )
      },
      {
        key: 'isMsmeMade',
        label: 'MSME Certified Make',
        group: 'Technical Identifiers',
        getRawValue: item => item.isMsmeMade,
        render: item =>
          item.isMsmeMade ? (
            <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-800 border border-amber-200">
              <Check className="h-3.5 w-3.5 text-amber-600" /> Yes (MSME Registered)
            </span>
          ) : (
            <span className="text-xs text-slate-500">Standard Marketplace</span>
          )
      }
    ];

    // Dynamic Specifications Rows
    const specRows: CompareRow[] = allSpecNames.map(specName => ({
      key: `spec_${specName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
      label: specName,
      group: 'Specifications',
      getRawValue: item => {
        const specs = parseItemSpecifications(item);
        const match = specs.find(s => s.name.toLowerCase() === specName.toLowerCase());
        return match ? `${match.value}${match.unit ? ` ${match.unit}` : ''}` : null;
      },
      render: item => {
        const specs = parseItemSpecifications(item);
        const match = specs.find(s => s.name.toLowerCase() === specName.toLowerCase());
        if (!match) return <span className="text-slate-300 font-mono">—</span>;
        return (
          <span className="font-bold text-slate-900">
            {match.value}
            {match.unit && <span className="ml-1 text-xs font-normal text-slate-500">{match.unit}</span>}
          </span>
        );
      }
    }));

    // Documents & Certifications Row
    const documentRows: CompareRow[] = [
      {
        key: 'documents_and_certifications',
        label: 'Certifications & Datasheets',
        group: 'Documents & Compliance',
        getRawValue: item => extractItemDocuments(item).map(d => d.name),
        render: item => {
          const docs = extractItemDocuments(item);
          if (docs.length === 0) {
            return <span className="text-xs italic text-slate-400">No documents attached</span>;
          }
          return (
            <div className="space-y-2">
              {docs.map(doc => (
                <div
                  key={doc.id}
                  className="flex flex-col gap-1.5 rounded-lg border border-slate-200 bg-slate-50 p-2.5 transition hover:border-slate-300 hover:bg-white"
                >
                  <div className="flex items-start gap-2">
                    {getDocumentIcon(doc.name, doc.mimeType)}
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-slate-900 truncate" title={doc.name}>
                        {doc.name}
                      </p>
                      {doc.issuingAuthority && (
                        <p className="text-[10px] text-slate-500">
                          Auth: <span className="font-semibold text-slate-700">{doc.issuingAuthority}</span>
                          {doc.certificateNumber && ` (${doc.certificateNumber})`}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                    <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[9px] font-black uppercase text-emerald-700">
                      {doc.verificationStatus || 'VERIFIED'}
                    </span>
                    {doc.fileAsset && (
                      <button
                        type="button"
                        onClick={() =>
                          openFileAsset(doc.fileAsset, doc.name).catch(err =>
                            toast.error(err instanceof Error ? err.message : 'Unable to open document')
                          )
                        }
                        className="inline-flex items-center gap-1 rounded bg-white px-2 py-0.5 text-[10px] font-bold text-[#0b2447] border border-slate-200 hover:bg-slate-100 transition shadow-2xs cursor-pointer"
                        title={`Download ${doc.name}`}
                      >
                        <Download className="h-2.5 w-2.5" /> View
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          );
        }
      }
    ];

    // Service specific rows (only if at least 1 service is compared)
    const serviceRows: CompareRow[] = hasServices
      ? [
          {
            key: 'scopeOfWork',
            label: 'Scope of Work',
            group: 'Service Scope & SLA',
            getRawValue: item => item.scopeOfWork,
            render: item => <span className="text-xs text-slate-700 whitespace-pre-line">{text(item.scopeOfWork)}</span>
          },
          {
            key: 'deliverables',
            label: 'Deliverables',
            group: 'Service Scope & SLA',
            getRawValue: item => item.deliverables,
            render: item => <span className="text-xs text-slate-700">{text(item.deliverables)}</span>
          },
          {
            key: 'slaResponseTime',
            label: 'SLA Response Time',
            group: 'Service Scope & SLA',
            getRawValue: item => item.slaResponseTime,
            render: item => <span className="font-medium text-slate-800">{text(item.slaResponseTime)}</span>
          },
          {
            key: 'duration',
            label: 'Project Duration',
            group: 'Service Scope & SLA',
            getRawValue: item => item.duration,
            render: item => <span className="font-medium text-slate-800">{text(item.duration)}</span>
          }
        ]
      : [];

    // Description Row
    const descriptionRows: CompareRow[] = [
      {
        key: 'description',
        label: 'Description & Summary',
        group: 'Description',
        getRawValue: item => item.description,
        render: item => {
          const desc = item.description || 'No description provided';
          const isExpanded = Boolean(expandedDescriptions[item.id]);
          const isLong = desc.length > 140;

          return (
            <div className="space-y-1.5">
              <p className={`text-xs text-slate-700 leading-relaxed ${isExpanded || !isLong ? '' : 'line-clamp-3'}`}>
                {desc}
              </p>
              {isLong && (
                <button
                  type="button"
                  onClick={() =>
                    setExpandedDescriptions(prev => ({ ...prev, [item.id]: !prev[item.id] }))
                  }
                  className="inline-flex items-center gap-0.5 text-[11px] font-bold text-[#0b2447] hover:underline cursor-pointer"
                >
                  {isExpanded ? (
                    <>Show Less <ChevronUp className="h-3 w-3" /></>
                  ) : (
                    <>Read More <ChevronDown className="h-3 w-3" /></>
                  )}
                </button>
              )}
            </div>
          );
        }
      },
      {
        key: 'lastUpdated',
        label: 'Listing Updated',
        group: 'Description',
        getRawValue: item => item.lastUpdated || item.updatedAt,
        render: item => (
          <span className="text-xs text-slate-500">
            {formatDate(item.lastUpdated || item.updatedAt)}
          </span>
        )
      }
    ];

    return [...baseRows, ...specRows, ...documentRows, ...serviceRows, ...descriptionRows];
  }, [allSpecNames, hasServices, expandedDescriptions, items.length]);

  // Filter rows based on "differencesOnly" toggle
  const visibleRows = useMemo(() => {
    return rows.filter(row => {
      const hasAnyValue = items.some(item => hasValue(row.getRawValue(item)));
      const alwaysShow = [
        'type',
        'seller',
        'category',
        'price',
        'taxInfo',
        'unit',
        'documents_and_certifications',
        'description'
      ].includes(row.key);

      if (!alwaysShow && !hasAnyValue) return false;
      if (!differencesOnly || items.length < 2) return true;

      const distinctValues = new Set(items.map(item => normalizeVal(row.getRawValue(item))));
      return distinctValues.size > 1;
    });
  }, [rows, items, differencesOnly]);

  // Group rows by Section header
  const rowGroups = useMemo(() => {
    return visibleRows.reduce<Record<string, CompareRow[]>>((acc, row) => {
      acc[row.group] = [...(acc[row.group] || []), row];
      return acc;
    }, {});
  }, [visibleRows]);

  // Actions
  const handleShare = useCallback(() => {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.href);
      toast.success('Comparison link copied to clipboard!');
    }
  }, []);

  const handlePrint = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  }, []);

  const handleAddToCart = useCallback((item: any) => {
    addToCart({
      id: Number(item.id),
      name: item.name,
      price: Number(item.price || 0),
      imageUrl: item.imageUrl,
      type: 'product',
      unit: item.unit,
      category: item.category?.name
    });
    toast.success(`${item.name} added to cart!`);
  }, [addToCart]);

  /* -------------------------------------------------------------------------
     Render States
     ------------------------------------------------------------------------- */

  if (compare.ids.length === 0) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center bg-slate-50 p-4">
        <div className="mx-auto w-full max-w-xl text-center">
          <EmptyState
            title="No items selected for comparison"
            description="Choose products or services from the marketplace to perform a side-by-side technical and commercial comparison."
          />
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link href="/marketplace/products">
              <Button className="bg-[#0b2447] text-white hover:bg-[#12335f]">
                <Package className="mr-2 h-4 w-4" /> Browse Products
              </Button>
            </Link>
            <Link href="/marketplace/services">
              <Button variant="outline" className="border-slate-300">
                <Wrench className="mr-2 h-4 w-4" /> Browse Services
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (query.isLoading) {
    return <ComparePageSkeleton itemCount={compare.ids.length || 4} />;
  }

  if (query.error) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center bg-slate-50 p-4">
        <InlineError
          message={(query.error as Error).message || 'Failed to load comparison data.'}
          onRetry={() => query.refetch()}
        />
      </div>
    );
  }

  const verifiedSellersCount = query.data?.highlights?.verifiedCount ?? items.filter(
    i => String(i.verificationStatus || '').toUpperCase() === 'VERIFIED'
  ).length;

  const lowestPrice = query.data?.highlights?.lowestPrice;

  return (
    <div className="flex min-h-full flex-col items-center bg-slate-50/70 p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-7xl space-y-6">
        
        {/* Header & Controls Strip */}
        <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-slate-500 mb-1">
              <Link href="/marketplace/products" className="inline-flex items-center gap-1 hover:text-[#0b2447]">
                <ArrowLeft className="h-3.5 w-3.5" /> Marketplace
              </Link>
              <span>/</span>
              <span className="text-slate-900">Compare Portal</span>
            </div>
            <h1 className="text-2xl font-black text-slate-950 tracking-tight">Compare Products & Services</h1>
            <p className="mt-0.5 text-xs font-semibold text-slate-500">
              {items.length} of 4 items selected for side-by-side technical & procurement review
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {items.length < 4 && (
              <Link href="/marketplace/products">
                <Button variant="outline" size="sm" className="border-slate-300 text-slate-700 font-bold">
                  <Plus className="mr-1.5 h-3.5 w-3.5" /> Add More
                </Button>
              </Link>
            )}

            <Button
              variant={differencesOnly ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setDifferencesOnly(prev => !prev)}
              className={differencesOnly ? 'bg-[#0b2447] text-white' : 'border-slate-300 text-slate-700 font-bold'}
              aria-pressed={differencesOnly}
            >
              <GitCompareArrows className="mr-1.5 h-3.5 w-3.5" />
              {differencesOnly ? 'Showing Differences' : 'Highlight Differences'}
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleShare}
              className="border-slate-300 text-slate-700 font-bold"
              title="Share comparison link"
            >
              <Share2 className="mr-1.5 h-3.5 w-3.5" /> Share
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handlePrint}
              className="border-slate-300 text-slate-700 font-bold hidden sm:inline-flex"
              title="Print comparison table"
            >
              <Printer className="mr-1.5 h-3.5 w-3.5" /> Print
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={compare.clear}
              className="border-rose-200 text-rose-700 hover:bg-rose-50 font-bold"
              title="Clear all compared items"
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Clear All
            </Button>
          </div>
        </div>

        {/* Highlights Bar */}
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          <KpiCard
            icon={Box}
            label="Compared Items"
            value={items.length}
            subtext="Up to 4 concurrent items"
            tone="blue"
          />
          <KpiCard
            icon={BadgeCheck}
            label="Verified Suppliers"
            value={verifiedSellersCount}
            subtext="Govt & MSME verified"
            tone="emerald"
          />
          <KpiCard
            icon={ShieldCheck}
            label="Lowest Quoted Price"
            value={lowestPrice ? formatCurrency(lowestPrice) : 'Quote Based'}
            subtext="Best competitive listing"
            tone="green"
          />
          <KpiCard
            icon={Layers}
            label="Total Specifications"
            value={allSpecNames.length}
            subtext="Parameters mapped side-by-side"
            tone="purple"
          />
        </div>

        {/* Product Cards Top Stage */}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {items.map(item => {
            const itemType = String(item.type || '').toLowerCase() as 'product' | 'service';
            const detailHref = item.detailUrl || `/marketplace/${itemType === 'service' ? 'services' : 'products'}/${item.id}`;
            const price = Number(item.price || 0);

            return (
              <Card
                key={`${item.type}:${item.id}`}
                className="overflow-hidden border-slate-200/90 bg-white shadow-xs flex flex-col justify-between"
              >
                <div className="p-4 space-y-3">
                  {/* Photo Component with Auto-Fallback */}
                  <CompareItemImage
                    item={item}
                    onZoom={url => setZoomImageUrl(url)}
                  />

                  {/* Header Titles */}
                  <div>
                    <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-slate-400">
                      <span>{item.type} #{item.id}</span>
                      <button
                        type="button"
                        onClick={() => compare.remove(itemType, item.id)}
                        className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-rose-600 transition cursor-pointer"
                        title="Remove from comparison"
                        aria-label={`Remove ${item.name}`}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    <h2 className="mt-1 line-clamp-2 text-sm font-black text-slate-950 leading-snug" title={item.name}>
                      {item.name}
                    </h2>
                    <p className="mt-0.5 line-clamp-1 text-xs font-semibold text-slate-500">
                      {item.category?.name || 'General Category'}
                    </p>
                  </div>

                  {/* Price Block */}
                  <div className="rounded-lg bg-slate-50 p-2.5 border border-slate-100">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Commercials</p>
                    <div className="mt-1 flex items-baseline justify-between">
                      <span className="text-base font-black text-slate-900">
                        {price > 0 ? formatCurrency(price) : 'Quote Based'}
                      </span>
                      {item.unit && (
                        <span className="text-[11px] font-bold text-slate-500">
                          per {item.unit}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Card Footer Actions */}
                <div className="p-4 pt-0 space-y-2">
                  <div className="flex gap-2">
                    <Link href={detailHref} className="flex-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="w-full border-slate-300 font-bold text-xs hover:bg-slate-50"
                      >
                        <Eye className="mr-1.5 h-3.5 w-3.5" /> Full Details
                      </Button>
                    </Link>

                    {itemType === 'product' && (
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => handleAddToCart(item)}
                        className="bg-[#0b2447] text-white hover:bg-[#12335f] font-bold text-xs"
                        title="Add to Shopping Cart"
                      >
                        <ShoppingCart className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        {/* Detailed Side-By-Side Comparison Matrix */}
        <Card className="border-slate-200 bg-white shadow-sm overflow-hidden">
          <CardContent className="p-0">
            <div className="overflow-x-auto w-full">
              <table className="w-full min-w-[860px] text-left text-sm border-collapse" role="table">
                {/* Table Sticky Header */}
                <thead className="bg-slate-100/80 border-b border-slate-200">
                  <tr>
                    <th
                      scope="col"
                      className="sticky left-0 z-20 w-64 bg-slate-100 p-4 text-[11px] font-black uppercase tracking-widest text-[#0b2447] border-r border-slate-200"
                    >
                      Specifications & Details
                    </th>
                    {items.map(item => (
                      <th
                        key={`${item.type}:${item.id}`}
                        scope="col"
                        className="min-w-64 p-4 align-top text-xs font-black text-slate-900 border-r border-slate-100 last:border-r-0"
                      >
                        <div className="flex items-center justify-between">
                          <span className="truncate max-w-[200px]" title={item.name}>{item.name}</span>
                          <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[9px] font-black uppercase text-slate-700">
                            {item.type}
                          </span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>

                {/* Table Body by Section */}
                {Object.entries(rowGroups).map(([groupName, groupRows]) => (
                  <tbody key={groupName} className="divide-y divide-slate-100">
                    {/* Section Header Divider */}
                    <tr className="bg-slate-50/90">
                      <td
                        colSpan={items.length + 1}
                        className="px-4 py-2.5 text-xs font-black uppercase tracking-wider text-[#0b2447] border-y border-slate-200/80 bg-slate-100/50"
                      >
                        <div className="flex items-center gap-1.5">
                          {groupName === 'Overview & Pricing' && <Tag className="h-4 w-4 text-[#0b2447]" />}
                          {groupName === 'Technical Identifiers' && <ClipboardList className="h-4 w-4 text-[#0b2447]" />}
                          {groupName === 'Specifications' && <Layers className="h-4 w-4 text-[#0b2447]" />}
                          {groupName === 'Documents & Compliance' && <FileCheck className="h-4 w-4 text-[#0b2447]" />}
                          {groupName === 'Service Scope & SLA' && <Wrench className="h-4 w-4 text-[#0b2447]" />}
                          {groupName === 'Description' && <Info className="h-4 w-4 text-[#0b2447]" />}
                          <span>{groupName}</span>
                          <span className="ml-2 rounded-full bg-slate-200 px-2 py-0.2 text-[10px] font-bold text-slate-600">
                            {groupRows.length}
                          </span>
                        </div>
                      </td>
                    </tr>

                    {/* Section Row Entries */}
                    {groupRows.map((row, rowIdx) => {
                      const distinctValues = new Set(items.map(item => normalizeVal(row.getRawValue(item))));
                      const isDiff = items.length > 1 && distinctValues.size > 1;

                      return (
                        <tr
                          key={row.key}
                          className={`transition ${
                            isDiff && differencesOnly ? 'bg-amber-50/30' : rowIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'
                          } hover:bg-blue-50/40`}
                        >
                          {/* Row Header */}
                          <td className="sticky left-0 z-10 bg-white/95 p-3.5 text-xs font-black text-slate-700 border-r border-slate-200 shadow-2xs">
                            <div className="flex items-center justify-between gap-2">
                              <span>{row.label}</span>
                              {isDiff && (
                                <span
                                  className="h-1.5 w-1.5 rounded-full bg-amber-500"
                                  title="Attributes differ across items"
                                />
                              )}
                            </div>
                          </td>

                          {/* Item Value Cells */}
                          {items.map(item => {
                            const isLowestPrice =
                              row.key === 'price' &&
                              Number(item.price) > 0 &&
                              Number(item.price) === Number(lowestPrice);

                            return (
                              <td
                                key={`${item.type}:${item.id}:${row.key}`}
                                className={`p-3.5 align-top text-xs border-r border-slate-100 last:border-r-0 ${
                                  isLowestPrice ? 'bg-emerald-50/60 font-bold' : ''
                                }`}
                              >
                                {row.render(item, isDiff, isLowestPrice)}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                ))}
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Bottom Procurement Banner */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900">Need Bulk Procurement or Tender Inquiries?</h3>
              <p className="text-xs text-slate-500">
                You can raise official RFQs or bulk purchase orders directly with verified MSME suppliers.
              </p>
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <Link href="/marketplace/products">
              <Button variant="outline" className="border-slate-300 font-bold text-xs">
                Continue Browsing
              </Button>
            </Link>
            <Link href="/buyer/orders">
              <Button className="bg-[#0b2447] text-white hover:bg-[#12335f] font-bold text-xs">
                View My Orders
              </Button>
            </Link>
          </div>
        </div>

      </div>

      {/* Image Zoom Modal */}
      {zoomImageUrl && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setZoomImageUrl(null)}
        >
          <div
            className="relative max-h-[90vh] max-w-4xl overflow-hidden rounded-2xl bg-white p-3 shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setZoomImageUrl(null)}
              className="absolute right-4 top-4 z-10 rounded-full bg-slate-900/70 p-2 text-white hover:bg-slate-950 transition cursor-pointer"
              aria-label="Close zoom modal"
            >
              <X className="h-5 w-5" />
            </button>
            <img
              src={zoomImageUrl}
              alt="High resolution preview"
              className="max-h-[82vh] w-auto rounded-xl object-contain"
            />
          </div>
        </div>
      )}
    </div>
  );
}

function ClipboardList(props: React.SVGProps<SVGSVGElement> & { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <rect width="8" height="4" x="8" y="2" rx="1" ry="1" />
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <path d="M12 11h4" />
      <path d="M12 16h4" />
      <path d="M8 11h.01" />
      <path d="M8 16h.01" />
    </svg>
  );
}

function ComparePageSkeleton({ itemCount = 4 }: { itemCount?: number }) {
  const count = Math.max(2, Math.min(4, itemCount));
  return (
    <div
      role="status"
      aria-label="Loading comparison data"
      className="flex min-h-full flex-col items-center bg-slate-50/70 p-4 sm:p-6 lg:p-8 animate-in fade-in duration-300 w-full"
    >
      <div className="w-full max-w-7xl space-y-6">
        {/* Header Strip Skeleton */}
        <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <div className="h-3 w-32 animate-pulse rounded bg-slate-200" />
            <div className="h-7 w-64 animate-pulse rounded-lg bg-slate-200" />
            <div className="h-3.5 w-80 animate-pulse rounded bg-slate-100" />
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="h-8 w-24 animate-pulse rounded-lg bg-slate-100" />
            <div className="h-8 w-36 animate-pulse rounded-lg bg-slate-100" />
            <div className="h-8 w-20 animate-pulse rounded-lg bg-slate-100" />
          </div>
        </div>

        {/* 4 Metric Highlights Skeleton */}
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="rounded-xl border border-slate-200/80 bg-white p-3 sm:p-3.5 shadow-2xs">
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="h-2.5 w-20 animate-pulse rounded bg-slate-200" />
                  <div className="h-5 sm:h-6 w-24 animate-pulse rounded bg-slate-300" />
                  <div className="h-2 w-28 animate-pulse rounded bg-slate-100" />
                </div>
                <div className="h-8 w-8 sm:h-9 sm:w-9 animate-pulse rounded-lg bg-slate-200 shrink-0" />
              </div>
            </div>
          ))}
        </div>

        {/* Product Cards Top Stage Skeleton */}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: count }).map((_, i) => (
            <Card key={i} className="overflow-hidden border-slate-200/90 bg-white shadow-xs">
              <div className="p-4 space-y-3">
                <div className="aspect-4/3 w-full animate-pulse rounded-xl bg-slate-100" />
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <div className="h-2.5 w-16 animate-pulse rounded bg-slate-100" />
                    <div className="h-3.5 w-3.5 animate-pulse rounded bg-slate-100" />
                  </div>
                  <div className="h-4 w-full animate-pulse rounded bg-slate-200" />
                  <div className="h-3 w-2/3 animate-pulse rounded bg-slate-100" />
                </div>
                <div className="rounded-lg bg-slate-50 p-2.5 space-y-1.5 border border-slate-100">
                  <div className="h-2 w-14 animate-pulse rounded bg-slate-100" />
                  <div className="h-5 w-24 animate-pulse rounded bg-slate-200" />
                </div>
                <div className="flex gap-2 pt-1">
                  <div className="h-8 flex-1 animate-pulse rounded-lg bg-slate-100" />
                  <div className="h-8 w-9 animate-pulse rounded-lg bg-slate-100" />
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Comparison Matrix Table Skeleton */}
        <Card className="border-slate-200 bg-white shadow-sm overflow-hidden">
          <CardContent className="p-0">
            <div className="overflow-x-auto w-full">
              <div className="min-w-[860px]">
                {/* Table Header */}
                <div className="bg-slate-100/80 p-4 flex gap-4 border-b border-slate-200">
                  <div className="w-64 shrink-0 h-4 animate-pulse rounded bg-slate-200" />
                  {Array.from({ length: count }).map((_, i) => (
                    <div key={i} className="flex-1 h-4 animate-pulse rounded bg-slate-200" />
                  ))}
                </div>

                {/* Section 1: Overview & Pricing */}
                <div className="bg-slate-100/50 px-4 py-2.5 border-b border-slate-200/80 flex items-center gap-2">
                  <div className="h-3 w-36 animate-pulse rounded bg-slate-300" />
                </div>
                {[1, 2, 3, 4].map(row => (
                  <div key={row} className="p-4 flex gap-4 border-b border-slate-100 items-center">
                    <div className="w-64 shrink-0 h-3.5 animate-pulse rounded bg-slate-200" />
                    {Array.from({ length: count }).map((_, i) => (
                      <div key={i} className="flex-1 h-3.5 animate-pulse rounded bg-slate-100" />
                    ))}
                  </div>
                ))}

                {/* Section 2: Technical Identifiers */}
                <div className="bg-slate-100/50 px-4 py-2.5 border-b border-slate-200/80 flex items-center gap-2">
                  <div className="h-3 w-40 animate-pulse rounded bg-slate-300" />
                </div>
                {[1, 2, 3].map(row => (
                  <div key={row} className="p-4 flex gap-4 border-b border-slate-100 items-center">
                    <div className="w-64 shrink-0 h-3.5 animate-pulse rounded bg-slate-200" />
                    {Array.from({ length: count }).map((_, i) => (
                      <div key={i} className="flex-1 h-3.5 animate-pulse rounded bg-slate-100" />
                    ))}
                  </div>
                ))}

                {/* Section 3: Specifications */}
                <div className="bg-slate-100/50 px-4 py-2.5 border-b border-slate-200/80 flex items-center gap-2">
                  <div className="h-3 w-32 animate-pulse rounded bg-slate-300" />
                </div>
                {[1, 2, 3, 4].map(row => (
                  <div key={row} className="p-4 flex gap-4 border-b border-slate-100 items-center">
                    <div className="w-64 shrink-0 h-3.5 animate-pulse rounded bg-slate-200" />
                    {Array.from({ length: count }).map((_, i) => (
                      <div key={i} className="flex-1 h-3.5 animate-pulse rounded bg-slate-100" />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      <span className="sr-only">Loading comparison data...</span>
    </div>
  );
}
