'use client';
import React, { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '../../../hooks/useAuth';
import { toast } from 'sonner';
import { api, readJsonResponse, unwrapApiData, resolveMediaUrl } from '../../../lib/api';
import { MarketplaceFooter } from '../components/MarketplaceFooter';
import {
    Building2, MapPin, Package, Wrench, BadgeCheck,
    ArrowLeft, Search, ChevronRight,
    MessageSquare, Loader2, Bookmark, BookmarkCheck,
    SlidersHorizontal, ArrowUpDown, X, User, RotateCcw,
    ShieldCheck, Mail, Phone, Globe
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { MarketplaceItemCard } from '../components/MarketplaceItemCard';
import { saveSupplier, removeSavedSupplier, isSupplierSaved } from '../utils/savedSuppliers';

export default function MarketplaceSellerStore() {
    const { user } = useAuth();
    const pathname = usePathname() || '';
    const router = useRouter();
    const sellerId = Number(pathname.split('/').pop());

    const [tab, setTab] = useState<'products' | 'services' | 'about'>('products');

    // Filters
    const [q, setQ] = useState('');
    const [catId, setCatId] = useState('');
    const [sortBy, setSortBy] = useState('latest');
    const [minP, setMinP] = useState('');
    const [maxP, setMaxP] = useState('');
    const [isSaved, setIsSaved] = useState(false);

    const { data: storeData, isLoading: loading } = useQuery({
        queryKey: ['sellerStore', sellerId],
        queryFn: async () => {
            if (!sellerId || sellerId < 1) throw new Error('Invalid seller ID');
            const [vRes, pRes, sRes] = await Promise.all([
                api.get(`/api/marketplace/sellers/${sellerId}`)
                    .then(r => readJsonResponse(r))
                    .then(b => b && b.success !== false ? unwrapApiData(b) : null)
                    .catch(() => null),
                api.get(`/api/products/search?organizationId=${sellerId}&take=48`)
                    .then(r => readJsonResponse(r))
                    .then(b => unwrapApiData<any>(b))
                    .catch(() => ({ products: [] })),
                api.get(`/api/services/search?organizationId=${sellerId}&take=48`)
                    .then(r => readJsonResponse(r))
                    .then(b => unwrapApiData<any>(b))
                    .catch(() => ({ services: [] })),
            ]);
            return {
                vendor: vRes,
                products: Array.isArray(pRes?.records) ? pRes.records : (pRes?.products || []),
                services: Array.isArray(sRes?.records) ? sRes.records : (sRes?.services || []),
            };
        },
        enabled: !!sellerId && sellerId > 0,
        staleTime: 5 * 60 * 1000,
    });

    const vendor = storeData?.vendor || null;
    const products = useMemo(() => storeData?.products || [], [storeData?.products]);
    const services = useMemo(() => storeData?.services || [], [storeData?.services]);

    useEffect(() => {
        if (vendor?.id) {
            setIsSaved(isSupplierSaved(vendor.id));
        }
    }, [vendor?.id]);

    const profile = vendor?.sellerProfile || {};
    const office = profile.offices?.[0] || {};
    const loc = [office.city, office.state].filter(Boolean).join(', ') || vendor?.city || '';
    const name = profile.businessName || vendor?.name || 'Seller';
    const initial = name.charAt(0).toUpperCase();
    const sellerUserId = Number(vendor?.sellerUserId || 0);

    // Extract unique categories from products
    const availableCategories = useMemo(() => {
        const catMap = new Map<string, { id: string; name: string; count: number }>();
        products.forEach((p: any) => {
            const id = p.categoryId ? String(p.categoryId) : (p.category?.id ? String(p.category.id) : '');
            const cName = p.category?.name || p.categoryName || (p.category && typeof p.category === 'string' ? p.category : '');
            if (id && cName) {
                const existing = catMap.get(id);
                if (existing) {
                    existing.count += 1;
                } else {
                    catMap.set(id, { id, name: cName, count: 1 });
                }
            }
        });
        return Array.from(catMap.values());
    }, [products]);

    const getEffectivePrice = (p: any) => {
        const discount = Number(p.discountPrice);
        if (!isNaN(discount) && discount > 0) return discount;
        return Number(p.price || 0);
    };

    const filteredProducts = useMemo(() => {
        return products.filter((p: any) => {
            if (q) {
                const query = q.toLowerCase();
                const matchesName = p.name?.toLowerCase().includes(query);
                const matchesDesc = p.description?.toLowerCase().includes(query);
                const matchesBrand = p.brand?.toLowerCase().includes(query);
                if (!matchesName && !matchesDesc && !matchesBrand) return false;
            }
            if (catId) {
                const pCatId = String(p.categoryId || p.category?.id || '');
                if (pCatId !== catId) return false;
            }
            const effPrice = getEffectivePrice(p);
            if (minP && effPrice < Number(minP)) return false;
            if (maxP && effPrice > Number(maxP)) return false;
            return true;
        }).sort((a: any, b: any) => {
            if (sortBy === 'price_asc') return getEffectivePrice(a) - getEffectivePrice(b);
            if (sortBy === 'price_desc') return getEffectivePrice(b) - getEffectivePrice(a);
            if (sortBy === 'name') return (a.name || '').localeCompare(b.name || '');
            if (sortBy === 'name_desc') return (b.name || '').localeCompare(a.name || '');
            return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
        });
    }, [products, q, catId, minP, maxP, sortBy]);

    const filteredServices = useMemo(() => {
        return services.filter((s: any) => {
            if (q) {
                const query = q.toLowerCase();
                const matchesName = s.name?.toLowerCase().includes(query);
                const matchesDesc = s.description?.toLowerCase().includes(query);
                if (!matchesName && !matchesDesc) return false;
            }
            return true;
        });
    }, [services, q]);

    const hasActiveFilters = Boolean(q || catId || minP || maxP || sortBy !== 'latest');

    const handleClearFilters = () => {
        setQ('');
        setCatId('');
        setMinP('');
        setMaxP('');
        setSortBy('latest');
    };

    const handleToggleSaveSupplier = () => {
        if (!vendor) return;
        if (isSaved) {
            removeSavedSupplier(vendor.id);
            setIsSaved(false);
            toast.info('Supplier removed from saved list');
        } else {
            saveSupplier({
                id: vendor.id,
                sellerUserId: sellerUserId || null,
                name,
                location: loc,
                verificationStatus: vendor.verificationStatus || 'REGISTERED',
                email: vendor.email,
                mobile: vendor.mobile,
                source: 'Seller store',
            });
            setIsSaved(true);
            toast.success('Supplier saved successfully');
        }
    };

    const handleMessageSeller = () => {
        if (sellerUserId) {
            router.push(`/buyer/messages?sellerId=${sellerUserId}&subject=${encodeURIComponent(`Supplier inquiry: ${name}`)}`);
        } else {
            toast.error('Seller messaging is currently unavailable for this store.');
        }
    };

    if (loading) {
        return (
            <div className="min-h-dvh bg-slate-50 flex flex-col font-sans">
                <main className="flex-1 max-w-7xl mx-auto px-4 py-16 w-full flex flex-col items-center justify-center">
                    <div className="flex flex-col items-center gap-4 bg-white p-8 sm:p-12 rounded-2xl border border-slate-200 shadow-sm max-w-md w-full text-center">
                        <div className="relative flex items-center justify-center">
                            <div className="absolute h-16 w-16 rounded-full bg-blue-100 animate-ping opacity-30" />
                            <Loader2 className="h-10 w-10 animate-spin text-[#0b2447]" />
                        </div>
                        <div className="space-y-1 mt-2">
                            <h3 className="text-base font-black text-[#0b2447]">Loading Seller Store</h3>
                            <p className="text-xs font-semibold text-slate-500">Fetching products, services, and seller profile...</p>
                        </div>
                    </div>
                </main>
                <MarketplaceFooter />
            </div>
        );
    }

    if (!vendor) {
        return (
            <div className="min-h-dvh bg-white flex flex-col">
                <main className="flex-1 flex items-center justify-center px-4">
                    <div className="text-center max-w-md mx-auto p-8 rounded-2xl border border-slate-200 bg-white shadow-sm">
                        <Building2 className="h-16 w-16 text-slate-300 mx-auto mb-4" />
                        <h2 className="text-lg font-bold text-slate-800 mb-2">Seller Store Not Found</h2>
                        <p className="text-xs text-slate-500 mb-6">The requested seller profile does not exist or may have been deactivated.</p>
                        <Link href="/marketplace/sellers" className="inline-flex items-center gap-2 h-10 px-5 rounded-xl bg-[#0b2447] text-white text-xs font-bold uppercase tracking-wider hover:bg-[#12335f] transition shadow-sm">
                            <ArrowLeft className="h-4 w-4" /> Back to Verified Sellers
                        </Link>
                    </div>
                </main>
                <MarketplaceFooter />
            </div>
        );
    }

    return (
        <div className="min-h-dvh bg-slate-50/60 flex flex-col font-sans">
            <main className="flex-1 pb-16">
                {/* Breadcrumb Navigation */}
                <nav aria-label="Breadcrumb" className="bg-white/90 backdrop-blur-md border-b border-slate-200/70 sticky top-0 z-20 shadow-xs">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-2 text-xs text-slate-500 font-medium">
                        <Link href="/" className="hover:text-[#0b2447] transition">Home</Link>
                        <ChevronRight className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <Link href="/marketplace/sellers" className="hover:text-[#0b2447] transition">Verified Sellers</Link>
                        <ChevronRight className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <span className="text-slate-800 font-bold truncate max-w-[240px] sm:max-w-none">{name}</span>
                    </div>
                </nav>

                {/* Seller Hero Header */}
                <section aria-label="Seller Information" className="bg-white border-b border-slate-200 shadow-xs">
                    {/* Banner Area */}
                    <div className="w-full h-44 sm:h-56 md:h-64 relative overflow-hidden bg-gradient-to-r from-[#07172e] via-[#0b2447] to-[#173a6b]">
                        {vendor.bannerUrl ? (
                            <img
                                src={resolveMediaUrl(vendor.bannerUrl) || ''}
                                alt={`${name} Store Banner`}
                                referrerPolicy="no-referrer"
                                crossOrigin="anonymous"
                                className="w-full h-full object-cover"
                            />
                        ) : (
                            <>
                                <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_25%,rgba(59,130,246,0.18),transparent_50%)]" />
                                <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent_40%,rgba(7,23,46,0.65))]" />
                                <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px]" />
                            </>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-slate-950/25 to-transparent" />

                        {/* Back Button overlay */}
                        <div className="absolute top-4 left-4 z-10">
                            <button
                                onClick={() => router.back()}
                                className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-slate-900/60 hover:bg-slate-900/80 border border-white/20 px-3.5 py-1.5 rounded-xl backdrop-blur-md transition-all shadow-sm active:scale-95 cursor-pointer"
                                aria-label="Go back to previous page"
                            >
                                <ArrowLeft className="h-3.5 w-3.5" /> Back
                            </button>
                        </div>
                    </div>

                    {/* Profile Header Details with Overlapping Logo */}
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-6 pt-14 sm:pt-16 relative">
                        {/* Logo Box */}
                        <div className="absolute -top-14 sm:-top-16 left-4 sm:left-6 w-24 h-24 sm:w-32 sm:h-32 rounded-2xl bg-white border-2 border-white shadow-xl flex items-center justify-center p-2 z-10">
                            {vendor.logoUrl ? (
                                <img
                                    src={resolveMediaUrl(vendor.logoUrl) || ''}
                                    alt={`${name} Logo`}
                                    className="w-full h-full object-contain rounded-xl bg-white"
                                />
                            ) : (
                                <div className="w-full h-full rounded-xl flex items-center justify-center text-3xl sm:text-4xl font-black bg-gradient-to-br from-blue-50 to-indigo-100 text-[#0b2447] border border-blue-100 shadow-inner">
                                    {initial}
                                </div>
                            )}
                        </div>

                        {/* Content Grid */}
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pl-0 sm:pl-36 lg:pl-40 pt-2 sm:pt-0">
                            <div className="min-w-0 space-y-2.5 flex-1">
                                {/* Badges */}
                                <div className="flex flex-wrap items-center gap-2">
                                    {vendor.verificationStatus === 'VERIFIED' ? (
                                        <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-blue-700 shadow-2xs">
                                            <ShieldCheck className="h-3.5 w-3.5 text-blue-600" /> Verified Seller
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-amber-700 shadow-2xs">
                                            Registered Seller
                                        </span>
                                    )}
                                    {profile.isUdyamCertified && (
                                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-emerald-700 shadow-2xs">
                                            <BadgeCheck className="h-3.5 w-3.5 text-emerald-600" /> Udyam Certified
                                        </span>
                                    )}
                                    {profile.msmeCategory && (
                                        <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold text-slate-700">
                                            MSME: {profile.msmeCategory}
                                        </span>
                                    )}
                                </div>

                                <h1 className="text-xl sm:text-2xl md:text-3xl font-black tracking-tight text-slate-900 leading-tight">
                                    {name}
                                </h1>

                                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 font-medium">
                                    {vendor.sellerName && (
                                        <span className="inline-flex items-center gap-1.5 bg-slate-100/90 px-2.5 py-1 rounded-lg border border-slate-200/80">
                                            <User className="h-3.5 w-3.5 text-blue-600" />
                                            Representative: <strong className="text-slate-800">{vendor.sellerName}</strong>
                                        </span>
                                    )}
                                    {loc && (
                                        <span className="inline-flex items-center gap-1 bg-slate-100/90 px-2.5 py-1 rounded-lg border border-slate-200/80">
                                            <MapPin className="h-3.5 w-3.5 text-orange-500" />
                                            {loc}
                                        </span>
                                    )}
                                    {profile.organizationType && (
                                        <span className="inline-flex items-center gap-1 bg-slate-100/90 px-2.5 py-1 rounded-lg border border-slate-200/80">
                                            <Building2 className="h-3.5 w-3.5 text-slate-500" />
                                            {profile.organizationType.replace(/_/g, ' ')}
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Right Side: Action Buttons & Stats */}
                            <div className="flex flex-wrap items-center gap-4 shrink-0 mt-2 lg:mt-0">
                                {/* Action Buttons: Message Seller and Save Supplier */}
                                <div className="flex items-center gap-2.5">
                                    <button
                                        type="button"
                                        onClick={handleMessageSeller}
                                        className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-xl bg-[#0b2447] text-white text-xs font-bold uppercase tracking-wider hover:bg-[#12335f] active:scale-95 transition-all shadow-sm cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0b2447] focus-visible:ring-offset-2"
                                    >
                                        <MessageSquare className="h-4 w-4" />
                                        <span>Message Seller</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={handleToggleSaveSupplier}
                                        className={`inline-flex items-center justify-center gap-2 h-10 px-4 rounded-xl border text-xs font-bold uppercase tracking-wider active:scale-95 transition-all shadow-xs cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${
                                            isSaved
                                                ? 'bg-blue-50 border-blue-300 text-blue-700 hover:bg-blue-100'
                                                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300'
                                        }`}
                                    >
                                        {isSaved ? (
                                            <>
                                                <BookmarkCheck className="h-4 w-4 text-blue-600 fill-blue-600" />
                                                <span>Saved</span>
                                            </>
                                        ) : (
                                            <>
                                                <Bookmark className="h-4 w-4 text-slate-500" />
                                                <span>Save Supplier</span>
                                            </>
                                        )}
                                    </button>
                                </div>

                                {/* Stats Badges */}
                                <div className="flex items-center gap-2.5 border-l border-slate-200 pl-4">
                                    <div className="text-center min-w-[76px] px-3 py-2 bg-slate-50 border border-slate-200/90 rounded-xl shadow-2xs">
                                        <p className="text-xl font-black text-[#0b2447] leading-none">{products.length}</p>
                                        <p className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400 mt-1">Products</p>
                                    </div>
                                    <div className="text-center min-w-[76px] px-3 py-2 bg-slate-50 border border-slate-200/90 rounded-xl shadow-2xs">
                                        <p className="text-xl font-black text-[#0b2447] leading-none">{services.length}</p>
                                        <p className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400 mt-1">Services</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Tabs Bar */}
                <div className="bg-white border-b border-slate-200 sticky top-[45px] z-10 shadow-xs">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center gap-1 overflow-x-auto scrollbar-none">
                        {([
                            ['products', `Products (${products.length})`, Package],
                            ['services', `Services (${services.length})`, Wrench],
                            ['about', 'About Seller', Building2]
                        ] as const).map(([id, label, Icon]) => (
                            <button
                                key={id}
                                onClick={() => setTab(id)}
                                className={`relative h-12 px-5 text-xs font-black uppercase tracking-wider border-b-2 flex items-center gap-2 whitespace-nowrap transition-all duration-200 cursor-pointer ${
                                    tab === id
                                        ? 'border-[#0b2447] text-[#0b2447]'
                                        : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
                                }`}
                            >
                                <Icon className={`h-4 w-4 ${tab === id ? 'text-[#0b2447]' : 'text-slate-400'}`} />
                                <span>{label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Main Content Area */}
                <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
                    {/* Search & Filter Bar Section */}
                    {tab !== 'about' && (
                        <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 mb-6 shadow-sm">
                            {tab === 'products' ? (
                                <div className="space-y-4">
                                    {/* Primary Filter Row */}
                                    <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3">
                                        {/* Search Input */}
                                        <div className="relative flex-1 min-w-[240px]">
                                            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                                <Search className="h-4 w-4 text-slate-400" />
                                            </div>
                                            <input
                                                type="text"
                                                value={q}
                                                onChange={e => setQ(e.target.value)}
                                                placeholder="Search products by name, brand, or specifications..."
                                                className="w-full h-11 pl-10 pr-9 rounded-xl border border-slate-200 bg-slate-50/60 text-sm font-medium text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0b2447]/15 focus:border-[#0b2447] transition-all"
                                                aria-label="Search products"
                                            />
                                            {q && (
                                                <button
                                                    type="button"
                                                    onClick={() => setQ('')}
                                                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition"
                                                    aria-label="Clear search query"
                                                >
                                                    <X className="h-4 w-4" />
                                                </button>
                                            )}
                                        </div>

                                        {/* Filters Cluster: Category, Price Range, Sort */}
                                        <div className="flex flex-wrap items-center gap-2.5">
                                            {/* Category Filter */}
                                            {availableCategories.length > 0 && (
                                                <div className="relative min-w-[140px] sm:min-w-[160px] flex-1 sm:flex-initial">
                                                    <select
                                                        value={catId}
                                                        onChange={e => setCatId(e.target.value)}
                                                        className="w-full h-11 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0b2447]/15 focus:border-[#0b2447] transition-all cursor-pointer"
                                                        aria-label="Filter by category"
                                                    >
                                                        <option value="">All Categories ({products.length})</option>
                                                        {availableCategories.map(c => (
                                                            <option key={c.id} value={c.id}>
                                                                {c.name} ({c.count})
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>
                                            )}

                                            {/* Inline Price Range Inputs */}
                                            <div className="flex items-center gap-1.5 bg-slate-50/80 border border-slate-200 rounded-xl px-2.5 py-1 h-11 shrink-0">
                                                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Price:</span>
                                                <div className="relative w-20 sm:w-24">
                                                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">₹</span>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        value={minP}
                                                        onChange={e => setMinP(e.target.value)}
                                                        placeholder="Min"
                                                        className="w-full h-8 pl-5 pr-1 text-xs font-semibold bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                        aria-label="Minimum price in Rupees"
                                                    />
                                                </div>
                                                <span className="text-slate-300 font-bold">-</span>
                                                <div className="relative w-20 sm:w-24">
                                                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">₹</span>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        value={maxP}
                                                        onChange={e => setMaxP(e.target.value)}
                                                        placeholder="Max"
                                                        className="w-full h-8 pl-5 pr-1 text-xs font-semibold bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                                                        aria-label="Maximum price in Rupees"
                                                    />
                                                </div>
                                            </div>

                                            {/* Sort Select */}
                                            <div className="relative min-w-[140px] sm:min-w-[155px] flex-1 sm:flex-initial">
                                                <select
                                                    value={sortBy}
                                                    onChange={e => setSortBy(e.target.value)}
                                                    className="w-full h-11 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0b2447]/15 focus:border-[#0b2447] transition-all cursor-pointer"
                                                    aria-label="Sort products by"
                                                >
                                                    <option value="latest">Sort: Latest First</option>
                                                    <option value="price_asc">Price: Low to High</option>
                                                    <option value="price_desc">Price: High to Low</option>
                                                    <option value="name">Name: A–Z</option>
                                                    <option value="name_desc">Name: Z–A</option>
                                                </select>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Active Filter Chips & Summary */}
                                    {hasActiveFilters && (
                                        <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-100">
                                            <div className="flex flex-wrap items-center gap-1.5">
                                                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1">
                                                    Active Filters:
                                                </span>
                                                {q && (
                                                    <span className="inline-flex items-center gap-1 bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold px-2.5 py-1 rounded-lg">
                                                        <span>Query: &ldquo;{q}&rdquo;</span>
                                                        <button type="button" onClick={() => setQ('')} className="hover:text-blue-900 transition ml-0.5">
                                                            <X className="h-3.5 w-3.5" />
                                                        </button>
                                                    </span>
                                                )}
                                                {catId && (
                                                    <span className="inline-flex items-center gap-1 bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-semibold px-2.5 py-1 rounded-lg">
                                                        <span>Category: {availableCategories.find(c => c.id === catId)?.name || catId}</span>
                                                        <button type="button" onClick={() => setCatId('')} className="hover:text-indigo-900 transition ml-0.5">
                                                            <X className="h-3.5 w-3.5" />
                                                        </button>
                                                    </span>
                                                )}
                                                {(minP || maxP) && (
                                                    <span className="inline-flex items-center gap-1 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold px-2.5 py-1 rounded-lg">
                                                        <span>Price: ₹{minP || 0} &ndash; ₹{maxP || '∞'}</span>
                                                        <button type="button" onClick={() => { setMinP(''); setMaxP(''); }} className="hover:text-emerald-900 transition ml-0.5">
                                                            <X className="h-3.5 w-3.5" />
                                                        </button>
                                                    </span>
                                                )}
                                                {sortBy !== 'latest' && (
                                                    <span className="inline-flex items-center gap-1 bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold px-2.5 py-1 rounded-lg">
                                                        <span>Sort: {sortBy.replace('_', ' ')}</span>
                                                        <button type="button" onClick={() => setSortBy('latest')} className="hover:text-slate-900 transition ml-0.5">
                                                            <X className="h-3.5 w-3.5" />
                                                        </button>
                                                    </span>
                                                )}
                                            </div>

                                            <button
                                                type="button"
                                                onClick={handleClearFilters}
                                                className="inline-flex items-center gap-1 text-xs font-bold text-rose-600 hover:text-rose-700 hover:underline transition cursor-pointer"
                                            >
                                                <RotateCcw className="h-3.5 w-3.5" /> Reset all filters
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                /* Services Search Bar */
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                        <Search className="h-4 w-4 text-slate-400" />
                                    </div>
                                    <input
                                        type="text"
                                        value={q}
                                        onChange={e => setQ(e.target.value)}
                                        placeholder="Search services by title, skill, or scope of work..."
                                        className="w-full h-11 pl-10 pr-9 rounded-xl border border-slate-200 bg-slate-50/60 text-sm font-medium text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0b2447]/15 focus:border-[#0b2447] transition-all"
                                        aria-label="Search services"
                                    />
                                    {q && (
                                        <button
                                            type="button"
                                            onClick={() => setQ('')}
                                            className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition"
                                            aria-label="Clear service search"
                                        >
                                            <X className="h-4 w-4" />
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── Products Tab View ── */}
                    {tab === 'products' && (
                        <div>
                            <div className="flex items-center justify-between mb-4">
                                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                                    Showing <span className="text-slate-800 font-extrabold">{filteredProducts.length}</span> of {products.length} product{products.length !== 1 ? 's' : ''}
                                </p>
                            </div>

                            {filteredProducts.length === 0 ? (
                                <div className="text-center py-16 px-4 bg-white rounded-2xl border border-slate-200/90 shadow-sm">
                                    <Package className="h-12 w-12 text-slate-300 mx-auto mb-3 animate-pulse" />
                                    <h3 className="text-base font-bold text-slate-800">No Products Matching Criteria</h3>
                                    <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                                        No items were found matching your current search or price filters. Try adjusting your query.
                                    </p>
                                    {hasActiveFilters && (
                                        <button
                                            type="button"
                                            onClick={handleClearFilters}
                                            className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0b2447] text-white text-xs font-bold uppercase tracking-wider hover:bg-[#12335f] transition shadow-xs cursor-pointer"
                                        >
                                            <RotateCcw className="h-3.5 w-3.5" /> Clear All Filters
                                        </button>
                                    )}
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
                                    {filteredProducts.map((p: any) => (
                                        <MarketplaceItemCard key={p.id} item={p} itemType="product" className="w-full" />
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── Services Tab View ── */}
                    {tab === 'services' && (
                        <div>
                            <div className="flex items-center justify-between mb-4">
                                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                                    Showing <span className="text-slate-800 font-extrabold">{filteredServices.length}</span> of {services.length} service{services.length !== 1 ? 's' : ''}
                                </p>
                            </div>

                            {filteredServices.length === 0 ? (
                                <div className="text-center py-16 px-4 bg-white rounded-2xl border border-slate-200/90 shadow-sm">
                                    <Wrench className="h-12 w-12 text-slate-300 mx-auto mb-3 animate-pulse" />
                                    <h3 className="text-base font-bold text-slate-800">No Services Available</h3>
                                    <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                                        This seller has not listed any services matching your search terms.
                                    </p>
                                    {q && (
                                        <button
                                            type="button"
                                            onClick={() => setQ('')}
                                            className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0b2447] text-white text-xs font-bold uppercase tracking-wider hover:bg-[#12335f] transition shadow-xs cursor-pointer"
                                        >
                                            <RotateCcw className="h-3.5 w-3.5" /> Clear Search
                                        </button>
                                    )}
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                                    {filteredServices.map((s: any) => (
                                        <MarketplaceItemCard key={s.id} item={s} itemType="service" className="w-full" />
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── About Seller Tab View ── */}
                    {tab === 'about' && (
                        <div className="max-w-4xl mx-auto space-y-6">
                            {/* Business Profile Card */}
                            <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-sm space-y-5">
                                <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                                    <Building2 className="h-5 w-5 text-blue-600" />
                                    <h3 className="text-sm font-black uppercase tracking-wider text-[#0b2447]">Business Profile</h3>
                                </div>
                                <div className="grid sm:grid-cols-2 gap-4">
                                    {[
                                        ['Business Name', name],
                                        ['Organization Type', profile.organizationType ? profile.organizationType.replace(/_/g, ' ') : '—'],
                                        ['MSME Category', profile.msmeCategory || profile.msmeType || '—'],
                                        ['Vendor Type', profile.vendorType || '—'],
                                        ['Verification Status', vendor.verificationStatus || 'REGISTERED'],
                                        ['Udyam Certified', profile.isUdyamCertified ? 'Yes (Verified)' : 'No'],
                                    ].map(([label, value]) => (
                                        <div key={label} className="p-3.5 bg-slate-50/70 rounded-xl border border-slate-100 space-y-1">
                                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</p>
                                            <p className="text-xs font-bold text-slate-800">{value}</p>
                                        </div>
                                    ))}

                                    {profile.website && (
                                        <div className="p-3.5 bg-slate-50/70 rounded-xl border border-slate-100 space-y-1 sm:col-span-2">
                                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Official Website</p>
                                            <a
                                                href={profile.website.startsWith('http') ? profile.website : `https://${profile.website}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-xs font-bold text-blue-600 hover:underline inline-flex items-center gap-1.5 truncate"
                                            >
                                                <Globe className="h-3.5 w-3.5" />
                                                {profile.website}
                                            </a>
                                        </div>
                                    )}
                                </div>

                                {profile.productCategories?.length > 0 && (
                                    <div className="pt-4 border-t border-slate-100">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2.5">
                                            Product & Domain Categories
                                        </p>
                                        <div className="flex flex-wrap gap-2">
                                            {profile.productCategories.map((c: string) => (
                                                <span key={c} className="px-3 py-1 rounded-lg bg-blue-50 border border-blue-100 text-[11px] font-bold text-blue-700">
                                                    {c}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Contact & Location Details */}
                            <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-sm space-y-5">
                                <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                                    <MapPin className="h-5 w-5 text-orange-500" />
                                    <h3 className="text-sm font-black uppercase tracking-wider text-[#0b2447]">Location & Contact</h3>
                                </div>
                                <div className="grid sm:grid-cols-2 gap-4">
                                    <div className="p-3.5 bg-slate-50/70 rounded-xl border border-slate-100 space-y-1">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Primary Office Location</p>
                                        <p className="text-xs font-bold text-slate-800">{loc || 'India'}</p>
                                    </div>
                                    {vendor.sellerName && (
                                        <div className="p-3.5 bg-slate-50/70 rounded-xl border border-slate-100 space-y-1">
                                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Authorized Representative</p>
                                            <p className="text-xs font-bold text-slate-800">{vendor.sellerName}</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </main>

            <MarketplaceFooter />
        </div>
    );
}

