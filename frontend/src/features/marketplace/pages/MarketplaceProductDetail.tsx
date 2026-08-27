'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
    ChevronRight, ShoppingCart, FileText, MapPin, BadgeCheck, Package,
    ArrowLeft, Building2, ShieldCheck, ClipboardList, Tags, BookmarkPlus,
    Check, Share2, Eye, Download, Info, CheckCircle2, Award, Zap, Scale,
    Truck, Sparkles, Layers, Layers3, ExternalLink, HelpCircle
} from 'lucide-react';
import { useAuth } from '../../../hooks/useAuth';
import { marketplaceApi, type MarketplaceProduct } from '../api';
import { MarketplaceHeader } from '../components/MarketplaceHeader';
import { MarketplaceFooter } from '../components/MarketplaceFooter';
import { toast } from 'sonner';
import { useMarketplaceCart } from '../hooks/useMarketplaceCart';
import { useQueryClient } from '@tanstack/react-query';
import { api, unwrapApiData } from '../../../lib/api';
import { openFileAsset } from '../../../lib/files';
import { getMarketplaceImageCandidates, resolveMarketplaceImage, buildProductFallbackImage } from '../utils/marketplaceImages';
import { CompareToggleButton } from '../components/CompareToggleButton';
import { saveSupplier } from '../utils/savedSuppliers';
import { buildProductDetailFields, formatCatalogueDate } from '../../catalogue/utils/catalogueDetailUtils';
import { useQuery as useTanstackQuery } from '@tanstack/react-query';
import { ProductCartLoader } from '../../../components/loaders/ProductCartLoader';

const isImageFile = (file: any) => String(file?.mimeType || '').toLowerCase().startsWith('image/');

