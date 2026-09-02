'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
    ChevronRight, ShoppingCart, FileText, MapPin, BadgeCheck, Package,
    ArrowLeft, ShieldCheck, ClipboardList, Tags, BookmarkPlus,
    Share2, Eye, Download, Award, Truck, Sparkles, Lock,
    CheckCircle, FileDown, FileSpreadsheet, FileCode
} from 'lucide-react';
import { useAuth } from '../../../hooks/useAuth';
import { marketplaceApi, type MarketplaceProduct } from '../api';
import { MarketplaceFooter } from '../components/MarketplaceFooter';
import { toast } from 'sonner';
import { useMarketplaceCart } from '../hooks/useMarketplaceCart';
import { openFileAsset } from '../../../lib/files';
import { getMarketplaceImageCandidates, resolveMarketplaceImage } from '../utils/marketplaceImages';
import { CompareToggleButton } from '../components/CompareToggleButton';
import { saveSupplier } from '../utils/savedSuppliers';
import { formatCatalogueDate } from '../../catalogue/utils/catalogueDetailUtils';
import { useQuery as useTanstackQuery } from '@tanstack/react-query';

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

const parseProductSpecifications = (product: any): Array<{ name: string; value: string; unit?: string }> => {
    const raw = product?.specifications || product?.specs || product?.attributes || product?.technicalSpecs || product?.parameters;
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
            return parseProductSpecifications({ specifications: parsed });
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

export default function MarketplaceProductDetail() {
    const { user } = useAuth();
    const pathname = usePathname() || '';
    const router = useRouter();
    const useDashboardShell = pathname.startsWith('/buyer') || pathname.startsWith('/seller');
    const productIdParam = pathname.split('/').pop() || '0';
    const productId = isNaN(Number(productIdParam)) ? 0 : Number(productIdParam);

    const [fullScreenImage, setFullScreenImage] = useState<string | null>(null);
    const [selectedImage, setSelectedImage] = useState(0);
    const [failedImages, setFailedImages] = useState<string[]>([]);
    const [orderQuantity, setOrderQuantity] = useState<number>(1);

    const { items: cartItems, add: addToCart } = useMarketplaceCart();

    const { data: detailData, isLoading: loading } = useTanstackQuery({
        queryKey: ['marketplaceProduct', productId],
        queryFn: async () => {
            const res = await marketplaceApi.getProductDetail(productId);
            return res as { product: MarketplaceProduct; relatedProducts?: MarketplaceProduct[] };
        },
        enabled: productId > 0,
        staleTime: 5 * 1000,
        refetchOnMount: true,
    });

    const product = (detailData as any)?.product || (detailData as any);
    const related = (detailData as any)?.relatedProducts || [];

    const handleShare = () => {
        if (typeof window !== 'undefined') {
            navigator.clipboard.writeText(window.location.href);
            toast.success('Product link copied to clipboard!');
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

    if (!product || !product.id) {
        return (
            <div className={useDashboardShell ? "min-h-full bg-slate-50" : "min-h-dvh bg-slate-50 flex flex-col"}>
                <main className="flex-1 flex items-center justify-center py-20 px-4">
                    <div className="text-center max-w-md bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
                        <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4 text-slate-400">
                            <Package className="h-8 w-8" />
                        </div>
                        <h2 className="text-xl font-bold text-slate-800 mb-2">Product Not Found</h2>
                        <p className="text-xs text-slate-500 mb-6 leading-relaxed">This product listing may have been unlisted, moved, or is temporarily unavailable.</p>
                        <Link href="/marketplace/products" className="inline-flex items-center justify-center gap-2 h-10 px-6 rounded-xl bg-[#0b2447] text-white text-xs font-bold hover:bg-[#12335f] transition shadow-sm">
                            <ArrowLeft className="h-4 w-4" /> Browse Marketplace
                        </Link>
                    </div>
                </main>
                {!useDashboardShell && <MarketplaceFooter />}
            </div>
        );
    }

    const productAny = product as any;
    const isVerified = product.organization?.verificationStatus === 'VERIFIED' || productAny.sellerVerified || Boolean(product.organization?.id);
    const location = product.organization?.city || product.organization?.district || product.organization?.state || productAny.location || (productAny.district ? `${productAny.district}, ${productAny.state || 'ODISHA'}` : undefined);
    const sellerOrgId = product.organization?.id || productAny.organizationId;
    const sellerUserId = Number(product.seller?.id || productAny.sellerId || 0);
    const sellerDisplayName = product.organization?.organizationName || product.seller?.name || productAny.sellerName || productAny.vendorName || 'Verified MSME Supplier';

    const price = productAny.price ? Number(productAny.price) : 0;
    const originalPrice = productAny.originalPrice ? Number(productAny.originalPrice) : 0;
    const discountPrice = productAny.discountPrice ? Number(productAny.discountPrice) : 0;
    const rawDiscountPercent = productAny.discountPercent ? Number(productAny.discountPercent) : 0;

    const baselinePrice = originalPrice > 0 ? originalPrice : price;
    const effectiveDiscountPrice = discountPrice > 0 ? discountPrice : (rawDiscountPercent > 0 && baselinePrice > 0 ? Math.round(baselinePrice * (1 - rawDiscountPercent / 100) * 100) / 100 : 0);
    const displayPrice = effectiveDiscountPrice > 0 ? effectiveDiscountPrice : price;
    const hasOffer = productAny.isOfferActive !== false && (
        (effectiveDiscountPrice > 0 && effectiveDiscountPrice < baselinePrice) ||
        rawDiscountPercent > 0 ||
        Boolean(productAny.offerLabel) ||
        Boolean(productAny.bulkDealAvailable)
    );
    const effectiveDiscountPercent = rawDiscountPercent > 0 ? rawDiscountPercent : (baselinePrice > displayPrice && baselinePrice > 0 ? Math.round(((baselinePrice - displayPrice) / baselinePrice) * 100) : 0);
    const savingsAmount = baselinePrice > displayPrice ? (baselinePrice - displayPrice) : 0;

    const handleSaveSupplier = () => {
        if (!sellerOrgId && !sellerUserId) {
            toast.error('Supplier details are not available for this listing.');
            return;
        }
        saveSupplier({
            id: sellerOrgId || sellerUserId,
            sellerUserId: sellerUserId || null,
            name: sellerDisplayName,
            location: [product.organization?.city, product.organization?.district, product.organization?.state].filter(Boolean).join(', ') || location || 'India',
            verificationStatus: product.organization?.verificationStatus || (isVerified ? 'VERIFIED' : 'PENDING'),
            source: product.name,
        });
        toast.success('Supplier added to saved sellers!');
    };

    // Extract all image candidates
    const imageCandidates = getMarketplaceImageCandidates(product).filter((img) => !failedImages.includes(img));
    const currentImage = imageCandidates[selectedImage] || imageCandidates[0] || resolveMarketplaceImage(product, 'product');

    // Extract all uploaded documents & certifications
    const productDocuments = (() => {
        if (!product) return [];
        const docs: any[] = [
            ...(productAny.certifications || []),
            ...(productAny.documents || []),
            ...(productAny.attachments || []),
            ...(productAny.files || [])
                .filter((file: any) => !isImageFile(file))
                .map((file: any) => ({
                    id: `file-${file.id || file.fileAssetId}`,
                    name: file.originalName || file.name || 'Technical Datasheet / Document',
                    mimeType: file.mimeType || file.fileAsset?.mimeType,
                    verificationStatus: 'UPLOADED',
                    fileAsset: file.fileAsset || file,
                })),
            ...(productAny.catalogueFiles || [])
                .filter((file: any) => !isImageFile(file))
                .map((file: any) => ({
                    id: `catalogue-file-${file.id || file.fileAssetId}`,
                    name: file.originalName || file.name || 'Technical Document / Datasheet',
                    mimeType: file.mimeType || file.fileAsset?.mimeType,
                    verificationStatus: 'UPLOADED',
                    fileAsset: file.fileAsset || file,
                })),
            ...((product?.organization as any)?.certifications || [])
                .map((cert: any) => ({
                    id: `org-cert-${cert.id}`,
                    name: cert.name || cert.title || 'Seller Compliance Certificate',
                    mimeType: cert.mimeType || cert.fileAsset?.mimeType || 'application/pdf',
                    verificationStatus: cert.verificationStatus || 'VERIFIED',
                    issuingAuthority: cert.issuingAuthority || 'Certified Authority',
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
    const technicalSpecifications = parseProductSpecifications(productAny);

    // Clean Key Highlights (Moglix Style)
    // const keyHighlights = [
    //     productAny.brand ? { label: 'Brand', value: productAny.brand } : null,
    //     productAny.modelNumber ? { label: 'Model', value: productAny.modelNumber } : null,
    //     productAny.sku ? { label: 'SKU', value: productAny.sku } : null,
    //     product.unitOfMeasure ? { label: 'Unit', value: product.unitOfMeasure } : null,
    //     productAny.hsnCode ? { label: 'HSN Code', value: productAny.hsnCode } : null,
    //     productAny.itemCondition ? { label: 'Condition', value: String(productAny.itemCondition).replace(/_/g, ' ') } : null,
    //     productAny.isMsmeMade ? { label: 'MSME Certified', value: 'Yes (Government Certified)' } : null,
    // ].filter(Boolean) as Array<{ label: string; value: string }>;

    const handleAddToCart = () => {
        if (!user) {
            router.push(`/login?returnUrl=${encodeURIComponent(pathname)}`);
            return;
        }
        addToCart({
            type: 'product',
            id: product.id,
            name: product.name,
            price: displayPrice,
            unit: product.unitOfMeasure || 'unit',
            imageUrl: currentImage || undefined,
            category: product.category?.name,
        });
    };

    const handleRequestQuote = () => {
        if (!user) {
            router.push(`/login?returnUrl=${encodeURIComponent(pathname)}`);
            return;
        }
        router.push(`/buyer/procurement/rfq/new?productId=${product.id}`);
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
                            <Link href="/marketplace/products" className="hover:text-[#0b2447] transition shrink-0">
                                Products
                            </Link>
                            {product.category && (
                                <>
                                    <ChevronRight className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                    <Link href={`/marketplace/products?categoryId=${product.category.id}`} className="hover:text-[#0b2447] transition truncate max-w-[150px] shrink-0">
                                        {product.category.name}
                                    </Link>
                                </>
                            )}
                            {productAny.brand && (
                                <>
                                    <ChevronRight className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                    <span className="text-slate-600 font-semibold truncate max-w-[120px]">{productAny.brand}</span>
                                </>
                            )}
                            <ChevronRight className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                            <span title={product.name} className="text-[#0b2447] font-bold truncate max-w-[200px]">{product.name}</span>
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleShare}
                                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border border-slate-200 bg-white text-slate-600 font-semibold text-xs hover:bg-slate-50 hover:text-[#0b2447] transition shadow-2xs cursor-pointer"
                                title="Share product link"
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
                            {productAny.isMsmeMade && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    <Award className="h-3 w-3" /> Certified MSME
                                </span>
                            )}
                            {isVerified && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200">
                                    <BadgeCheck className="h-3 w-3" /> Verified Supplier
                                </span>
                            )}
                        </div>
                    </div>

                    {/* MOGLIX-STYLE 3-COLUMN ENTERPRISE LAYOUT */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                        
                        {/* ========================================================================= */}
                        {/* COLUMN 1 (Left 5 Cols): Image Gallery & Technical Downloads              */}
                        {/* ========================================================================= */}
                        <div className="lg:col-span-5 space-y-4">
                            <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs">
                                <div className="flex flex-col-reverse md:flex-row gap-3">
                                    
                                    {/* Vertical Thumbnail Rail */}
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
                                                        alt={`${product.name} thumb ${idx + 1}`}
                                                        className="w-full h-full object-contain p-1"
                                                        onError={(e) => { e.currentTarget.src = resolveMarketplaceImage(product, 'product'); }}
                                                    />
                                                    {idx === 0 && (
                                                        <span className="absolute bottom-0 inset-x-0 bg-emerald-600 text-[7px] font-black text-white text-center py-0.2 uppercase">
                                                            Cover
                                                        </span>
                                                    )}
                                                </button>
                                            ))}
                                        </div>
                                    )}

                                    {/* Main Image Stage */}
                                    <div className="relative flex-1 aspect-square rounded-xl bg-slate-50/50 border border-slate-100 flex items-center justify-center overflow-hidden group">
                                        {currentImage ? (
                                            <>
                                                <img
                                                    src={currentImage}
                                                    alt={product.name}
                                                    onError={() => setFailedImages((prev) => prev.includes(currentImage) ? prev : [...prev, currentImage])}
                                                    className="w-full h-full object-contain p-4 transition-transform duration-300 group-hover:scale-105"
                                                />
                                                <button
                                                    onClick={() => setFullScreenImage(currentImage)}
                                                    className="absolute bottom-3 right-3 p-2 rounded-xl bg-slate-900/70 text-white hover:bg-[#0b2447] backdrop-blur-md opacity-0 group-hover:opacity-100 transition shadow-lg cursor-pointer"
                                                    title="Zoom Fullscreen"
                                                >
                                                    <Eye className="h-4 w-4" />
                                                </button>
                                                {selectedImage === 0 && (
                                                    <div className="absolute top-3 left-3 bg-emerald-600 text-white text-[9px] font-black uppercase px-2 py-0.5 rounded shadow-xs flex items-center gap-1">
                                                        ★ Primary Photo
                                                    </div>
                                                )}
                                            </>
                                        ) : (
                                            <div className="flex flex-col items-center justify-center p-8 text-center">
                                                <Package className="h-16 w-16 text-slate-300 mb-2" />
                                                <p className="text-xs font-bold text-slate-400">Preview not available</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Sourcing Assurances Strip (Clean, 1 Single Instance Under Gallery) */}
                            <div className="grid grid-cols-3 gap-2 bg-white rounded-xl border border-slate-200/80 p-3 text-center shadow-2xs">
                                <div>
                                    <ShieldCheck className="h-4.5 w-4.5 text-emerald-600 mx-auto mb-1" />
                                    <p className="text-[10px] font-extrabold text-slate-800">100% Genuine</p>
                                    <p className="text-[8px] font-medium text-slate-400">Verified MSME</p>
                                </div>
                                <div>
                                    <Truck className="h-4.5 w-4.5 text-blue-600 mx-auto mb-1" />
                                    <p className="text-[10px] font-extrabold text-slate-800">Direct Sourcing</p>
                                    <p className="text-[8px] font-medium text-slate-400">Factory Dispatch</p>
                                </div>
                                <div>
                                    <FileText className="h-4.5 w-4.5 text-indigo-600 mx-auto mb-1" />
                                    <p className="text-[10px] font-extrabold text-slate-800">GST Invoiced</p>
                                    <p className="text-[8px] font-medium text-slate-400">Full Input Tax</p>
                                </div>
                            </div>

                            {/* Downloadable Documents / Datasheets */}
                            {productDocuments.length > 0 && (
                                <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs space-y-3">
                                    <div className="flex items-center justify-between">
                                        <h4 className="text-xs font-extrabold text-slate-900 flex items-center gap-1.5">
                                            <FileDown className="h-4 w-4 text-[#0b2447]" /> Documents & Technical Datasheets
                                        </h4>
                                        <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                                            {productDocuments.length}
                                        </span>
                                    </div>
                                    <div className="space-y-2">
                                        {productDocuments.map((doc: any) => (
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
                        {/* COLUMN 2 (Center 4 Cols): Product Specs, Title, Offer, Highlights         */}
                        {/* ========================================================================= */}
                        <div className="lg:col-span-4 space-y-5">
                            
                            {/* Product Header & Meta */}
                            <div className="space-y-2">
                                <div className="flex flex-wrap items-center gap-2">
                                    {productAny.brand && (
                                        <span className="text-[11px] font-black uppercase text-[#0b2447] bg-[#0b2447]/5 border border-[#0b2447]/10 px-2.5 py-0.5 rounded-md">
                                            {productAny.brand}
                                        </span>
                                    )}
                                    {product.category && (
                                        <span className="text-[11px] font-bold text-slate-600 bg-slate-100 border border-slate-200 px-2.5 py-0.5 rounded-md">
                                            {product.category.name}
                                        </span>
                                    )}
                                </div>

                                <h1 className="text-xl sm:text-2xl font-black text-slate-900 leading-snug tracking-tight">
                                    {product.name}
                                </h1>
                            </div>

                            {/* Key Highlights Bullets (Moglix Style) */}
                            {/* {keyHighlights.length > 0 && (
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
                            )} */}

                            {/* PROMOTIONAL OFFER & DISCOUNT CARD */}
                            {hasOffer && (
                                <div className="rounded-xl border border-amber-300 bg-gradient-to-r from-amber-50 via-orange-50/50 to-amber-50 p-3.5 shadow-2xs space-y-2">
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-2">
                                            <span className="bg-amber-500 text-white text-[11px] font-black px-2.5 py-0.5 rounded-full shadow-xs flex items-center gap-1">
                                                <Sparkles className="h-3 w-3" />
                                                {productAny.offerLabel || 'SPECIAL PROMOTIONAL DEAL'}
                                            </span>
                                            {effectiveDiscountPercent > 0 && (
                                                <span className="bg-emerald-600 text-white text-[11px] font-black px-2 py-0.5 rounded-full">
                                                    {effectiveDiscountPercent}% OFF
                                                </span>
                                            )}
                                        </div>
                                        {productAny.offerEndAt && (
                                            <span className="text-[10px] font-bold text-amber-900 bg-amber-200/70 px-2 py-0.5 rounded-full">
                                                Ends {formatCatalogueDate(productAny.offerEndAt)}
                                            </span>
                                        )}
                                    </div>

                                    {productAny.bulkDealAvailable && (
                                        <div className="text-[11px] font-bold text-amber-900 bg-amber-100/70 p-2 rounded-lg border border-amber-200 flex items-center gap-1.5">
                                            <Package className="h-3.5 w-3.5 text-amber-700 shrink-0" />
                                            <span>
                                                Bulk MOQ: Order <strong>{productAny.bulkMinQuantity || '10'}+ {product.unitOfMeasure || 'units'}</strong> for special volume discount.
                                            </span>
                                        </div>
                                    )}
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
                                                Per {product.unitOfMeasure || 'unit'} {product.taxRate ? `• ${product.taxRate}% GST applicable` : '• GST extra'}
                                            </p>
                                        </div>
                                    ) : (
                                        <span className="text-xl font-black text-amber-600">Quote Required</span>
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
                                                Wholesale B2B Pricing Protected
                                            </h4>
                                            <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
                                                Sign in as a registered enterprise or MSME buyer to access transparent wholesale rates and GST schedules.
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

                            {/* Product Description */}
                            {product.description && (
                                <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs space-y-1.5">
                                    <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-700">Product Description</h3>
                                    <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-line">{product.description}</p>
                                </div>
                            )}

                            {/* CONSOLIDATED TECHNICAL SPECIFICATIONS TABLE (Moglix Standard) */}
                            <div className="bg-white rounded-xl border border-slate-200/80 overflow-hidden shadow-2xs space-y-0">
                                <div className="bg-slate-100/80 border-b border-slate-200 px-4 py-2.5 flex items-center justify-between">
                                    <h3 className="text-xs font-black text-[#0b2447] uppercase tracking-wider flex items-center gap-1.5">
                                        <ClipboardList className="h-4 w-4 text-emerald-600" /> Technical Specifications
                                    </h3>
                                    <span className="text-[10px] font-bold text-slate-500">
                                        {technicalSpecifications.length} Specifications
                                    </span>
                                </div>

                                <table className="w-full text-xs">
                                    <tbody className="divide-y divide-slate-100">
                                        {/* Standard Identifiers */}
                                        {productAny.brand && (
                                            <tr className="bg-white">
                                                <td className="px-4 py-2.5 font-bold text-slate-600 w-1/3 border-r border-slate-100 bg-slate-50/50">Brand</td>
                                                <td className="px-4 py-2.5 font-bold text-slate-900">{productAny.brand}</td>
                                            </tr>
                                        )}
                                        {productAny.modelNumber && (
                                            <tr className="bg-slate-50/20">
                                                <td className="px-4 py-2.5 font-bold text-slate-600 w-1/3 border-r border-slate-100 bg-slate-50/50">Model Reference</td>
                                                <td className="px-4 py-2.5 font-bold text-slate-900">{productAny.modelNumber}</td>
                                            </tr>
                                        )}
                                        {productAny.sku && (
                                            <tr className="bg-white">
                                                <td className="px-4 py-2.5 font-bold text-slate-600 w-1/3 border-r border-slate-100 bg-slate-50/50">Item SKU</td>
                                                <td className="px-4 py-2.5 font-bold text-slate-900 font-mono">{productAny.sku}</td>
                                            </tr>
                                        )}
                                        {productAny.hsnCode && (
                                            <tr className="bg-slate-50/20">
                                                <td className="px-4 py-2.5 font-bold text-slate-600 w-1/3 border-r border-slate-100 bg-slate-50/50">HSN Code</td>
                                                <td className="px-4 py-2.5 font-bold text-slate-900 font-mono">{productAny.hsnCode}</td>
                                            </tr>
                                        )}
                                        {product.unitOfMeasure && (
                                            <tr className="bg-white">
                                                <td className="px-4 py-2.5 font-bold text-slate-600 w-1/3 border-r border-slate-100 bg-slate-50/50">Unit of Measure</td>
                                                <td className="px-4 py-2.5 font-bold text-slate-900">{product.unitOfMeasure}</td>
                                            </tr>
                                        )}
                                        {productAny.itemCondition && (
                                            <tr className="bg-slate-50/20">
                                                <td className="px-4 py-2.5 font-bold text-slate-600 w-1/3 border-r border-slate-100 bg-slate-50/50">Item Condition</td>
                                                <td className="px-4 py-2.5 font-bold text-slate-900">{String(productAny.itemCondition).replace(/_/g, ' ')}</td>
                                            </tr>
                                        )}

                                        {/* Dynamic Key-Value Specifications */}
                                        {technicalSpecifications.map((spec, idx) => (
                                            <tr key={`${spec.name}-${idx}`} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/20'}>
                                                <td className="px-4 py-2.5 font-bold text-slate-600 w-1/3 border-r border-slate-100 bg-slate-50/50">{spec.name}</td>
                                                <td className="px-4 py-2.5 font-bold text-slate-900">{spec.value}{spec.unit ? ` ${spec.unit}` : ''}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* ========================================================================= */}
                        {/* COLUMN 3 (Right 3 Cols): Sticky Buy Box & Verified Seller Info           */}
                        {/* ========================================================================= */}
                        <div className="lg:col-span-3 space-y-4">
                            <div className="sticky top-20 space-y-4">
                                
                                {/* Buy Box Card */}
                                <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-sm space-y-4">
                                    <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                                        <span className="text-xs font-black text-slate-900 uppercase tracking-wider">Procurement Action</span>
                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700">
                                            Active Listing
                                        </span>
                                    </div>

                                    {/* Order Pricing Snapshot */}
                                    <div className="space-y-1">
                                        <span className="text-[10px] font-bold uppercase text-slate-400">Order Unit Price</span>
                                        {user ? (
                                            displayPrice > 0 ? (
                                                <div>
                                                    <div className="text-2xl font-black text-[#0b2447]">
                                                        ₹{displayPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                                    </div>
                                                    <p className="text-[10px] font-bold text-slate-500">
                                                        Per {product.unitOfMeasure || 'unit'} {product.taxRate ? `| GST ${product.taxRate}% extra` : ''}
                                                    </p>
                                                </div>
                                            ) : (
                                                <p className="text-xs font-bold text-amber-700">Quote Required</p>
                                            )
                                        ) : (
                                            <span className="inline-block text-xs font-bold text-slate-500">
                                                Login to view pricing
                                            </span>
                                        )}
                                    </div>

                                    {/* Quantity Selector */}
                                    {user && (
                                        <div className="space-y-1.5 pt-1">
                                            <label className="text-[11px] font-bold text-slate-700 block">Quantity ({product.unitOfMeasure || 'units'})</label>
                                            <div className="flex items-center rounded-xl border border-slate-200 overflow-hidden bg-white">
                                                <button
                                                    type="button"
                                                    disabled={orderQuantity <= 1}
                                                    onClick={() => setOrderQuantity(q => Math.max(1, q - 1))}
                                                    className="w-10 h-9 flex items-center justify-center bg-slate-50 hover:bg-slate-100 text-slate-700 font-black text-sm disabled:opacity-30 cursor-pointer"
                                                >
                                                    −
                                                </button>
                                                <input
                                                    type="number"
                                                    min={1}
                                                    value={orderQuantity}
                                                    onChange={(e) => setOrderQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                                                    className="w-full text-center text-xs font-black text-[#0b2447] focus:outline-hidden"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setOrderQuantity(q => q + 1)}
                                                    className="w-10 h-9 flex items-center justify-center bg-slate-50 hover:bg-slate-100 text-slate-700 font-black text-sm cursor-pointer"
                                                >
                                                    +
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {/* Action Buttons */}
                                    <div className="space-y-2.5 pt-2">
                                        <button
                                            type="button"
                                            onClick={handleAddToCart}
                                            className="w-full h-11 inline-flex items-center justify-center gap-2 rounded-xl bg-[#0b2447] text-white text-xs font-black hover:bg-[#12335f] shadow-md shadow-[#0b2447]/15 active:scale-[0.98] transition cursor-pointer"
                                        >
                                            <ShoppingCart className="h-4 w-4" />
                                            {user ? `Add to Cart • ₹${(displayPrice * orderQuantity).toLocaleString('en-IN', { minimumFractionDigits: 0 })}` : 'Sign In to Order'}
                                        </button>

                                        <button
                                            type="button"
                                            onClick={handleRequestQuote}
                                            className="w-full h-10 inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white text-slate-800 text-xs font-bold hover:bg-slate-50 transition cursor-pointer"
                                        >
                                            <FileText className="h-4 w-4 text-[#0b2447]" /> Request Formal RFQ
                                        </button>
                                    </div>

                                    {/* Utility Actions */}
                                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
                                        <CompareToggleButton
                                            item={{ type: 'product', id: product.id, categoryId: product.category?.id }}
                                            className="h-8 w-full rounded-lg border-slate-200 text-slate-700 text-[11px] font-bold"
                                        />
                                        <button
                                            type="button"
                                            onClick={handleSaveSupplier}
                                            className="h-8 w-full inline-flex items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white text-slate-700 text-[11px] font-bold hover:bg-slate-50 transition cursor-pointer"
                                        >
                                            <BookmarkPlus className="h-3.5 w-3.5 text-[#0b2447]" /> Save Seller
                                        </button>
                                    </div>
                                </div>

                                {/* Single Verified Seller Card (Clean, 1 Instance Only) */}
                                <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs space-y-3">
                                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Sold By Supplier</span>
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
                                                    <BadgeCheck className="h-3 w-3" /> Verified MSME
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    {sellerOrgId && (
                                        <Link
                                            href={`/marketplace/sellers/${sellerOrgId}`}
                                            className="block text-center text-[11px] font-bold text-[#0b2447] hover:underline bg-slate-50 py-1.5 rounded-lg border border-slate-200/60 transition"
                                        >
                                            Visit Supplier Storefront →
                                        </Link>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ========================================================================= */}
                    {/* BOTTOM SECTION: Similar Products in Category                              */}
                    {/* ========================================================================= */}
                    {related.length > 0 && (
                        <div className="mt-14 pt-8 border-t border-slate-200/80">
                            <h3 className="text-base font-black text-slate-900 mb-4 flex items-center gap-2">
                                <Sparkles className="h-5 w-5 text-amber-500" /> Similar Products in {product.category?.name || 'Category'}
                            </h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                {related.map((p: any) => (
                                    <Link
                                        key={p.id}
                                        href={`/marketplace/products/${p.id}`}
                                        className="group bg-white rounded-xl border border-slate-200/80 p-3.5 hover:shadow-md hover:border-slate-300 transition flex flex-col justify-between space-y-3"
                                    >
                                        <div className="space-y-2">
                                            <div className="h-36 bg-slate-50 rounded-lg flex items-center justify-center overflow-hidden relative">
                                                {resolveMarketplaceImage(p, 'product') ? (
                                                    <img
                                                        src={resolveMarketplaceImage(p, 'product')}
                                                        alt={p.name}
                                                        className="w-full h-full object-contain p-2 group-hover:scale-105 transition"
                                                        onError={(e) => { e.currentTarget.src = resolveMarketplaceImage({}, 'product'); }}
                                                    />
                                                ) : (
                                                    <Package className="h-10 w-10 text-slate-300" />
                                                )}
                                            </div>
                                            <h4 title={p.name} className="text-xs font-black text-slate-900 line-clamp-2 group-hover:text-[#0b2447] transition">{p.name}</h4>
                                            <p title={p.organization?.organizationName || 'Verified Supplier'} className="text-[10px] font-semibold text-slate-500 truncate">{p.organization?.organizationName || 'Verified Supplier'}</p>
                                        </div>
                                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                                            <div>
                                                {user ? (
                                                    p.price ? (
                                                        <span className="text-xs font-black text-[#0b2447]">
                                                            ₹{Number(p.price).toLocaleString('en-IN', { minimumFractionDigits: 0 })}
                                                        </span>
                                                    ) : (
                                                        <span className="text-[10px] font-bold text-slate-500">Quote</span>
                                                    )
                                                ) : (
                                                    <span className="text-[10px] font-bold text-slate-400">Login for price</span>
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
