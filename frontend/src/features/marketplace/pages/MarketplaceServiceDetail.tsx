'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
    ChevronRight, FileText, MapPin, BadgeCheck, Wrench, ArrowLeft,
    ShoppingCart, ShieldCheck, ClipboardList, BookmarkPlus,
    Clock, Check, X, Award, ExternalLink, Sparkles, Share2,
    Eye, Download, Lock, CheckCircle, FileDown, Layers3, Send,
    FileSpreadsheet, FileCode
} from 'lucide-react';
import { useAuth } from '../../../hooks/useAuth';
import { marketplaceApi, type MarketplaceService } from '../api';
import { MarketplaceFooter } from '../components/MarketplaceFooter';
import { toast } from 'sonner';
import { useMarketplaceCart } from '../hooks/useMarketplaceCart';
import { openFileAsset } from '../../../lib/files';
import { getMarketplaceImageCandidates, resolveMarketplaceImage } from '../utils/marketplaceImages';
import { saveSupplier } from '../utils/savedSuppliers';
import { formatCatalogueDate } from '../../catalogue/utils/catalogueDetailUtils';
import { useQuery as useTanstackQuery } from '@tanstack/react-query';

const pricingLabels: Record<string, string> = {
    FIXED: 'Fixed Price',
    HOURLY: 'Per Hour Rate',
    DAILY: 'Per Day Rate',
    MONTHLY: 'Monthly Retainer',
    PER_PROJECT: 'Per Project Basis',
    CUSTOM: 'Quote Based Service',
};

const isImageFile = (file: any) => {
    const mime = String(file?.mimeType || file?.fileAsset?.mimeType || '').toLowerCase();
    const name = String(file?.originalName || file?.name || file?.fileAsset?.originalName || file?.url || '').toLowerCase();
    return mime.startsWith('image/') || /\.(png|jpe?g|webp|gif|svg|avif|bmp)$/i.test(name);
};

const getDocumentIcon = (fileName: string, mimeType?: string) => {
    const name = String(fileName || '').toLowerCase();
    const mime = String(mimeType || '').toLowerCase();
    if (name.endsWith('.pdf') || mime.includes('pdf')) {
        return <FileText className="h-4 w-4 text-red-500 shrink-0" />;
    }
    if (name.endsWith('.xlsx') || name.endsWith('.xls') || name.endsWith('.csv') || mime.includes('spreadsheet') || mime.includes('excel')) {
        return <FileSpreadsheet className="h-4 w-4 text-emerald-600 shrink-0" />;
    }
    if (name.endsWith('.docx') || name.endsWith('.doc') || mime.includes('word') || mime.includes('officedocument')) {
        return <FileText className="h-4 w-4 text-blue-600 shrink-0" />;
    }
    return <FileCode className="h-4 w-4 text-slate-600 shrink-0" />;
};

const parseServiceSpecifications = (service: any): Array<{ name: string; value: string; unit?: string }> => {
    const raw = service?.specifications || service?.specs || service?.attributes || service?.technicalSpecs || service?.parameters;
    if (!raw) return [];
    if (Array.isArray(raw)) {
        return raw.map((item: any) => {
            if (typeof item === 'object' && item !== null) {
                const name = String(item.name || item.key || item.label || item.param || '').trim();
                const value = String(item.value || item.val || '').trim();
                const unit = item.unit ? String(item.unit).trim() : undefined;
                if (name && value) return { name, value, unit };
            }
            return null;
        }).filter(Boolean) as Array<{ name: string; value: string; unit?: string }>;
    }
    if (typeof raw === 'string') {
        try {
            const parsed = JSON.parse(raw);
            return parseServiceSpecifications({ specifications: parsed });
        } catch {
            return [];
        }
    }
    if (typeof raw === 'object' && raw !== null) {
        return Object.entries(raw).map(([name, val]) => {
            if (val === null || val === undefined || val === '') return null;
            return { name: name.trim(), value: String(val).trim() };
        }).filter(Boolean) as Array<{ name: string; value: string; unit?: string }>;
    }
    return [];
};

