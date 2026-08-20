'use client';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
    ChevronRight, FileText, MapPin, BadgeCheck, Wrench, ArrowLeft,
    ShoppingCart, Building2, ShieldCheck, ClipboardList, BookmarkPlus,
    CheckCircle2, Clock, Check, X, Award, ExternalLink, Sparkles, Layers, Share2, Info
} from 'lucide-react';
import { useAuth } from '../../../hooks/useAuth';
import { marketplaceApi, type MarketplaceService } from '../api';
import { MarketplaceHeader } from '../components/MarketplaceHeader';
import { MarketplaceFooter } from '../components/MarketplaceFooter';
import { toast } from 'sonner';
import { useMarketplaceCart } from '../hooks/useMarketplaceCart';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, unwrapApiData } from '../../../lib/api';
import { openFileAsset } from '../../../lib/files';
import { ServiceDetailSkeleton } from '../../../components/ui/skeleton';
import { resolveMarketplaceImage } from '../utils/marketplaceImages';
import { saveSupplier } from '../utils/savedSuppliers';
import { buildServiceDetailFields, formatCatalogueDate } from '../../catalogue/utils/catalogueDetailUtils';

const pricingLabels: Record<string, string> = {
    FIXED: 'Fixed Price',
    HOURLY: 'Per Hour Rate',
    DAILY: 'Per Day Rate',
    MONTHLY: 'Monthly Retainer',
    PER_PROJECT: 'Per Project Basis',
    CUSTOM: 'Quote Based Service',
};

const isImageFile = (file: any) => String(file?.mimeType || '').toLowerCase().startsWith('image/');