export default function MarketplaceProductDetail() {
    const { user } = useAuth();
    const pathname = usePathname() || '';
    const router = useRouter();
    const queryClient = useQueryClient();
    const useDashboardShell = pathname.startsWith('/buyer') || pathname.startsWith('/seller');
    const productIdParam = pathname.split('/').pop() || '0';
    const productId = isNaN(Number(productIdParam)) ? 0 : Number(productIdParam);

    const [activeTab, setActiveTab] = useState<'overview' | 'specs' | 'compliance'>('overview');
    const [fullScreenImage, setFullScreenImage] = useState<string | null>(null);

    const { data: detailData, isLoading: loading } = useTanstackQuery({
        queryKey: ['marketplaceProduct', productId],
        enabled: productId > 0,
        staleTime: 5 * 60 * 1000,
        initialData: () => {
            const cachedDetail = queryClient.getQueryData<any>(['marketplaceProduct', productId]);
            if (cachedDetail) return cachedDetail;

            const peeked = api.peek(`/api/marketplace/products/${productId}`);
            if (peeked) return unwrapApiData(peeked);

            const cacheState = queryClient.getQueryCache().getAll();
            for (const query of cacheState) {
                const data = query.state.data as any;
                if (data?.featuredProducts) {
                    const found = data.featuredProducts.find((p: any) => p.id === productId);
                    if (found) return { product: found, relatedProducts: [] };
                }
                if (data?.products) {
                    const found = data.products.find((p: any) => p.id === productId);
                    if (found) return { product: found, relatedProducts: [] };
                }
                if (data?.records) {
                    const found = data.records.find((p: any) => p.id === productId);
                    if (found) return { product: found, relatedProducts: [] };
                }
            }
            return undefined;
        },
        queryFn: async () => {
            if (!productId) return undefined;
            const res = await marketplaceApi.getProductDetail(productId);
            if (res.product) return res;
            try {
                const legacyRes = await api.get(`/api/marketplace/products/${productId}`);
                const data = unwrapApiData(legacyRes);
                if (data?.product) return { product: data.product, relatedProducts: data.relatedProducts || [] };
                if (data?.id) return { product: data, relatedProducts: [] };
            } catch {
                // Ignore fallback error
            }
            try {
                const catalogueRes = await api.get('/api/catalogue');
                const data = unwrapApiData(catalogueRes);
                if (data?.records && Array.isArray(data.records)) {
                    const found = data.records.find((p: any) => p.id === productId);
                    if (found) return { product: found, relatedProducts: [] };
                }
            } catch {
                // Ignore
            }
            return undefined;
        },
    });

    const product = detailData?.product;
    const related = detailData?.relatedProducts || [];

    const { add: addCartItem, update: updateCartQty, getQuantity } = useMarketplaceCart();

    const [prevProductId, setPrevProductId] = useState(productId);
    const [selectedImage, setSelectedImage] = useState(0);
    const [failedImages, setFailedImages] = useState<string[]>([]);

    if (productId !== prevProductId) {
        setPrevProductId(productId);
        setSelectedImage(0);
        setFailedImages([]);
    }

    const cartQuantity = getQuantity(productId, 'product');

    const handleAddToCart = () => {
        if (!user) {
            router.push(`/login?returnUrl=${encodeURIComponent(pathname)}`);
            return;
        }
        if (cartQuantity === 0 && product) {
            const img = resolveMarketplaceImage(product, 'product');
            addCartItem(
                {
                    id: product.id,
                    name: product.name,
                    price: product.price ? Number(product.price) : undefined,
                    unit: product.unitOfMeasure,
                    imageUrl: img,
                    category: product.category?.name,
                    type: 'product',
                },
                { source: 'product-detail' }
            );
            toast.success(`${product.name} added to cart!`);
        }
    };

    const handleQuantityChange = (delta: number) => {
        const newQuantity = Math.max(0, cartQuantity + delta);
        updateCartQty(productId, 'product', newQuantity);
    };

    const handleRequestQuote = () => {
        if (!product) return;
        if (!user) {
            toast.info('Login is required to send a quote request.', {
                action: { label: 'Login', onClick: () => router.push(`/login?redirect=${encodeURIComponent(pathname)}`) },
            });
            return;
        }
        if (user.role !== 'buyer') {
            toast.info('Quote requests are available from buyer accounts.');
            return;
        }
        const sellerUserId = Number((product as any).seller?.id || (product as any).sellerId || 0);
        if (!sellerUserId) {
            toast.info('Seller contact details are unavailable for this product.');
            return;
        }
        const params = new URLSearchParams({
            intent: 'quote',
            sellerId: String(sellerUserId),
            productId: String(product.id || ''),
            productName: product.name || '',
            price: String(product.price || ''),
            subject: `Quote Request: ${product.name}`,
            message: `Hello, I would like to request a formal quotation for ${product.name}.\n\nCategory: ${product.category?.name || 'General'}\nBase Unit Price: ₹${Number(product.price || 0).toLocaleString('en-IN')}\nQuantity: Please confirm minimum order quantity and best pricing for volume orders.\nDelivery: Please provide delivery timeline to our destination and payment terms.`
        });
        router.push(`/buyer/messages?${params.toString()}`);
    };

    const handleShare = () => {
        if (navigator.share) {
            navigator.share({
                title: product?.name || 'Product Detail',
                url: window.location.href,
            }).catch(() => { });
        } else {
            navigator.clipboard.writeText(window.location.href);
            toast.success('Product link copied to clipboard!');
        }
    };

    if (loading) {
        return (
            <div className={useDashboardShell ? "min-h-full bg-slate-50 p-6 max-w-7xl mx-auto flex items-center justify-center min-h-[60vh]" : "min-h-dvh bg-slate-50 flex flex-col p-6 max-w-7xl mx-auto items-center justify-center min-h-[60vh]"}>
                <ProductCartLoader />
            </div>
        );
    }

    if (!product) {
        return (
            <div className={useDashboardShell ? "min-h-full bg-slate-50" : "min-h-dvh bg-slate-50 flex flex-col"}>
                <main className="flex-1 flex items-center justify-center py-20 px-4">
                    <div className="text-center max-w-md bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
                        <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4 text-slate-400">
                            <Package className="h-8 w-8" />
                        </div>
                        <h2 className="text-xl font-bold text-slate-800 mb-2">Product Listing Not Found</h2>
                        <p className="text-xs text-slate-500 mb-6 leading-relaxed">This product listing may have been unlisted, relocated, or is temporarily unavailable on the marketplace.</p>
                        <Link href="/marketplace/products" className="inline-flex items-center justify-center gap-2 h-10 px-6 rounded-xl bg-[#0b2447] text-white text-xs font-bold hover:bg-[#12335f] transition shadow-sm">
                            <ArrowLeft className="h-4 w-4" /> Browse All Products
                        </Link>
                    </div>
                </main>
                {!useDashboardShell && <MarketplaceFooter />}
            </div>
        );
    }

    const imageCandidates = getMarketplaceImageCandidates(product).filter((image) => !failedImages.includes(image));
    const fallbackProductImage = buildProductFallbackImage(product);
    const currentImage = imageCandidates[selectedImage] || imageCandidates[0] || fallbackProductImage;
    const isVerified = product.organization?.verificationStatus === 'VERIFIED';
    const location = product.organization?.city || product.organization?.district || product.organization?.state;
    const productAny = product as any;

    const price = productAny.price ? Number(productAny.price) : 0;
    const discountPrice = productAny.discountPrice ? Number(productAny.discountPrice) : 0;
    const hasOffer = productAny.isOfferActive !== false && price > 0 && discountPrice > 0 && discountPrice < price;
    const displayPrice = hasOffer ? discountPrice : price;
    const discountPercent = hasOffer ? Math.round(((price - displayPrice) / price) * 100) : 0;

    const handleSaveSupplier = () => {
        if (!product.organization?.id) {
            toast.error('Supplier details are not available for this listing.');
            return;
        }
        saveSupplier({
            id: product.organization.id,
            sellerUserId: product.seller?.id || null,
            name: product.organization.organizationName || product.seller?.name || 'Verified supplier',
            location: [product.organization.city, product.organization.district, product.organization.state].filter(Boolean).join(', '),
            verificationStatus: product.organization.verificationStatus,
            source: product.name,
        });
        toast.success('Supplier added to saved sellers!');
    };

    const productDocuments = (() => {
        if (!product) return [];
        const docs: any[] = [
            ...(productAny.certifications || []),
            ...(productAny.documents || []),
            ...(productAny.attachments || []),
            ...(productAny.files || [])
                .filter((file: any) => !isImageFile(file))
                .map((file: any) => ({
                    id: `file-${file.id}`,
                    name: file.originalName || file.name || 'Product Document',
                    verificationStatus: 'UPLOADED',
                    fileAsset: file,
                })),
            ...(productAny.catalogueFiles || [])
                .filter((file: any) => !isImageFile(file))
                .map((file: any) => ({
                    id: `catalogue-file-${file.id}`,
                    name: file.originalName || file.name || 'Uploaded catalogue document',
                    verificationStatus: 'UPLOADED',
                    fileAsset: file,
                })),
            ...(product?.organization?.certifications || [])
                .map((cert: any) => ({
                    id: `org-cert-${cert.id}`,
                    name: cert.name || cert.title || 'Seller Organization Certification',
                    verificationStatus: cert.verificationStatus || 'VERIFIED',
                    issuingAuthority: cert.issuingAuthority || 'Organization Document',
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

    const overviewFields = buildProductDetailFields(productAny).filter(f =>
        ['Product Name', 'Category', 'Seller', 'Seller Location', 'Description', 'Status'].includes(f.label)
    );
    const pricingFields = buildProductDetailFields(productAny).filter(f =>
        ['Price', 'Currency', 'GST Rate', 'Original Price', 'Discount Price', 'Discount Percent', 'Offer Label', 'Offer Start Date', 'Offer End Date'].includes(f.label)
    );
    const detailFields = buildProductDetailFields(productAny).filter(f =>
        ['Unit of Measure', 'SKU', 'Brand', 'Model Number', 'HSN Code', 'Item Condition', 'MSME Made', 'Bulk Deal Available', 'Bulk Minimum Quantity'].includes(f.label)
    );

    return (
        <div className={useDashboardShell ? "min-h-full bg-slate-50/60" : "min-h-dvh bg-slate-50/60 flex flex-col"}>
            <main className="flex-1 pb-16">
                {/* Modern Header Breadcrumbs Bar */}
                <div className="bg-white border-b border-slate-200/80 sticky top-0 z-10 shadow-2xs">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-1.5 text-slate-500 font-medium overflow-hidden">
                            <Link href="/" className="hover:text-[#0b2447] transition flex items-center gap-1 shrink-0">
                                Home
                            </Link>
                            <ChevronRight className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                            <Link href="/marketplace/products" className="hover:text-[#0b2447] transition shrink-0">
                                Products Marketplace
                            </Link>
                            {product.category && (
                                <>
                                    <ChevronRight className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                    <Link href={`/marketplace/products?categoryId=${product.category.id}`} className="hover:text-[#0b2447] transition truncate max-w-[150px] shrink-0">
                                        {product.category.name}
                                    </Link>
                                </>
                            )}
                            <ChevronRight className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                            <span className="text-[#0b2447] font-semibold truncate max-w-[220px]">{product.name}</span>
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleShare}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 font-semibold text-xs hover:bg-slate-50 hover:text-[#0b2447] transition shadow-2xs"
                                title="Share product link"
                            >
                                <Share2 className="h-3.5 w-3.5" /> Share
                            </button>
                        </div>
                    </div>
                </div>

                <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 pb-24 lg:pb-12">
                    {/* Navigation Top Bar */}
                    <div className="flex items-center justify-between mb-6">
                        <button
                            onClick={() => window.history.back()}
                            className="inline-flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-[#0b2447] bg-white px-3.5 py-2 rounded-xl border border-slate-200/80 shadow-2xs hover:shadow-xs transition"
                        >
                            <ArrowLeft className="h-4 w-4" /> Back to listings
                        </button>
                        <div className="flex items-center gap-2">
                            {product.status && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> {product.status}
                                </span>
                            )}
                            {isVerified && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200">
                                    <BadgeCheck className="h-3 w-3" /> Verified MSME
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Main Layout Grid */}
                    <div className={user?.role === 'seller' ? "grid gap-8 lg:grid-cols-2" : "grid gap-8 lg:grid-cols-2 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)_330px]"}>
                        
                        {/* COLUMN 1: Image Gallery & Trust Highlights */}
                        <div className="space-y-4">
                            <div className="relative group overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm flex items-center justify-center aspect-[4/3] max-h-[460px]">
                                {currentImage ? (
                                    <>
                                        <img
                                            src={currentImage}
                                            alt={product.name}
                                            onError={() => setFailedImages((current) => current.includes(currentImage) ? current : [...current, currentImage])}
                                            className="w-full h-full object-contain transition-transform duration-300 group-hover:scale-105"
                                        />
                                        <button
                                            onClick={() => setFullScreenImage(currentImage)}
                                            className="absolute bottom-3 right-3 p-2.5 rounded-xl bg-slate-900/70 text-white hover:bg-[#0b2447] backdrop-blur-md opacity-0 group-hover:opacity-100 transition duration-200 shadow-lg"
                                            title="View full screen image"
                                        >
                                            <Eye className="h-4 w-4" />
                                        </button>
                                    </>
                                ) : (
                                    <div className="flex flex-col items-center justify-center p-10 text-center">
                                        <Package className="h-16 w-16 text-slate-300 mb-2" />
                                        <p className="text-xs font-bold text-slate-400">Product preview unavailable</p>
                                    </div>
                                )}
                            </div>

                            {/* Thumbnail Selector */}
                            {imageCandidates.length > 1 && (
                                <div className="flex gap-3 overflow-x-auto pb-1 pt-1">
                                    {imageCandidates.map((img: string, i: number) => (
                                        <button
                                            key={`${img}-${i}`}
                                            onClick={() => setSelectedImage(i)}
                                            className={`relative w-18 h-18 rounded-xl border-2 overflow-hidden shrink-0 transition-all duration-200 ${i === selectedImage ? 'border-[#0b2447] ring-2 ring-[#0b2447]/20 scale-105 shadow-sm' : 'border-slate-200 opacity-70 hover:opacity-100 hover:border-slate-300'}`}
                                        >
                                            <img src={img} alt={`${product.name} preview ${i + 1}`} className="w-full h-full object-cover" onError={(e) => { e.currentTarget.src = resolveMarketplaceImage(product, 'product'); }} />
                                        </button>
                                    ))}
                                </div>
                            )}

                            {/* Key Trust & Procurement Badges */}
                            <div className="grid grid-cols-3 gap-2.5 pt-2">
                                <div className="rounded-xl border border-slate-200/80 bg-white p-3.5 text-center shadow-2xs hover:border-blue-200 transition">
                                    <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#0b2447] flex items-center justify-center mx-auto mb-1.5">
                                        <ShieldCheck className="h-4.5 w-4.5" />
                                    </div>
                                    <p className="text-[11px] font-bold text-slate-800">Verified Listing</p>
                                    <p className="text-[9px] font-medium text-slate-500 mt-0.5">MSME Auth Portal</p>
                                </div>
                                <div className="rounded-xl border border-slate-200/80 bg-white p-3.5 text-center shadow-2xs hover:border-blue-200 transition">
                                    <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center mx-auto mb-1.5">
                                        <ClipboardList className="h-4.5 w-4.5" />
                                    </div>
                                    <p className="text-[11px] font-bold text-slate-800">Quote Ready</p>
                                    <p className="text-[9px] font-medium text-slate-500 mt-0.5">Direct RFQ Action</p>
                                </div>
                                <div className="rounded-xl border border-slate-200/80 bg-white p-3.5 text-center shadow-2xs hover:border-blue-200 transition">
                                    <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center mx-auto mb-1.5">
                                        <Award className="h-4.5 w-4.5" />
                                    </div>
                                    <p className="text-[11px] font-bold text-slate-800">MSME Supply</p>
                                    <p className="text-[9px] font-medium text-slate-500 mt-0.5">Certified Sourcing</p>
                                </div>
                            </div>
                        </div>

                        {/* COLUMN 2: Product Information & Tabbed Detailed Specs */}
                        <div className="space-y-6">
                            <div>
                                {product.category && (
                                    <span className="inline-flex items-center gap-1.5 text-[11px] font-extrabold text-[#0b2447] bg-[#0b2447]/5 border border-[#0b2447]/10 px-3 py-1 rounded-full uppercase tracking-wider mb-2">
                                        <Tags className="h-3 w-3 text-[#0b2447]" /> {product.category.name}
                                    </span>
                                )}

                                <h1 className="text-2xl sm:text-3xl font-black text-slate-900 leading-tight tracking-tight mt-1">
                                    {product.name}
                                </h1>

                                <p className="text-xs font-semibold text-slate-500 mt-2 leading-relaxed">
                                    Official MSME marketplace procurement listing. Discover product specifications, compare vendors, and request direct quotations.
                                </p>
                            </div>

                            {/* Price Highlight Banner */}
                            {user ? (
                                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 rounded-2xl p-5 shadow-inner mt-4">
                                    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                                        <div>
                                            <span className="block text-[10px] font-extrabold text-blue-600 uppercase tracking-wider mb-1">
                                                {hasOffer ? 'Special Offer Price' : 'Standard Price'}
                                            </span>
                                            {displayPrice > 0 ? (
                                                <div className="flex items-baseline gap-2">
                                                    <span className="text-4xl font-black text-[#0b2447] tracking-tight">
                                                        ₹{displayPrice.toLocaleString('en-IN')}
                                                    </span>
                                                    {hasOffer && (
                                                        <span className="text-sm font-bold text-slate-400 line-through">
                                                            ₹{price.toLocaleString('en-IN')}
                                                        </span>
                                                    )}
                                                </div>
                                            ) : (
                                                <span className="text-2xl font-black text-amber-600">Quote Required</span>
                                            )}
                                            <p className="text-xs font-semibold text-slate-500 mt-1">
                                                Per {product.unitOfMeasure || 'unit'}
                                                {product.taxRate ? ` • ${product.taxRate}% GST extra` : ''}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 shadow-inner mt-4">
                                    <span className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mb-2">
                                        Procurement Pricing
                                    </span>
                                    <span className="inline-block px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-sm font-bold text-slate-600 shadow-sm">
                                        Login to view price
                                    </span>
                                </div>
                            )}

                            {/* Seller Quick Card */}
                            <div className="flex items-center justify-between p-4 bg-white rounded-xl border border-slate-200/80 shadow-2xs hover:border-slate-300 transition mt-6">
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="w-11 h-11 rounded-xl bg-slate-900 text-white font-black text-sm flex items-center justify-center shrink-0 shadow-sm">
                                        {(product.organization?.organizationName || product.seller?.name || 'M')[0].toUpperCase()}
                                    </div>
                                    <div className="min-w-0">
                                        <h4 className="text-xs font-extrabold text-slate-900 truncate">
                                            {product.organization?.organizationName || product.seller?.name || 'Verified Supplier'}
                                        </h4>
                                        <div className="flex flex-wrap items-center gap-2 mt-1 text-[11px] text-slate-500">
                                            {location && (
                                                <span className="inline-flex items-center gap-1 font-medium text-slate-600">
                                                    <MapPin className="h-3 w-3 text-slate-400 shrink-0" /> {location}
                                                </span>
                                            )}
                                            {isVerified && (
                                                <span className="inline-flex items-center gap-0.5 text-emerald-700 font-extrabold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200/80">
                                                    <BadgeCheck className="h-3 w-3" /> Verified
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                {product.organization?.id && (
                                    <Link
                                        href={`/marketplace/sellers/${product.organization.id}`}
                                        className="inline-flex items-center gap-1 text-[11px] font-bold text-[#0b2447] hover:underline shrink-0 bg-slate-50 px-3 py-2 rounded-lg border border-slate-200/60"
                                    >
                                        Storefront <ExternalLink className="h-3 w-3" />
                                    </Link>
                                )}
                            </div>

                            {/* Procurement Highlight Banner */}
                            <div className="p-5 bg-gradient-to-br from-[#0b2447]/5 via-white to-slate-50 rounded-2xl border border-[#0b2447]/15 shadow-2xs">
                                <div className="flex items-center gap-3">
                                    <div className="p-2.5 rounded-xl bg-[#0b2447]/10 text-[#0b2447]">
                                        <Sparkles className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-[#0b2447]">Available for Procurement</p>
                                        <div className="flex flex-wrap items-center gap-2 mt-2 text-xs font-semibold text-slate-600">
                                            {productAny.bulkMinQuantity && (
                                                <span className="bg-amber-50 text-amber-800 px-2.5 py-1 rounded-md border border-amber-200">
                                                    Min Bulk: {productAny.bulkMinQuantity} {product.unitOfMeasure || 'units'}
                                                </span>
                                            )}
                                            <span className="bg-white px-2.5 py-1 rounded-md border border-slate-200/80 shadow-sm">
                                                Sold in {product.unitOfMeasure || 'units'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Interactive Details Navigation Tabs */}
                            <div className="space-y-4">
                                <div className="flex border-b border-slate-200 gap-2 overflow-x-auto scrollbar-none">
                                    <button
                                        onClick={() => setActiveTab('overview')}
                                        className={`pb-3 px-3 text-xs font-extrabold transition-all border-b-2 whitespace-nowrap ${activeTab === 'overview' ? 'border-[#0b2447] text-[#0b2447]' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
                                    >
                                        Overview
                                    </button>
                                    <button
                                        onClick={() => setActiveTab('specs')}
                                        className={`pb-3 px-3 text-xs font-extrabold transition-all border-b-2 whitespace-nowrap ${activeTab === 'specs' ? 'border-[#0b2447] text-[#0b2447]' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
                                    >
                                        Technical Specs {product.specifications?.length ? `(${product.specifications.length})` : ''}
                                    </button>
                                    <button
                                        onClick={() => setActiveTab('compliance')}
                                        className={`pb-3 px-3 text-xs font-extrabold transition-all border-b-2 whitespace-nowrap ${activeTab === 'compliance' ? 'border-[#0b2447] text-[#0b2447]' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
                                    >
                                        Seller Verification
                                    </button>
                                </div>

                                {/* TAB 1: OVERVIEW */}
                                {activeTab === 'overview' && (
                                    <div className="space-y-4 animate-in fade-in duration-200">
                                        <div className="grid gap-3 text-xs sm:grid-cols-2">
                                            {overviewFields.map(({ label, value }) => (
                                                <div key={label} className="rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-2xs">
                                                    <span className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400">{label}</span>
                                                    <span className="mt-1 block font-bold text-slate-800 text-wrap-anywhere">{String(value ?? '—')}</span>
                                                </div>
                                            ))}
                                        </div>

                                        {product.description && (
                                            <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-2xs space-y-2">
                                                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-700">Detailed Description</h3>
                                                <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-line">{product.description}</p>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* TAB 2: TECHNICAL SPECS */}
                                {activeTab === 'specs' && (
                                    <div className="space-y-4 animate-in fade-in duration-200">
                                        {product.specifications?.length > 0 ? (
                                            <div className="bg-white rounded-xl border border-slate-200/80 overflow-hidden shadow-2xs">
                                                <table className="w-full text-xs">
                                                    <thead>
                                                        <tr className="bg-slate-100/70 border-b border-slate-200 text-[#0b2447]">
                                                            <th className="px-4 py-3 text-left font-extrabold">Parameter</th>
                                                            <th className="px-4 py-3 text-left font-extrabold">Specification Value</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-100">
                                                        {product.specifications.map((spec: any, i: number) => (
                                                            <tr key={spec.id || i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                                                                <td className="px-4 py-3 font-semibold text-slate-700 w-1/3 border-r border-slate-100">{spec.name}</td>
                                                                <td className="px-4 py-3 font-bold text-slate-900">{spec.value}{spec.unit ? ` ${spec.unit}` : ''}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        ) : (
                                            <div className="rounded-xl border border-dashed border-slate-200 bg-white p-6 text-center text-xs font-semibold text-slate-500">
                                                No structured technical specifications uploaded for this item yet.
                                            </div>
                                        )}

                                        {detailFields.length > 0 && (
                                            <div>
                                                <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 mb-2">Item Identifiers & Properties</h4>
                                                <div className="grid gap-3 text-xs sm:grid-cols-2">
                                                    {detailFields.map(({ label, value }) => (
                                                        <div key={label} className="rounded-xl border border-slate-200/80 bg-white p-3 shadow-2xs">
                                                            <span className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400">{label}</span>
                                                            <span className="mt-1 block font-bold text-slate-800">{String(value)}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}



                                {/* TAB 4: SELLER VERIFICATION */}
                                {activeTab === 'compliance' && (
                                    <div className="space-y-4 animate-in fade-in duration-200">
                                        <div className="rounded-xl border border-slate-200/80 bg-white p-5 space-y-4 shadow-2xs">
                                            <div className="flex items-center gap-3">
                                                <div className="p-3 rounded-xl bg-emerald-50 text-emerald-700">
                                                    <ShieldCheck className="h-6 w-6" />
                                                </div>
                                                <div>
                                                    <h4 className="text-sm font-extrabold text-slate-900">
                                                        {product.organization?.organizationName || product.seller?.name || 'Verified Supplier'}
                                                    </h4>
                                                    <p className="text-xs text-slate-500 font-medium">MSME Portal Registration & Identity Verification Status</p>
                                                </div>
                                            </div>

                                            <div className="grid gap-3 text-xs sm:grid-cols-2 pt-2 border-t border-slate-100">
                                                <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
                                                    <span className="text-[10px] font-extrabold uppercase text-slate-400">Verification Status</span>
                                                    <p className="mt-0.5 font-extrabold text-emerald-700 flex items-center gap-1">
                                                        <BadgeCheck className="h-4 w-4" /> {isVerified ? 'VERIFIED SELLER' : 'PENDING REVIEW'}
                                                    </p>
                                                </div>
                                                <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
                                                    <span className="text-[10px] font-extrabold uppercase text-slate-400">District / Location</span>
                                                    <p className="mt-0.5 font-extrabold text-slate-800">{location || 'District Registration Available'}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* COLUMN 3: Sticky Procurement Action Sidebar */}
                        {user?.role !== 'seller' && (
                            <aside className="lg:col-span-2 xl:col-span-1">
                                <div className="sticky top-20 rounded-2xl border border-slate-200/90 bg-white p-5 shadow-md space-y-5">
                                    <div>
                                        <div className="flex items-center justify-between">
                                            <h3 className="text-sm font-extrabold text-slate-900">Procurement Actions</h3>
                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700 uppercase">
                                                Direct Buyer
                                            </span>
                                        </div>
                                        <p className="text-[11px] font-medium leading-relaxed text-slate-500 mt-1">
                                            Place an order, request formal quote, or save vendor profile for bulk procurement.
                                        </p>
                                    </div>

                                    {/* Order Unit Price Card */}
                                    {user ? (
                                        <div className="p-4 rounded-xl border border-slate-100 bg-slate-50/80 space-y-1 mt-4">
                                            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Order Unit Price</span>
                                            {displayPrice > 0 ? (
                                                <div>
                                                    <div className="flex items-baseline gap-2">
                                                        <span className="text-2xl font-black text-[#0b2447]">₹{displayPrice.toLocaleString('en-IN')}</span>
                                                        {hasOffer && <span className="text-xs font-bold text-slate-400 line-through">₹{price.toLocaleString('en-IN')}</span>}
                                                    </div>
                                                    <p className="text-[10px] font-bold text-slate-500 mt-0.5">
                                                        Per {product.unitOfMeasure || 'unit'} {product.taxRate ? `| GST ${product.taxRate}% extra` : ''}
                                                    </p>
                                                </div>
                                            ) : (
                                                <p className="text-xs font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded border border-amber-200">
                                                    Quote Required
                                                </p>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="p-4 rounded-xl border border-slate-100 bg-slate-50/80 space-y-1 mt-4">
                                            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Order Unit Price</span>
                                            <div className="mt-1">
                                                <span className="inline-block px-3 py-1.5 rounded bg-white border border-slate-200 text-[11px] font-bold text-slate-600">
                                                    Login to view price
                                                </span>
                                            </div>
                                        </div>
                                    )}

                                    {/* Action Buttons */}
                                    <div className="space-y-3 mt-4">
                                        <button
                                            onClick={handleRequestQuote}
                                            className="w-full h-12 inline-flex items-center justify-center gap-2 rounded-xl bg-[#0b2447] text-white font-black text-sm shadow-md hover:bg-[#12335f] active:scale-[0.98] transition-all"
                                        >
                                            <FileText className="h-5 w-5" /> Request Formal Quote
                                        </button>

                                        {cartQuantity > 0 ? (
                                            <div className="flex h-11 w-full items-center justify-between rounded-xl border-2 border-[#0b2447] bg-white shadow-sm overflow-hidden">
                                                <button
                                                    onClick={() => handleQuantityChange(-1)}
                                                    className="w-12 h-full flex items-center justify-center bg-slate-50 hover:bg-slate-100 text-[#0b2447] font-bold text-lg transition"
                                                >
                                                    −
                                                </button>
                                                <div className="flex-1 flex items-center justify-center font-black text-[#0b2447] text-sm">
                                                    {cartQuantity} in Procurement Cart
                                                </div>
                                                <button
                                                    onClick={() => handleQuantityChange(1)}
                                                    className="w-12 h-full flex items-center justify-center bg-slate-50 hover:bg-slate-100 text-[#0b2447] font-bold text-lg transition"
                                                >
                                                    +
                                                </button>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={handleAddToCart}
                                                className="w-full h-11 inline-flex items-center justify-center gap-2 rounded-xl border-2 border-slate-200 text-slate-700 font-extrabold text-xs hover:bg-slate-50 active:scale-[0.98] transition-all"
                                            >
                                                <ShoppingCart className="h-4 w-4 text-[#0b2447]" /> Add to Procurement Cart
                                            </button>
                                        )}

                                        <div className="grid grid-cols-2 gap-2 pt-1">
                                            <CompareToggleButton
                                                item={{ type: 'product', id: product.id, categoryId: product.category?.id }}
                                                className="h-10 w-full rounded-xl border-slate-200 text-slate-700 text-xs font-bold"
                                            />
                                            <button
                                                type="button"
                                                onClick={handleSaveSupplier}
                                                className="h-10 w-full inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-bold hover:bg-slate-50 transition"
                                            >
                                                <BookmarkPlus className="h-4 w-4 text-[#0b2447]" /> Save Seller
                                            </button>
                                        </div>
                                    </div>

                                    {/* Assurance List */}
                                    <div className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/70 text-[11px] space-y-2">
                                        <div className="flex items-center gap-2 text-slate-700 font-bold">
                                            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" /> MSME Direct Sourcing Guaranteed
                                        </div>
                                        <div className="flex items-center gap-2 text-slate-700 font-bold">
                                            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" /> Verified Seller Credentials
                                        </div>
                                        <div className="flex items-center gap-2 text-slate-700 font-bold">
                                            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" /> Encrypted Buyer Messages & RFQs
                                        </div>
                                    </div>
                                </div>
                            </aside>
                        )}
                    </div>

                    {/* Uploaded Documents & Certifications Section */}
                    <div className="mt-12 pt-8 border-t border-slate-200/80">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                                    <FileText className="h-5 w-5 text-[#0b2447]" /> Uploaded Documents & Certifications
                                </h3>
                                <p className="text-xs text-slate-500 font-medium">Compliance documents, ISO certificates, and product catalogues uploaded by seller.</p>
                            </div>
                            <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
                                {productDocuments.length} Documents
                            </span>
                        </div>

                        {productDocuments.length > 0 ? (
                            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                {productDocuments.map((cert: any) => {
                                    return (
                                        <div
                                            key={cert.id}
                                            className="group flex flex-col justify-between rounded-xl border border-slate-200/80 bg-white p-4 shadow-2xs hover:border-[#0b2447]/30 hover:shadow-xs transition"
                                        >
                                            <div className="flex items-start gap-3">
                                                <div className="p-2.5 rounded-xl bg-[#0b2447]/5 text-[#0b2447] shrink-0">
                                                    <FileText className="h-6 w-6" />
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <h4 className="font-extrabold text-xs text-slate-900 truncate group-hover:text-[#0b2447] transition">
                                                        {cert.name || cert.fileAsset?.originalName || 'Compliance Document'}
                                                    </h4>
                                                    <p className="text-[10px] font-semibold text-slate-500 mt-0.5">
                                                        {cert.issuingAuthority ? `${cert.issuingAuthority} • ` : ''}{cert.verificationStatus || 'UPLOADED'}
                                                    </p>
                                                    {cert.certificateNumber && (
                                                        <span className="inline-block mt-1 text-[10px] font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">
                                                            No: {cert.certificateNumber}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px]">
                                                <span className="text-slate-400 font-medium">
                                                    {cert.issuedAt ? formatCatalogueDate(cert.issuedAt) : 'Verified document'}
                                                </span>
                                                {cert.fileAsset?.url && (
                                                    <button
                                                        type="button"
                                                        onClick={() => openFileAsset(cert.fileAsset, cert.name || 'Document').catch(err => toast.error(err instanceof Error ? err.message : 'Unable to open file'))}
                                                        className="inline-flex items-center gap-1 font-extrabold text-[#0b2447] hover:underline"
                                                    >
                                                        <Download className="h-3.5 w-3.5" /> View / Download
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-8 text-center">
                                <FileText className="h-10 w-10 text-slate-300 mx-auto mb-2" />
                                <p className="text-xs font-bold text-slate-600">No verification documents attached yet</p>
                                <p className="text-[11px] text-slate-400 mt-1">Official certifications and spec sheets will appear here once uploaded by the seller.</p>
                            </div>
                        )}
                    </div>

                    {/* Related Products Section */}
                    {related.length > 0 && (
                        <div className="mt-14 pt-8 border-t border-slate-200/80">
                            <h3 className="text-base font-extrabold text-slate-900 mb-4 flex items-center gap-2">
                                <Sparkles className="h-5 w-5 text-amber-500" /> Related Products in Category
                            </h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                {related.map((p: any) => (
                                    <Link
                                        key={p.id}
                                        href={`/marketplace/products/${p.id}`}
                                        className="group bg-white rounded-xl border border-slate-200/80 p-3.5 hover:shadow-md hover:border-slate-300 transition-all flex flex-col justify-between space-y-3"
                                    >
                                        <div className="space-y-2">
                                            <div className="h-36 bg-slate-50 rounded-lg flex items-center justify-center overflow-hidden relative">
                                                {resolveMarketplaceImage(p, 'product') ? (
                                                    <img src={resolveMarketplaceImage(p, 'product')} alt={p.name} className="w-full h-full object-contain p-2 group-hover:scale-105 transition" onError={(e) => { e.currentTarget.src = resolveMarketplaceImage({}, 'product'); }} />
                                                ) : (
                                                    <Package className="h-10 w-10 text-slate-300" />
                                                )}
                                            </div>
                                            <h4 className="text-xs font-extrabold text-slate-900 line-clamp-2 group-hover:text-[#0b2447] transition">{p.name}</h4>
                                            <p className="text-[10px] font-semibold text-slate-500 truncate">{p.organization?.organizationName || 'Verified Supplier'}</p>
                                        </div>
                                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                                            <span className="text-[10px] font-bold text-slate-500">
                                                {(p as any).bulkMinQuantity ? `MOQ: ${(p as any).bulkMinQuantity}` : 'Procurement Available'}
                                            </span>
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

            {/* Modal for full screen image */}
            {fullScreenImage && (
                <div
                    className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4"
                    onClick={() => setFullScreenImage(null)}
                >
                    <div className="relative max-w-4xl max-h-[90vh] bg-white rounded-2xl p-4 overflow-hidden shadow-2xl">
                        <img src={fullScreenImage} alt="Full screen preview" className="max-w-full max-h-[80vh] object-contain mx-auto" />
                        <button
                            onClick={() => setFullScreenImage(null)}
                            className="absolute top-4 right-4 bg-slate-900 text-white p-2 rounded-full font-bold hover:bg-[#0b2447]"
                        >
                            ✕
                        </button>
                    </div>
                </div>
            )}

            {/* Sticky Mobile Procurement Action Bar */}
            {user?.role !== 'seller' && (
                <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/90 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:hidden shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
                    <div className="flex items-center gap-3">
                        {user ? (
                            <div className="min-w-0 flex-1">
                                <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Unit Price</span>
                                {displayPrice > 0 ? (
                                    <div className="flex items-baseline gap-1.5 truncate">
                                        <span className="text-base font-black text-[#0b2447]">₹{displayPrice.toLocaleString('en-IN')}</span>
                                        {hasOffer && <span className="text-[10px] font-bold text-slate-400 line-through">₹{price.toLocaleString('en-IN')}</span>}
                                    </div>
                                ) : (
                                    <span className="text-xs font-black text-amber-700">Quote Only</span>
                                )}
                            </div>
                        ) : (
                            <div className="min-w-0 flex-1">
                                <span className="inline-block px-2 py-1 rounded bg-slate-100 border border-slate-200 text-[10px] font-bold text-slate-600">
                                    Login for price
                                </span>
                            </div>
                        )}

                        <div className="flex items-center gap-2 shrink-0">
                            {cartQuantity > 0 ? (
                                <div className="flex h-10 min-w-[84px] items-center justify-between rounded-xl border-2 border-[#0b2447] bg-white px-1.5 font-black text-[#0b2447]">
                                    <button type="button" onClick={() => handleQuantityChange(-1)} className="p-1 text-sm active:scale-90">−</button>
                                    <span className="text-xs">{cartQuantity}</span>
                                    <button type="button" onClick={() => handleQuantityChange(1)} className="p-1 text-sm active:scale-90">+</button>
                                </div>
                            ) : (
                                <button
                                    type="button"
                                    onClick={handleAddToCart}
                                    className="h-10 px-3 rounded-xl bg-slate-100 border border-slate-200 text-slate-800 font-bold text-xs flex items-center gap-1.5 active:scale-95 transition"
                                    aria-label="Add to cart"
                                >
                                    <ShoppingCart className="h-4 w-4 text-[#0b2447]" />
                                    <span className="hidden sm:inline">Cart</span>
                                </button>
                            )}

                            <button
                                type="button"
                                onClick={handleRequestQuote}
                                className="h-10 px-4 rounded-xl bg-[#0b2447] text-white font-black text-xs uppercase tracking-wider shadow-md active:scale-95 transition flex items-center justify-center gap-2"
                            >
                                <FileText className="h-4 w-4" /> Quote
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {!useDashboardShell && <MarketplaceFooter />}
        </div>
    );
}