export default function MarketplaceServiceDetail() {
    const { user } = useAuth();
    const pathname = usePathname() || '';
    const router = useRouter();
    const useDashboardShell = pathname.startsWith('/buyer') || pathname.startsWith('/seller');
    const serviceIdParam = pathname.split('/').pop() || '0';
    const serviceId = isNaN(Number(serviceIdParam)) ? 0 : Number(serviceIdParam);

    const [fullScreenImage, setFullScreenImage] = useState<string | null>(null);
    const [selectedImage, setSelectedImage] = useState(0);
    const [failedImages, setFailedImages] = useState<string[]>([]);

    const { items: cartItems, add: addToCart } = useMarketplaceCart();

    const { data: detailData, isLoading: loading } = useTanstackQuery({
        queryKey: ['marketplaceService', serviceId],
        queryFn: async () => {
            const res = await marketplaceApi.getServiceDetail(serviceId);
            return res as { service: MarketplaceService; relatedServices?: MarketplaceService[] };
        },
        enabled: serviceId > 0,
        staleTime: 5 * 1000,
        refetchOnMount: true,
    });

    const service = (detailData as any)?.service || (detailData as any);
    const related = (detailData as any)?.relatedServices || [];

    const handleShare = () => {
        if (typeof window !== 'undefined') {
            navigator.clipboard.writeText(window.location.href);
            toast.success('Service link copied to clipboard!');
        }
    };

    if (loading) {
        return (
            <div className={useDashboardShell ? "min-h-full bg-slate-50/60" : "min-h-dvh bg-slate-50/60 flex flex-col"}>
                <main className="flex-1 max-w-7xl mx-auto px-4 py-12 w-full">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-pulse">
                        <div className="lg:col-span-5 bg-slate-200 aspect-square rounded-2xl" />
                        <div className="lg:col-span-7 space-y-4">
                            <div className="h-8 bg-slate-200 rounded w-3/4" />
                            <div className="h-4 bg-slate-200 rounded w-1/4" />
                            <div className="h-24 bg-slate-200 rounded" />
                            <div className="h-40 bg-slate-200 rounded" />
                        </div>
                    </div>
                </main>
            </div>
        );
    }

    if (!service || !service.id) {
        return (
            <div className={useDashboardShell ? "min-h-full bg-slate-50" : "min-h-dvh bg-slate-50 flex flex-col"}>
                <main className="flex-1 flex items-center justify-center py-20 px-4">
                    <div className="text-center max-w-md bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
                        <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4 text-slate-400">
                            <Wrench className="h-8 w-8" />
                        </div>
                        <h2 className="text-xl font-bold text-slate-800 mb-2">Service Listing Not Found</h2>
                        <p className="text-xs text-slate-500 mb-6 leading-relaxed">This service listing may have been unlisted, moved, or is temporarily unavailable.</p>
                        <Link href="/marketplace/services" className="inline-flex items-center justify-center gap-2 h-10 px-6 rounded-xl bg-[#0b2447] text-white text-xs font-bold hover:bg-[#12335f] transition shadow-sm">
                            <ArrowLeft className="h-4 w-4" /> Browse Services
                        </Link>
                    </div>
                </main>
                {!useDashboardShell && <MarketplaceFooter />}
            </div>
        );
    }

    const serviceAny = service as any;
    const isVerified = service.organization?.verificationStatus === 'VERIFIED' || serviceAny.sellerVerified || Boolean(service.organization?.id);
    const location = service.organization?.city || service.organization?.district || service.organization?.state || serviceAny.location || (serviceAny.district ? `${serviceAny.district}, ${serviceAny.state || 'ODISHA'}` : undefined);
    const sellerOrgId = service.organization?.id || serviceAny.organizationId;
    const sellerUserId = Number(service.seller?.id || serviceAny.sellerId || 0);
    const sellerDisplayName = service.organization?.organizationName || service.seller?.name || serviceAny.sellerName || serviceAny.vendorName || 'Verified MSME Service Provider';

    const basePrice = Number(service.basePrice || serviceAny.price || 0);
    const originalPrice = serviceAny.originalPrice ? Number(serviceAny.originalPrice) : 0;
    const discountPrice = serviceAny.discountPrice ? Number(serviceAny.discountPrice) : 0;
    const rawDiscountPercent = serviceAny.discountPercent ? Number(serviceAny.discountPercent) : 0;

    const baselinePrice = originalPrice > 0 ? originalPrice : basePrice;
    const effectiveDiscountPrice = discountPrice > 0 ? discountPrice : (rawDiscountPercent > 0 && baselinePrice > 0 ? Math.round(baselinePrice * (1 - rawDiscountPercent / 100) * 100) / 100 : 0);
    const displayPrice = effectiveDiscountPrice > 0 ? effectiveDiscountPrice : basePrice;
    const hasOffer = serviceAny.isOfferActive !== false && (
        (effectiveDiscountPrice > 0 && effectiveDiscountPrice < baselinePrice) ||
        rawDiscountPercent > 0 ||
        Boolean(serviceAny.offerLabel)
    );
    const effectiveDiscountPercent = rawDiscountPercent > 0 ? rawDiscountPercent : (baselinePrice > displayPrice && baselinePrice > 0 ? Math.round(((baselinePrice - displayPrice) / baselinePrice) * 100) : 0);
    const savingsAmount = baselinePrice > displayPrice ? (baselinePrice - displayPrice) : 0;

    const handleSaveSupplier = () => {
        if (!sellerOrgId && !sellerUserId) {
            toast.error('Provider details are not available for this listing.');
            return;
        }
        saveSupplier({
            id: sellerOrgId || sellerUserId,
            sellerUserId: sellerUserId || null,
            name: sellerDisplayName,
            location: [service.organization?.city, service.organization?.district, service.organization?.state].filter(Boolean).join(', ') || location || 'India',
            verificationStatus: service.organization?.verificationStatus || (isVerified ? 'VERIFIED' : 'PENDING'),
            source: service.name,
        });
        toast.success('Service provider added to saved list!');
    };

    // Extract all image candidates
    const imageCandidates = getMarketplaceImageCandidates(service).filter((img) => !failedImages.includes(img));
    const currentImage = imageCandidates[selectedImage] || imageCandidates[0] || resolveMarketplaceImage(service, 'service');

    // Extract all uploaded documents & certifications
    const serviceDocuments = (() => {
        if (!service) return [];
        const docs: any[] = [
            ...(serviceAny.certifications || []),
            ...(serviceAny.documents || []),
            ...(serviceAny.attachments || []),
            ...(serviceAny.files || [])
                .filter((file: any) => !isImageFile(file))
                .map((file: any) => ({
                    id: `file-${file.id || file.fileAssetId}`,
                    name: file.originalName || file.name || 'Service Document',
                    mimeType: file.mimeType || file.fileAsset?.mimeType,
                    verificationStatus: 'UPLOADED',
                    fileAsset: file.fileAsset || file,
                })),
            ...(serviceAny.catalogueFiles || [])
                .filter((file: any) => !isImageFile(file))
                .map((file: any) => ({
                    id: `catalogue-file-${file.id || file.fileAssetId}`,
                    name: file.originalName || file.name || 'Service Brochure / Scope Document',
                    mimeType: file.mimeType || file.fileAsset?.mimeType,
                    verificationStatus: 'UPLOADED',
                    fileAsset: file.fileAsset || file,
                })),
            ...((service?.organization as any)?.certifications || [])
                .map((cert: any) => ({
                    id: `org-cert-${cert.id}`,
                    name: cert.name || cert.title || 'Provider Certification',
                    mimeType: cert.mimeType || cert.fileAsset?.mimeType || 'application/pdf',
                    verificationStatus: cert.verificationStatus || 'VERIFIED',
                    issuingAuthority: cert.issuingAuthority || 'Certified Body',
                    fileAsset: cert.fileAsset || cert,
                })),
        ];

        const seen = new Set<string>();
        return docs.filter((doc: any) => {
            const key = String(doc.id || doc.name || doc.fileAsset?.url || doc.url || '').trim();
            if (!key || seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    })();

    // Parsed structured technical specifications
    const technicalSpecifications = parseServiceSpecifications(serviceAny);

    // Clean Key Highlights (Moglix Style)
    const keyHighlights = [
        { label: 'Pricing Model', value: pricingLabels[service.pricingModel] || service.pricingModel || 'Fixed Rate' },
        service.serviceArea ? { label: 'Service Coverage', value: service.serviceArea } : null,
        serviceAny.duration ? { label: 'Typical Duration', value: serviceAny.duration } : null,
        serviceAny.slaResponseTime ? { label: 'SLA Response', value: serviceAny.slaResponseTime } : null,
        { label: 'Provider Category', value: service.category?.name || 'Professional Services' },
        { label: 'MSME Certified', value: 'Government Verified MSME' },
    ].filter(Boolean) as Array<{ label: string; value: string }>;

    const handleAddToCart = () => {
        if (!user) {
            router.push(`/login?returnUrl=${encodeURIComponent(pathname)}`);
            return;
        }
        addToCart({
            type: 'service',
            id: service.id,
            name: service.name,
            price: displayPrice,
            unit: pricingLabels[service.pricingModel] || 'engagement',
            imageUrl: currentImage || undefined,
            category: service.category?.name,
        });
    };

    const handleRequestQuote = () => {
        if (!user) {
            router.push(`/login?returnUrl=${encodeURIComponent(pathname)}`);
            return;
        }
        router.push(`/buyer/procurement/rfq/new?serviceId=${service.id}`);
    };

    return (
        <div className={useDashboardShell ? "min-h-full bg-slate-50/50" : "min-h-dvh bg-slate-50/50 flex flex-col"}>
            <main className="flex-1 pb-16">
                {/* Modern Breadcrumbs Header */}
                <div className="bg-white border-b border-slate-200/80 sticky top-0 z-10 shadow-2xs">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-1.5 text-slate-500 font-medium overflow-hidden">
                            <Link href="/" className="hover:text-[#0b2447] transition flex items-center gap-1 shrink-0">
                                Home
                            </Link>
                            <ChevronRight className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                            <Link href="/marketplace/services" className="hover:text-[#0b2447] transition shrink-0">
                                Services
                            </Link>
                            {service.category && (
                                <>
                                    <ChevronRight className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                    <Link href={`/marketplace/services?categoryId=${service.category.id}`} className="hover:text-[#0b2447] transition truncate max-w-[150px] shrink-0">
                                        {service.category.name}
                                    </Link>
                                </>
                            )}
                            <ChevronRight className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                            <span title={service.name} className="text-[#0b2447] font-bold truncate max-w-[200px]">{service.name}</span>
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleShare}
                                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border border-slate-200 bg-white text-slate-600 font-semibold text-xs hover:bg-slate-50 hover:text-[#0b2447] transition shadow-2xs cursor-pointer"
                                title="Share service link"
                            >
                                <Share2 className="h-3.5 w-3.5" /> Share
                            </button>
                        </div>
                    </div>
                </div>

                <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-5 pb-20">
                    {/* Top Navigation Strip */}
                    <div className="flex items-center justify-between mb-5">
                        <button
                            onClick={() => window.history.back()}
                            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-[#0b2447] bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-2xs hover:shadow-xs transition cursor-pointer"
                        >
                            <ArrowLeft className="h-3.5 w-3.5" /> Back
                        </button>
                        <div className="flex items-center gap-2">
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <Award className="h-3 w-3" /> Certified MSME Service
                            </span>
                            {isVerified && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200">
                                    <BadgeCheck className="h-3 w-3" /> Verified Provider
                                </span>
                            )}
                        </div>
                    </div>

                    {/* MOGLIX-STYLE 3-COLUMN ENTERPRISE LAYOUT */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                        
                        {/* ========================================================================= */}
                        {/* COLUMN 1 (Left 5 Cols): Image / Visual Showcase & Deliverables Downloads  */}
                        {/* ========================================================================= */}
                        <div className="lg:col-span-5 space-y-4">
                            <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs">
                                <div className="flex flex-col-reverse md:flex-row gap-3">
                                    
                                    {/* Thumbnail Rail */}
                                    {imageCandidates.length > 1 && (
                                        <div className="flex md:flex-col gap-2 overflow-x-auto md:overflow-y-auto max-h-[380px] scrollbar-thin shrink-0">
                                            {imageCandidates.map((img: string, idx: number) => (
                                                <button
                                                    key={`${img}-${idx}`}
                                                    type="button"
                                                    onClick={() => setSelectedImage(idx)}
                                                    className={`relative w-16 h-16 md:w-18 md:h-18 rounded-xl border-2 overflow-hidden shrink-0 bg-slate-50 transition-all cursor-pointer ${idx === selectedImage ? 'border-emerald-600 ring-2 ring-emerald-600/20 shadow-xs scale-102' : 'border-slate-200 hover:border-slate-300 opacity-75 hover:opacity-100'}`}
                                                >
                                                    <img
                                                        src={img}
                                                        alt={`${service.name} thumb ${idx + 1}`}
                                                        className="w-full h-full object-cover"
                                                        onError={(e) => { e.currentTarget.src = resolveMarketplaceImage(service, 'service'); }}
                                                    />
                                                </button>
                                            ))}
                                        </div>
                                    )}

                                    {/* Main Showcase Stage */}
                                    <div className="relative flex-1 aspect-square rounded-xl bg-slate-50/50 border border-slate-100 flex items-center justify-center overflow-hidden group">
                                        {currentImage ? (
                                            <>
                                                <img
                                                    src={currentImage}
                                                    alt={service.name}
                                                    onError={() => setFailedImages((prev) => prev.includes(currentImage) ? prev : [...prev, currentImage])}
                                                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                                                />
                                                <button
                                                    onClick={() => setFullScreenImage(currentImage)}
                                                    className="absolute bottom-3 right-3 p-2 rounded-xl bg-slate-900/70 text-white hover:bg-[#0b2447] backdrop-blur-md opacity-0 group-hover:opacity-100 transition shadow-lg cursor-pointer"
                                                    title="Zoom Fullscreen"
                                                >
                                                    <Eye className="h-4 w-4" />
                                                </button>
                                            </>
                                        ) : (
                                            <div className="flex flex-col items-center justify-center p-8 text-center">
                                                <Wrench className="h-16 w-16 text-slate-300 mb-2" />
                                                <p className="text-xs font-bold text-slate-400">Visual showcase preview</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Service Assurances Strip */}
                            <div className="grid grid-cols-3 gap-2 bg-white rounded-xl border border-slate-200/80 p-3 text-center shadow-2xs">
                                <div>
                                    <ShieldCheck className="h-4.5 w-4.5 text-emerald-600 mx-auto mb-1" />
                                    <p className="text-[10px] font-extrabold text-slate-800">Verified MSME</p>
                                    <p className="text-[8px] font-medium text-slate-400">Legally Audited</p>
                                </div>
                                <div>
                                    <Clock className="h-4.5 w-4.5 text-blue-600 mx-auto mb-1" />
                                    <p className="text-[10px] font-extrabold text-slate-800">SLA Backed</p>
                                    <p className="text-[8px] font-medium text-slate-400">Guaranteed Response</p>
                                </div>
                                <div>
                                    <FileText className="h-4.5 w-4.5 text-indigo-600 mx-auto mb-1" />
                                    <p className="text-[10px] font-extrabold text-slate-800">GST Invoice</p>
                                    <p className="text-[8px] font-medium text-slate-400">Commercial Tax</p>
                                </div>
                            </div>

                            {/* Downloadable Documents / Service Brochures */}
                            {serviceDocuments.length > 0 && (
                                <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs space-y-3">
                                    <div className="flex items-center justify-between">
                                        <h4 className="text-xs font-extrabold text-slate-900 flex items-center gap-1.5">
                                            <FileDown className="h-4 w-4 text-[#0b2447]" /> Service Documents & Brochures
                                        </h4>
                                        <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                                            {serviceDocuments.length}
                                        </span>
                                    </div>
                                    <div className="space-y-2">
                                        {serviceDocuments.map((doc: any) => (
                                            <div
                                                key={doc.id}
                                                className="flex items-center justify-between p-2.5 rounded-lg border border-slate-100 bg-slate-50/70 hover:bg-slate-50 transition"
                                            >
                                                <div className="min-w-0 flex items-center gap-2">
                                                    {getDocumentIcon(doc.name, doc.mimeType)}
                                                    <span title={doc.name} className="text-xs font-bold text-slate-800 truncate max-w-[190px]">
                                                        {doc.name}
                                                    </span>
                                                </div>
                                                {doc.fileAsset && (
                                                    <button
                                                        type="button"
                                                        onClick={() => openFileAsset(doc.fileAsset, doc.name).catch(err => toast.error(err instanceof Error ? err.message : 'Unable to open document'))}
                                                        className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded border border-emerald-200/80 transition cursor-pointer"
                                                    >
                                                        <Download className="h-3 w-3" /> Download
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* ========================================================================= */}
                        {/* COLUMN 2 (Center 4 Cols): Service Details, Scope, Pricing, Highlights     */}
                        {/* ========================================================================= */}
                        <div className="lg:col-span-4 space-y-5">
                            
                            {/* Service Header & Meta */}
                            <div className="space-y-2">
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-[11px] font-black uppercase text-[#0b2447] bg-[#0b2447]/5 border border-[#0b2447]/10 px-2.5 py-0.5 rounded-md">
                                        {pricingLabels[service.pricingModel] || service.pricingModel || 'Fixed Price'}
                                    </span>
                                    {service.category && (
                                        <span className="text-[11px] font-bold text-slate-600 bg-slate-100 border border-slate-200 px-2.5 py-0.5 rounded-md">
                                            {service.category.name}
                                        </span>
                                    )}
                                </div>

                                <h1 className="text-xl sm:text-2xl font-black text-slate-900 leading-snug tracking-tight">
                                    {service.name}
                                </h1>
                            </div>

                            {/* Key Highlights Bullets (Moglix Style) */}
                            {keyHighlights.length > 0 && (
                                <div className="bg-white rounded-xl border border-slate-200/80 p-3.5 shadow-2xs space-y-2">
                                    <h3 className="text-[11px] font-black uppercase tracking-wider text-slate-400">Key Highlights</h3>
                                    <div className="grid grid-cols-2 gap-2 text-xs">
                                        {keyHighlights.map((item) => (
                                            <div key={item.label} className="flex items-start gap-1.5">
                                                <CheckCircle className="h-3.5 w-3.5 text-emerald-600 shrink-0 mt-0.5" />
                                                <div>
                                                    <span className="text-slate-500 font-medium">{item.label}: </span>
                                                    <strong className="text-slate-800 font-bold">{item.value}</strong>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* PROMOTIONAL OFFER & DISCOUNT CARD */}
                            {hasOffer && (
                                <div className="rounded-xl border border-amber-300 bg-gradient-to-r from-amber-50 via-orange-50/50 to-amber-50 p-3.5 shadow-2xs space-y-2">
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-2">
                                            <span className="bg-amber-500 text-white text-[11px] font-black px-2.5 py-0.5 rounded-full shadow-xs flex items-center gap-1">
                                                <Sparkles className="h-3 w-3" />
                                                {serviceAny.offerLabel || 'SPECIAL SERVICE ENGAGEMENT'}
                                            </span>
                                            {effectiveDiscountPercent > 0 && (
                                                <span className="bg-emerald-600 text-white text-[11px] font-black px-2 py-0.5 rounded-full">
                                                    {effectiveDiscountPercent}% OFF
                                                </span>
                                            )}
                                        </div>
                                        {serviceAny.offerEndAt && (
                                            <span className="text-[10px] font-bold text-amber-900 bg-amber-200/70 px-2 py-0.5 rounded-full">
                                                Valid until {formatCatalogueDate(serviceAny.offerEndAt)}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* COMMERCIAL PRICING OR AUTHENTICATION GATEWAY */}
                            {user ? (
                                <div className="bg-gradient-to-br from-blue-50/80 to-indigo-50/80 border border-blue-100 rounded-xl p-4 shadow-2xs space-y-1">
                                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-blue-700">Commercial Price</span>
                                    {displayPrice > 0 ? (
                                        <div>
                                            <div className="flex items-baseline gap-2.5">
                                                <span className="text-3xl font-black text-[#0b2447]">
                                                    ₹{displayPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                                </span>
                                                {hasOffer && baselinePrice > displayPrice && (
                                                    <span className="text-sm font-bold text-slate-400 line-through">
                                                        ₹{baselinePrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                                    </span>
                                                )}
                                                {savingsAmount > 0 && (
                                                    <span className="text-xs font-extrabold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                                                        Save ₹{savingsAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-[11px] font-semibold text-slate-500 mt-1">
                                                Per {pricingLabels[service.pricingModel] || 'engagement'} {service.taxRate ? `• ${service.taxRate}% GST applicable` : '• GST extra'}
                                            </p>
                                        </div>
                                    ) : (
                                        <span className="text-xl font-black text-amber-600">Custom Quote on Scope</span>
                                    )}
                                </div>
                            ) : (
                                <div className="rounded-xl border-2 border-dashed border-blue-300 bg-blue-50/60 p-4 shadow-2xs space-y-2.5">
                                    <div className="flex items-start gap-2.5">
                                        <div className="p-2 rounded-lg bg-[#0b2447] text-white shrink-0 mt-0.5">
                                            <Lock className="h-4 w-4" />
                                        </div>
                                        <div>
                                            <h4 className="text-xs font-black text-slate-900">
                                                B2B Commercial Rates Protected
                                            </h4>
                                            <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
                                                Sign in as a registered enterprise or buyer to access transparent rates, customized quotes, and service contracts.
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 pt-1">
                                        <Link
                                            href={`/login?returnUrl=${encodeURIComponent(pathname)}`}
                                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#0b2447] text-white text-xs font-black hover:bg-[#12335f] transition shadow-xs"
                                        >
                                            Sign In to View Price
                                        </Link>
                                        <Link
                                            href="/register?role=buyer"
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-800 text-xs font-bold hover:bg-slate-50 transition"
                                        >
                                            Register as Buyer
                                        </Link>
                                    </div>
                                </div>
                            )}

                            {/* Service Description */}
                            {service.description && (
                                <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs space-y-1.5">
                                    <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-700">Service Overview</h3>
                                    <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-line">{service.description}</p>
                                </div>
                            )}

                            {/* Scope of Work & Deliverables */}
                            {(serviceAny.scopeOfWork || serviceAny.deliverables) && (
                                <div className="grid grid-cols-1 gap-3">
                                    {serviceAny.scopeOfWork && (
                                        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs space-y-1.5">
                                            <h4 className="text-xs font-black text-[#0b2447] uppercase tracking-wider flex items-center gap-1.5">
                                                <Layers3 className="h-4 w-4 text-blue-600" /> Scope of Work
                                            </h4>
                                            <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-line">{serviceAny.scopeOfWork}</p>
                                        </div>
                                    )}
                                    {serviceAny.deliverables && (
                                        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs space-y-1.5">
                                            <h4 className="text-xs font-black text-[#0b2447] uppercase tracking-wider flex items-center gap-1.5">
                                                <CheckCircle className="h-4 w-4 text-emerald-600" /> Key Deliverables
                                            </h4>
                                            <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-line">{serviceAny.deliverables}</p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Inclusions & Exclusions */}
                            {(serviceAny.inclusions || serviceAny.exclusions) && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {serviceAny.inclusions && (
                                        <div className="bg-emerald-50/50 border border-emerald-200/80 rounded-xl p-3.5 space-y-1">
                                            <h4 className="text-xs font-extrabold text-emerald-900 flex items-center gap-1">
                                                <Check className="h-3.5 w-3.5 text-emerald-600" /> Inclusions
                                            </h4>
                                            <p className="text-xs text-emerald-800 leading-relaxed whitespace-pre-line">{serviceAny.inclusions}</p>
                                        </div>
                                    )}
                                    {serviceAny.exclusions && (
                                        <div className="bg-rose-50/50 border border-rose-200/80 rounded-xl p-3.5 space-y-1">
                                            <h4 className="text-xs font-extrabold text-rose-900 flex items-center gap-1">
                                                <X className="h-3.5 w-3.5 text-rose-600" /> Exclusions
                                            </h4>
                                            <p className="text-xs text-rose-800 leading-relaxed whitespace-pre-line">{serviceAny.exclusions}</p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* CONSOLIDATED TECHNICAL SPECIFICATIONS TABLE (Moglix Standard) */}
                            {technicalSpecifications.length > 0 && (
                                <div className="bg-white rounded-xl border border-slate-200/80 overflow-hidden shadow-2xs space-y-0">
                                    <div className="bg-slate-100/80 border-b border-slate-200 px-4 py-2.5 flex items-center justify-between">
                                        <h3 className="text-xs font-black text-[#0b2447] uppercase tracking-wider flex items-center gap-1.5">
                                            <ClipboardList className="h-4 w-4 text-emerald-600" /> Technical & Service Parameters
                                        </h3>
                                        <span className="text-[10px] font-bold text-slate-500">
                                            {technicalSpecifications.length} Parameters
                                        </span>
                                    </div>

                                    <table className="w-full text-xs">
                                        <tbody className="divide-y divide-slate-100">
                                            {technicalSpecifications.map((spec, idx) => (
                                                <tr key={`${spec.name}-${idx}`} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/20'}>
                                                    <td className="px-4 py-2.5 font-bold text-slate-600 w-1/3 border-r border-slate-100 bg-slate-50/50">{spec.name}</td>
                                                    <td className="px-4 py-2.5 font-bold text-slate-900">{spec.value}{spec.unit ? ` ${spec.unit}` : ''}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>

                        {/* ========================================================================= */}
                        {/* COLUMN 3 (Right 3 Cols): Sticky RFQ Action Box & Verified Provider Info   */}
                        {/* ========================================================================= */}
                        <div className="lg:col-span-3 space-y-4">
                            <div className="sticky top-20 space-y-4">
                                
                                {/* Buy Box Card */}
                                <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-sm space-y-4">
                                    <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                                        <span className="text-xs font-black text-slate-900 uppercase tracking-wider">Service Engagement</span>
                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700">
                                            Active Service
                                        </span>
                                    </div>

                                    {/* Order Pricing Snapshot */}
                                    <div className="space-y-1">
                                        <span className="text-[10px] font-bold uppercase text-slate-400">Rate / Model</span>
                                        {user ? (
                                            displayPrice > 0 ? (
                                                <div>
                                                    <div className="text-2xl font-black text-[#0b2447]">
                                                        ₹{displayPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                                    </div>
                                                    <p className="text-[10px] font-bold text-slate-500">
                                                        Per {pricingLabels[service.pricingModel] || 'engagement'} {service.taxRate ? `| GST ${service.taxRate}% extra` : ''}
                                                    </p>
                                                </div>
                                            ) : (
                                                <p className="text-xs font-bold text-amber-700">Custom Scope Required</p>
                                            )
                                        ) : (
                                            <span className="inline-block text-xs font-bold text-slate-500">
                                                Login to view commercial rates
                                            </span>
                                        )}
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="space-y-2.5 pt-2">
                                        <button
                                            type="button"
                                            onClick={handleRequestQuote}
                                            className="w-full h-11 inline-flex items-center justify-center gap-2 rounded-xl bg-[#0b2447] text-white text-xs font-black hover:bg-[#12335f] shadow-md shadow-[#0b2447]/15 active:scale-[0.98] transition cursor-pointer"
                                        >
                                            <Send className="h-4 w-4" /> Request Formal Quote (RFQ)
                                        </button>

                                        <button
                                            type="button"
                                            onClick={handleAddToCart}
                                            className="w-full h-10 inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white text-slate-800 text-xs font-bold hover:bg-slate-50 transition cursor-pointer"
                                        >
                                            <ShoppingCart className="h-4 w-4 text-[#0b2447]" /> Add to Requirements Cart
                                        </button>
                                    </div>

                                    {/* Utility Actions */}
                                    <div className="pt-2 border-t border-slate-100">
                                        <button
                                            type="button"
                                            onClick={handleSaveSupplier}
                                            className="h-8 w-full inline-flex items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white text-slate-700 text-[11px] font-bold hover:bg-slate-50 transition cursor-pointer"
                                        >
                                            <BookmarkPlus className="h-3.5 w-3.5 text-[#0b2447]" /> Save Provider Profile
                                        </button>
                                    </div>
                                </div>

                                {/* Single Verified Provider Card (Clean, 1 Instance Only) */}
                                <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs space-y-3">
                                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Service Provider</span>
                                    <div className="flex items-start gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-[#0b2447] text-white font-black text-sm flex items-center justify-center shrink-0 shadow-xs">
                                            {(sellerDisplayName || 'M')[0].toUpperCase()}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <h4 title={sellerDisplayName} className="text-xs font-black text-slate-900 truncate">
                                                {sellerDisplayName}
                                            </h4>
                                            {location && (
                                                <p className="text-[11px] font-medium text-slate-500 flex items-center gap-1 mt-0.5 truncate">
                                                    <MapPin className="h-3 w-3 text-slate-400 shrink-0" /> {location}
                                                </p>
                                            )}
                                            {isVerified && (
                                                <span className="inline-flex items-center gap-0.5 text-emerald-700 font-extrabold text-[10px] bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200/80 mt-1">
                                                    <BadgeCheck className="h-3 w-3" /> Verified Provider
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    {sellerOrgId && (
                                        <Link
                                            href={`/marketplace/sellers/${sellerOrgId}`}
                                            className="block text-center text-[11px] font-bold text-[#0b2447] hover:underline bg-slate-50 py-1.5 rounded-lg border border-slate-200/60 transition"
                                        >
                                            Visit Provider Profile →
                                        </Link>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ========================================================================= */}
                    {/* BOTTOM SECTION: Related Services in Category                             */}
                    {/* ========================================================================= */}
                    {related.length > 0 && (
                        <div className="mt-14 pt-8 border-t border-slate-200/80">
                            <h3 className="text-base font-black text-slate-900 mb-4 flex items-center gap-2">
                                <Sparkles className="h-5 w-5 text-amber-500" /> Related Services in {service.category?.name || 'Category'}
                            </h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                {related.map((s: any) => (
                                    <Link
                                        key={s.id}
                                        href={`/marketplace/services/${s.id}`}
                                        className="group bg-white rounded-xl border border-slate-200/80 p-3.5 hover:shadow-md hover:border-slate-300 transition flex flex-col justify-between space-y-3"
                                    >
                                        <div className="space-y-2">
                                            <div className="h-36 bg-slate-50 rounded-lg flex items-center justify-center overflow-hidden relative">
                                                {resolveMarketplaceImage(s, 'service') ? (
                                                    <img
                                                        src={resolveMarketplaceImage(s, 'service')}
                                                        alt={s.name}
                                                        className="w-full h-full object-cover group-hover:scale-105 transition"
                                                        onError={(e) => { e.currentTarget.src = resolveMarketplaceImage({}, 'service'); }}
                                                    />
                                                ) : (
                                                    <Wrench className="h-10 w-10 text-slate-300" />
                                                )}
                                            </div>
                                            <h4 title={s.name} className="text-xs font-black text-slate-900 line-clamp-2 group-hover:text-[#0b2447] transition">{s.name}</h4>
                                            <p title={s.organization?.organizationName || 'Verified Provider'} className="text-[10px] font-semibold text-slate-500 truncate">{s.organization?.organizationName || 'Verified Provider'}</p>
                                        </div>
                                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                                            <div>
                                                {user ? (
                                                    s.basePrice ? (
                                                        <span className="text-xs font-black text-[#0b2447]">
                                                            ₹{Number(s.basePrice).toLocaleString('en-IN', { minimumFractionDigits: 0 })}
                                                        </span>
                                                    ) : (
                                                        <span className="text-[10px] font-bold text-slate-500">Quote</span>
                                                    )
                                                ) : (
                                                    <span className="text-[10px] font-bold text-slate-400">Login for rate</span>
                                                )}
                                            </div>
                                            <span className="text-[10px] font-bold text-[#0b2447] group-hover:underline flex items-center gap-0.5">
                                                View <ChevronRight className="h-3 w-3" />
                                            </span>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </main>

            {/* Lightbox Modal */}
            {fullScreenImage && (
                <div
                    className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 backdrop-blur-sm cursor-pointer"
                    onClick={() => setFullScreenImage(null)}
                >
                    <div className="relative max-w-4xl max-h-[90vh] bg-white rounded-2xl overflow-hidden p-4">
                        <img src={fullScreenImage} alt="Fullscreen Preview" className="w-full h-full object-contain max-h-[80vh]" />
                        <button
                            onClick={() => setFullScreenImage(null)}
                            className="absolute top-3 right-3 bg-slate-900 text-white rounded-full p-2 text-xs font-bold"
                        >
                            ✕ Close
                        </button>
                    </div>
                </div>
            )}

            {!useDashboardShell && <MarketplaceFooter />}
        </div>
    );
}