export default function MarketplaceServiceDetail() {
    const { user } = useAuth();
    const pathname = usePathname() || '';
    const router = useRouter();
    const serviceId = Number(pathname.split('/').pop());
    const queryClient = useQueryClient();
    const useDashboardShell = Boolean(user);

    const [activeTab, setActiveTab] = useState<'overview' | 'scope' | 'pricing' | 'provider'>('overview');

    const { data: detailData, isLoading: loading } = useQuery({
        queryKey: ['marketplaceService', serviceId],
        queryFn: () => marketplaceApi.getServiceDetail(serviceId),
        enabled: serviceId > 0,
        staleTime: 5 * 60 * 1000,
        initialData: () => {
            const cachedDetail = queryClient.getQueryData<any>(['marketplaceService', serviceId]);
            if (cachedDetail) return cachedDetail;

            const peeked = api.peek(`/api/marketplace/services/${serviceId}`);
            if (peeked) return unwrapApiData(peeked);

            const cacheState = queryClient.getQueryCache().getAll();
            for (const query of cacheState) {
                const data = query.state.data as any;
                if (data?.featuredServices) {
                    const found = data.featuredServices.find((s: any) => s.id === serviceId);
                    if (found) return { service: found, relatedServices: [] };
                }
                if (data?.services) {
                    const found = data.services.find((s: any) => s.id === serviceId);
                    if (found) return { service: found, relatedServices: [] };
                }
                if (data?.records) {
                    const found = data.records.find((s: any) => s.id === serviceId);
                    if (found) return { service: found, relatedServices: [] };
                }
            }
            return undefined;
        },
    });

    const service = detailData?.service;
    const related = detailData?.relatedServices || [];

    const { add: addCartItem, update: updateCartQty, getQuantity } = useMarketplaceCart();
    const [imageFailed, setImageFailed] = useState(false);

    useEffect(() => {
        setImageFailed(false);
    }, [serviceId]);

    const cartQuantity = getQuantity(serviceId, 'service');

    const handleAddToCart = () => {
        if (cartQuantity === 0 && service) {
            addCartItem(
                {
                    id: service.id,
                    name: service.name,
                    price: service.basePrice ? Number(service.basePrice) : undefined,
                    unit: pricingLabels[service.pricingModel] || 'engagement',
                    imageUrl: resolveMarketplaceImage(service, 'service'),
                    category: service.category?.name,
                    type: 'service',
                },
                { source: 'service-detail' }
            );
            toast.success(`${service.name} added to requirements!`);
        }
    };

    const handleQuantityChange = (delta: number) => {
        const newQuantity = Math.max(0, cartQuantity + delta);
        updateCartQty(serviceId, 'service', newQuantity);
    };

    const handleRequestQuote = () => {
        if (!service) return;
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
        const sellerUserId = Number(service.seller?.id || 0);
        if (!sellerUserId) {
            toast.error('Seller contact is not available for this listing.');
            return;
        }
        const params = new URLSearchParams({
            intent: 'quote',
            sellerId: String(sellerUserId),
            subject: `Quote request: ${service.name}`,
            message: `Hello, I would like to request a quotation for ${service.name}.\n\nCategory: ${service.category?.name || 'Not specified'}\nService area: ${service.serviceArea || 'Please confirm'}\nPlease share scope, delivery timeline, payment terms, and applicable taxes.`
        });
        router.push(`/buyer/messages?${params.toString()}`);
    };

    const handleShare = () => {
        if (navigator.share) {
            navigator.share({
                title: service?.name || 'Service Detail',
                url: window.location.href,
            }).catch(() => { });
        } else {
            navigator.clipboard.writeText(window.location.href);
            toast.success('Service link copied to clipboard!');
        }
    };

    if (loading) return <ServiceDetailSkeleton useDashboardShell={useDashboardShell} />;

    if (!service) {
        return (
            <div className={useDashboardShell ? "min-h-full bg-slate-50" : "min-h-dvh bg-slate-50 flex flex-col"}>
                <main className="flex-1 flex items-center justify-center py-20 px-4">
                    <div className="text-center max-w-md bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
                        <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4 text-slate-400">
                            <Wrench className="h-8 w-8" />
                        </div>
                        <h2 className="text-xl font-bold text-slate-800 mb-2">Service Listing Not Found</h2>
                        <p className="text-xs text-slate-500 mb-6 leading-relaxed">This service listing may have been unlisted, modified, or is temporarily unavailable on the marketplace.</p>
                        <Link href="/marketplace/services" className="inline-flex items-center justify-center gap-2 h-10 px-6 rounded-xl bg-[#0b2447] text-white text-xs font-bold hover:bg-[#12335f] transition shadow-sm">
                            <ArrowLeft className="h-4 w-4" /> Browse All Services
                        </Link>
                    </div>
                </main>
                {!useDashboardShell && <MarketplaceFooter />}
            </div>
        );
    }

    const isVerified = service.organization?.verificationStatus === 'VERIFIED';
    const location = service.organization?.city || service.organization?.district || service.organization?.state;

    const handleSaveSupplier = () => {
        if (!service.organization?.id) {
            toast.error('Supplier details are not available for this listing.');
            return;
        }
        saveSupplier({
            id: service.organization.id,
            sellerUserId: service.seller?.id || null,
            name: service.organization.organizationName || service.seller?.name || 'Verified supplier',
            location: [service.organization.city, service.organization.district, service.organization.state].filter(Boolean).join(', '),
            verificationStatus: service.organization.verificationStatus,
            source: service.name,
        });
        toast.success('Service provider added to saved sellers!');
    };

    const imageUrl = imageFailed ? '' : resolveMarketplaceImage(service, 'service');
    const serviceAny = service as any;

    const serviceDocuments = (() => {
        if (!service) return [];
        const docs: any[] = [
            ...(service.certifications || []),
            ...(serviceAny.documents || []),
            ...(serviceAny.attachments || []),
            ...(serviceAny.files || [])
                .filter((file: any) => !isImageFile(file))
                .map((file: any) => ({
                    id: `file-${file.id}`,
                    name: file.originalName || file.name || 'Service Document',
                    verificationStatus: 'UPLOADED',
                    fileAsset: file,
                })),
            ...(serviceAny.catalogueFiles || [])
                .filter((file: any) => !isImageFile(file))
                .map((file: any) => ({
                    id: `catalogue-file-${file.id}`,
                    name: file.originalName || file.name || 'Uploaded service document',
                    verificationStatus: 'UPLOADED',
                    fileAsset: file,
                })),
            ...(service?.organization?.certifications || [])
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

    const overviewFields = buildServiceDetailFields(serviceAny).filter(f =>
        ['Service Name', 'Category', 'Seller', 'Seller Location', 'Description', 'Status', 'Service Area'].includes(f.label)
    );
    const pricingFields = buildServiceDetailFields(serviceAny).filter(f =>
        ['Pricing Model', 'Base Price', 'Currency', 'GST Rate', 'Original Price', 'Discount Price', 'Discount Percent', 'Offer Label', 'Offer Start Date', 'Offer End Date'].includes(f.label)
    );
    const scopeFields = buildServiceDetailFields(serviceAny).filter(f =>
        ['Scope of Work', 'Deliverables', 'Inclusions', 'Exclusions', 'SLA / Response Time', 'Duration'].includes(f.label)
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
                            <Link href="/marketplace/services" className="hover:text-[#0b2447] transition shrink-0">
                                Services Marketplace
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
                            <span className="text-[#0b2447] font-semibold truncate max-w-[220px]">{service.name}</span>
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleShare}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 font-semibold text-xs hover:bg-slate-50 hover:text-[#0b2447] transition shadow-2xs"
                                title="Share service link"
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
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-blue-50 text-[#0b2447] border border-blue-200">
                                {pricingLabels[service.pricingModel] || 'Professional Service'}
                            </span>
                            {isVerified && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    <BadgeCheck className="h-3 w-3" /> Verified Provider
                                </span>
                            )}
                        </div>
                    </div>

                    <div className={user?.role === 'seller' ? "grid gap-8 lg:grid-cols-2" : "grid gap-8 lg:grid-cols-3"}>
                        {/* COLUMN 1 & 2: Service Information & Media */}
                        <div className="lg:col-span-2 space-y-6">
                            {/* Service Banner Hero */}
                            <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
                                <div className={imageUrl ? 'aspect-[16/7] min-h-56' : 'h-44 bg-gradient-to-br from-[#0b2447] via-[#12335f] to-slate-900 flex items-center justify-center'}>
                                    {imageUrl ? (
                                        <img
                                            src={imageUrl}
                                            alt={service.name}
                                            onError={() => setImageFailed(true)}
                                            className="h-full w-full object-cover"
                                        />
                                    ) : (
                                        <div className="text-center text-white/80 p-6">
                                            <Wrench className="mx-auto h-12 w-12 opacity-40 mb-2" />
                                            <p className="text-xs font-extrabold uppercase tracking-wider text-slate-300">MSME Service Provider Listing</p>
                                        </div>
                                    )}
                                </div>
                                <div className="absolute top-4 left-4 flex flex-wrap gap-2">
                                    <span className="rounded-lg bg-white/95 backdrop-blur-md px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-wider text-[#0b2447] shadow-md border border-slate-200/50">
                                        Service Solution
                                    </span>
                                    {isVerified && (
                                        <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/90 backdrop-blur-md px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-wider text-white shadow-md">
                                            <BadgeCheck className="h-3.5 w-3.5" /> Verified Provider
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Service Title & Identity */}
                            <div className="flex items-start gap-4 p-5 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
                                <div className="w-14 h-14 rounded-2xl bg-[#0b2447] text-white flex items-center justify-center shrink-0 shadow-md">
                                    <Wrench className="h-7 w-7" />
                                </div>
                                <div className="space-y-1">
                                    {service.category && (
                                        <span className="text-[10px] font-extrabold text-[#0b2447] uppercase tracking-wider bg-[#0b2447]/5 px-2.5 py-0.5 rounded border border-[#0b2447]/10">
                                            {service.category.name}
                                        </span>
                                    )}
                                    <h1 className="text-2xl font-black text-slate-900 tracking-tight">{service.name}</h1>
                                    <p className="text-xs font-medium text-slate-500">
                                        Listed for industrial discovery, enterprise service RFQs, and contract agreements.
                                    </p>
                                </div>
                            </div>

                            {/* Provider Organization Card */}
                            <div className="flex items-center justify-between p-4 bg-white rounded-xl border border-slate-200/80 shadow-2xs hover:border-slate-300 transition">
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="w-11 h-11 rounded-xl bg-slate-900 text-white font-black text-sm flex items-center justify-center shrink-0 shadow-sm">
                                        <Building2 className="h-5 w-5" />
                                    </div>
                                    <div className="min-w-0">
                                        <h4 className="text-xs font-extrabold text-slate-900 truncate">
                                            {service.organization?.organizationName || service.seller?.name || 'Verified Service Provider'}
                                        </h4>
                                        <div className="flex flex-wrap items-center gap-2 mt-1 text-[11px] text-slate-500">
                                            {location && (
                                                <span className="inline-flex items-center gap-1 font-medium text-slate-600">
                                                    <MapPin className="h-3 w-3 text-slate-400 shrink-0" /> {location}
                                                </span>
                                            )}
                                            {isVerified && (
                                                <span className="inline-flex items-center gap-0.5 text-emerald-700 font-extrabold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200/80">
                                                    <BadgeCheck className="h-3 w-3" /> Verified Provider
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                {service.organization?.id && (
                                    <Link
                                        href={`/marketplace/sellers/${service.organization.id}`}
                                        className="inline-flex items-center gap-1 text-[11px] font-bold text-[#0b2447] hover:underline shrink-0 bg-slate-50 px-3 py-2 rounded-lg border border-slate-200/60"
                                    >
                                        Storefront <ExternalLink className="h-3 w-3" />
                                    </Link>
                                )}
                            </div>

                            {/* Service Quick Metrics Strip */}
                            <div className="grid grid-cols-3 gap-3">
                                <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-2xs">
                                    <ShieldCheck className="h-5 w-5 text-[#0b2447] mb-1.5" />
                                    <p className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">Procurement Fit</p>
                                    <p className="text-xs font-extrabold text-slate-800 mt-0.5">{service.category?.name || 'Service Standard'}</p>
                                </div>
                                <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-2xs">
                                    <MapPin className="h-5 w-5 text-[#0b2447] mb-1.5" />
                                    <p className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">Service Coverage</p>
                                    <p className="text-xs font-extrabold text-slate-800 mt-0.5">{service.serviceArea || location || 'On-site / District'}</p>
                                </div>
                                <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-2xs">
                                    <ClipboardList className="h-5 w-5 text-[#0b2447] mb-1.5" />
                                    <p className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">Engagement Type</p>
                                    <p className="text-xs font-extrabold text-slate-800 mt-0.5">{pricingLabels[service.pricingModel] || 'Custom Terms'}</p>
                                </div>
                            </div>

                            {/* Interactive Navigation Tabs */}
                            <div className="space-y-4 pt-2">
                                <div className="flex border-b border-slate-200 gap-2 overflow-x-auto scrollbar-none">
                                    <button
                                        onClick={() => setActiveTab('overview')}
                                        className={`pb-3 px-3 text-xs font-extrabold transition-all border-b-2 whitespace-nowrap ${activeTab === 'overview' ? 'border-[#0b2447] text-[#0b2447]' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
                                    >
                                        Overview & Scope
                                    </button>
                                    <button
                                        onClick={() => setActiveTab('scope')}
                                        className={`pb-3 px-3 text-xs font-extrabold transition-all border-b-2 whitespace-nowrap ${activeTab === 'scope' ? 'border-[#0b2447] text-[#0b2447]' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
                                    >
                                        Deliverables & SLA
                                    </button>
                                    <button
                                        onClick={() => setActiveTab('pricing')}
                                        className={`pb-3 px-3 text-xs font-extrabold transition-all border-b-2 whitespace-nowrap ${activeTab === 'pricing' ? 'border-[#0b2447] text-[#0b2447]' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
                                    >
                                        Pricing Details
                                    </button>
                                    <button
                                        onClick={() => setActiveTab('provider')}
                                        className={`pb-3 px-3 text-xs font-extrabold transition-all border-b-2 whitespace-nowrap ${activeTab === 'provider' ? 'border-[#0b2447] text-[#0b2447]' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
                                    >
                                        Provider Compliance
                                    </button>
                                </div>

                                {/* TAB 1: OVERVIEW */}
                                {activeTab === 'overview' && (
                                    <div className="space-y-4 animate-in fade-in duration-200">
                                        <div className="grid gap-3 text-xs sm:grid-cols-2 lg:grid-cols-3">
                                            {overviewFields.map(({ label, value }) => (
                                                <div key={label} className="rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-2xs">
                                                    <span className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400">{label}</span>
                                                    <span className="mt-1 block font-bold text-slate-800 text-wrap-anywhere">{String(value ?? '—')}</span>
                                                </div>
                                            ))}
                                        </div>

                                        {service.description && (
                                            <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-2xs space-y-2">
                                                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-700">Full Service Description</h3>
                                                <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-line">{service.description}</p>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* TAB 2: DELIVERABLES & SLA */}
                                {activeTab === 'scope' && (
                                    <div className="space-y-4 animate-in fade-in duration-200">
                                        {scopeFields.length > 0 ? (
                                            <div className="grid gap-3 text-xs sm:grid-cols-2">
                                                {scopeFields.map(({ label, value }) => (
                                                    <div key={label} className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-2xs space-y-1">
                                                        <span className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400">{label}</span>
                                                        <span className="block font-bold text-slate-800 whitespace-pre-line leading-relaxed">{String(value)}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="rounded-xl border border-dashed border-slate-200 bg-white p-6 text-center text-xs font-semibold text-slate-500">
                                                Standard service terms apply. Contact service provider for detailed scope of work specification sheet.
                                            </div>
                                        )}

                                        {serviceAny.specifications?.length > 0 && (
                                            <div className="space-y-2">
                                                <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">Service Parameters & SLA Table</h4>
                                                <div className="bg-white rounded-xl border border-slate-200/80 overflow-hidden shadow-2xs">
                                                    <table className="w-full text-xs">
                                                        <thead>
                                                            <tr className="bg-slate-100/70 border-b border-slate-200 text-[#0b2447]">
                                                                <th className="px-4 py-3 text-left font-extrabold">Parameter</th>
                                                                <th className="px-4 py-3 text-left font-extrabold">Value / SLA</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-slate-100">
                                                            {serviceAny.specifications.map((spec: any, i: number) => (
                                                                <tr key={spec.id || i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                                                                    <td className="px-4 py-3 font-semibold text-slate-700 w-1/3 border-r border-slate-100">{spec.name}</td>
                                                                    <td className="px-4 py-3 font-bold text-slate-900">{spec.value}{spec.unit ? ` ${spec.unit}` : ''}</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* TAB 3: PRICING DETAILS */}
                                {activeTab === 'pricing' && (
                                    <div className="space-y-4 animate-in fade-in duration-200">
                                        <div className="grid gap-3 text-xs sm:grid-cols-2 lg:grid-cols-3">
                                            {pricingFields.map(({ label, value }) => (
                                                <div key={label} className="rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-2xs">
                                                    <span className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400">{label}</span>
                                                    <span className="mt-1 block font-bold text-slate-800">{String(value)}</span>
                                                </div>
                                            ))}
                                        </div>

                                        <div className="p-4 rounded-xl border border-blue-200/80 bg-blue-50/50 text-xs space-y-1.5">
                                            <h4 className="font-extrabold text-[#0b2447] flex items-center gap-1.5">
                                                <Info className="h-4 w-4 text-blue-600" /> Commercial Service Terms
                                            </h4>
                                            <p className="text-slate-600 leading-relaxed">
                                                Final engagement costs may vary depending on project scope, duration, site location, and specific custom requirements agreed upon via quote request.
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {/* TAB 4: PROVIDER COMPLIANCE */}
                                {activeTab === 'provider' && (
                                    <div className="space-y-4 animate-in fade-in duration-200">
                                        <div className="rounded-xl border border-slate-200/80 bg-white p-5 space-y-4 shadow-2xs">
                                            <div className="flex items-center gap-3">
                                                <div className="p-3 rounded-xl bg-emerald-50 text-emerald-700">
                                                    <ShieldCheck className="h-6 w-6" />
                                                </div>
                                                <div>
                                                    <h4 className="text-sm font-extrabold text-slate-900">
                                                        {service.organization?.organizationName || service.seller?.name || 'Verified Provider'}
                                                    </h4>
                                                    <p className="text-xs text-slate-500 font-medium">MSME Registered Service Provider Profile</p>
                                                </div>
                                            </div>

                                            <div className="grid gap-3 text-xs sm:grid-cols-2 pt-2 border-t border-slate-100">
                                                <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
                                                    <span className="text-[10px] font-extrabold uppercase text-slate-400">Verification Status</span>
                                                    <p className="mt-0.5 font-extrabold text-emerald-700 flex items-center gap-1">
                                                        <BadgeCheck className="h-4 w-4" /> {isVerified ? 'VERIFIED PROVIDER' : 'UNDER VERIFICATION'}
                                                    </p>
                                                </div>
                                                <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
                                                    <span className="text-[10px] font-extrabold uppercase text-slate-400">Service Area</span>
                                                    <p className="mt-0.5 font-extrabold text-slate-800">{service.serviceArea || location || 'State / National Coverage'}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Uploaded Documents and Certifications */}
                            <div className="pt-6 border-t border-slate-200/80">
                                <div className="flex items-center justify-between mb-4">
                                    <div>
                                        <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                                            <FileText className="h-5 w-5 text-[#0b2447]" /> Provider Certifications & Documents
                                        </h3>
                                        <p className="text-xs text-slate-500 font-medium">Licenses, compliance certificates, and service brochures.</p>
                                    </div>
                                    <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
                                        {serviceDocuments.length} Attachments
                                    </span>
                                </div>

                                {serviceDocuments.length > 0 ? (
                                    <div className="grid gap-3 sm:grid-cols-2">
                                        {serviceDocuments.map((cert: any) => {
                                            return (
                                                <div
                                                    key={cert.id}
                                                    className="group flex items-start gap-3 rounded-xl border border-slate-200/80 bg-white p-3.5 text-xs shadow-2xs hover:border-[#0b2447]/30 transition"
                                                >
                                                    <BadgeCheck className="h-5 w-5 shrink-0 text-emerald-600 mt-0.5" />
                                                    <div className="min-w-0 flex-1">
                                                        <span className="block truncate font-extrabold text-slate-900 group-hover:text-[#0b2447] transition">
                                                            {cert.name || cert.fileAsset?.originalName || 'Service Document'}
                                                        </span>
                                                        <span className="mt-0.5 block text-[10px] font-semibold text-slate-500">
                                                            {cert.issuingAuthority ? `${cert.issuingAuthority} • ` : ''}{cert.verificationStatus || 'VERIFIED'}
                                                        </span>
                                                        {cert.fileAsset?.url && (
                                                            <button
                                                                type="button"
                                                                onClick={() => openFileAsset(cert.fileAsset, cert.name || 'Document').catch(err => toast.error(err instanceof Error ? err.message : 'Unable to open file'))}
                                                                className="mt-2 inline-flex items-center gap-1 text-[11px] font-extrabold text-[#0b2447] hover:underline"
                                                            >
                                                                View / Open Document <ExternalLink className="h-3 w-3" />
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-8 text-center text-xs font-semibold text-slate-500">
                                        No certification attachments submitted for this service yet.
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* COLUMN 3: Sidebar Actions */}
                        {user?.role !== 'seller' && (
                            <div className="lg:col-span-1">
                                <div className="sticky top-20 bg-white rounded-2xl border border-slate-200/90 p-5 space-y-5 shadow-md">
                                    <div>
                                        <h3 className="text-sm font-extrabold text-slate-900">Service Procurement</h3>
                                        <p className="text-[11px] font-medium leading-relaxed text-slate-500 mt-1">
                                            Request custom quote, submit scope requirements, or bookmark vendor.
                                        </p>
                                    </div>

                                    {/* Pricing Box */}
                                    <div className="p-4 rounded-xl border border-slate-100 bg-slate-50/80 space-y-1">
                                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Pricing Basis</span>
                                        {service.basePrice ? (
                                            <div>
                                                <span className="text-2xl font-black text-[#0b2447]">
                                                    ₹{Number(service.basePrice).toLocaleString('en-IN')}
                                                </span>
                                                <p className="text-[10px] font-bold text-slate-500 mt-0.5">
                                                    {pricingLabels[service.pricingModel] || 'Per engagement'}
                                                </p>
                                            </div>
                                        ) : (
                                            <p className="text-xs font-extrabold text-amber-800 bg-amber-50 px-3 py-2 rounded-lg border border-amber-200 text-center">
                                                Custom Quote Required
                                            </p>
                                        )}
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="space-y-3">
                                        <button
                                            onClick={handleRequestQuote}
                                            className="w-full inline-flex items-center justify-center gap-2 h-11 rounded-xl bg-[#0b2447] text-white text-xs font-extrabold shadow-md shadow-[#0b2447]/15 hover:bg-[#12335f] active:scale-[0.98] transition-all"
                                        >
                                            <FileText className="h-4 w-4" /> Request Custom Quote
                                        </button>

                                        <button
                                            type="button"
                                            onClick={handleSaveSupplier}
                                            className="w-full inline-flex items-center justify-center gap-2 h-10 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-extrabold hover:bg-slate-50 transition"
                                        >
                                            <BookmarkPlus className="h-4 w-4 text-[#0b2447]" /> Save Service Provider
                                        </button>

                                        {cartQuantity > 0 ? (
                                            <div className="w-full inline-flex items-center justify-between h-11 rounded-xl border-2 border-[#0b2447] bg-white overflow-hidden shadow-sm">
                                                <button
                                                    onClick={() => handleQuantityChange(-1)}
                                                    className="w-12 h-full flex items-center justify-center bg-slate-50 hover:bg-slate-100 text-[#0b2447] font-bold text-lg transition"
                                                >
                                                    −
                                                </button>
                                                <div className="flex-1 flex items-center justify-center text-[#0b2447] font-extrabold text-xs">
                                                    {cartQuantity} in requirements
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
                                                className="w-full inline-flex items-center justify-center gap-2 h-10 rounded-xl border-2 border-[#0b2447] text-[#0b2447] text-xs font-extrabold hover:bg-[#0b2447] hover:text-white active:scale-[0.98] transition-all"
                                            >
                                                <ShoppingCart className="h-4 w-4" /> Add to Service Requirements
                                            </button>
                                        )}
                                    </div>

                                    {/* Service Guarantee Card */}
                                    <div className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/70 text-[11px] space-y-2">
                                        <div className="flex items-center gap-2 text-slate-700 font-bold">
                                            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" /> Verified MSME Service Provider
                                        </div>
                                        <div className="flex items-center gap-2 text-slate-700 font-bold">
                                            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" /> Audit-Logged Procurement RFQs
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Related Services */}
                    {related.length > 0 && (
                        <div className="mt-14 pt-8 border-t border-slate-200/80">
                            <h3 className="text-base font-extrabold text-slate-900 mb-4 flex items-center gap-2">
                                <Sparkles className="h-5 w-5 text-amber-500" /> Related Services in Category
                            </h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                {related.map((s: any) => (
                                    <Link
                                        key={s.id}
                                        href={`/marketplace/services/${s.id}`}
                                        className="group bg-white rounded-xl border border-slate-200/80 p-3.5 hover:shadow-md hover:border-slate-300 transition-all flex flex-col justify-between space-y-3"
                                    >
                                        <div className="space-y-2">
                                            <div className="h-32 rounded-lg bg-slate-50 flex items-center justify-center overflow-hidden relative">
                                                {resolveMarketplaceImage(s, 'service') ? (
                                                    <img src={resolveMarketplaceImage(s, 'service')} alt={s.name} className="h-full w-full object-cover group-hover:scale-105 transition" />
                                                ) : (
                                                    <Wrench className="h-10 w-10 text-slate-300" />
                                                )}
                                            </div>
                                            <h4 className="text-xs font-extrabold text-slate-900 line-clamp-2 group-hover:text-[#0b2447] transition">{s.name}</h4>
                                            <p className="text-[10px] font-semibold text-slate-500 truncate">{s.organization?.organizationName || 'Verified Provider'}</p>
                                        </div>
                                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                                            <span className="text-[10px] font-extrabold text-[#0b2447] bg-[#0b2447]/5 px-2 py-0.5 rounded">
                                                {pricingLabels[s.pricingModel] || 'Quote Based'}
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

            {/* Sticky Mobile Procurement Action Bar */}
            {user?.role !== 'seller' && (
                <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/90 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:hidden shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
                    <div className="flex items-center gap-3">
                        <div className="min-w-0 flex-1">
                            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Service Fee</span>
                            {service.basePrice ? (
                                <div className="truncate">
                                    <span className="text-base font-black text-[#0b2447]">₹{Number(service.basePrice).toLocaleString('en-IN')}</span>
                                    <span className="text-[10px] font-semibold text-slate-500 block truncate">{pricingLabels[service.pricingModel] || 'Per engagement'}</span>
                                </div>
                            ) : (
                                <span className="text-xs font-black text-amber-700">Quote Based</span>
                            )}
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                            <button
                                type="button"
                                onClick={handleRequestQuote}
                                className="h-10 px-4 rounded-xl bg-[#0b2447] text-white font-black text-xs uppercase tracking-wider shadow-md active:scale-95 transition"
                            >
                                Request Quote
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {!useDashboardShell && <MarketplaceFooter />}
        </div>
    );
}
