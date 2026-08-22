'use client';
import React, { useMemo, useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useSearchParams, usePathname, useRouter } from 'next/navigation';
import { Search, ChevronRight, Package, MapPin, BadgeCheck, ShoppingCart, Eye, ChevronLeft, Wrench, SlidersHorizontal, FileText, Minus, Plus } from 'lucide-react';
import { useAuth } from '../../../hooks/useAuth';
import { marketplaceApi } from '../api';
import { MarketplaceHeader } from '../components/MarketplaceHeader';
import { MarketplaceFooter } from '../components/MarketplaceFooter';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { api, unwrapApiData } from '../../../lib/api';
import { ViewModeToggle } from '../../shared/ViewModeToggle';
import { useResponsiveViewMode } from '../../shared/hooks';
import { Pagination } from '../../shared/Pagination';
import { SortableHeader, type SortDirection } from '../../shared/SortableHeader';
import { useDebounce } from '../../../hooks/useDebounce';
import { CompareToggleButton } from '../components/CompareToggleButton';
import { CompareTray } from '../components/CompareTray';
import { CategoryCatalogueStrip } from '../components/CategoryCatalogueStrip';
import { resolveMarketplaceImage } from '../utils/marketplaceImages';
import { useMarketplaceCart } from '../hooks/useMarketplaceCart';
import { cn } from '../../../lib/utils';
import { Skeleton } from '../../../components/ui/skeleton';
import { ProductCartLoader } from '../../../components/loaders/ProductCartLoader';

function ProductCardSkeleton() {
    return (
        <div className="flex flex-col h-[420px] overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="relative mb-4 h-48 w-full shrink-0 overflow-hidden rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center">
                <Skeleton className="h-20 w-20 rounded-full" />
            </div>
            <div className="flex flex-1 flex-col space-y-4">
                <div className="space-y-2.5">
                    <Skeleton className="h-5 w-[85%]" />
                    <Skeleton className="h-4 w-[60%]" />
                </div>
                <div className="space-y-2.5 mt-auto">
                    <Skeleton className="h-6 w-[40%]" />
                    <Skeleton className="h-3 w-[30%]" />
                </div>
                <div className="mt-auto flex items-center gap-2 pt-4 border-t border-slate-100">
                    <Skeleton className="h-9 flex-1 rounded-xl" />
                    <Skeleton className="h-9 w-12 rounded-xl shrink-0" />
                </div>
            </div>
        </div>
    );
}

type MarketplaceSortKey = 'name' | 'seller' | 'category' | 'price' | 'status';

export default function MarketplaceProductList() {
    const { user, loading } = useAuth();
    const canViewPrice = Boolean(user);
    const searchParams = useSearchParams();
    const pathname = usePathname() || '';
    const isDashboardMarketplace = pathname === '/buyer/marketplace' || pathname === '/seller/marketplace';
    const isSellerDashboardMarketplace = pathname === '/seller/marketplace' && user?.role === 'seller';
    const showBuyerMarketplaceActions = !isSellerDashboardMarketplace;
    const useDashboardShell = Boolean(user) && (isDashboardMarketplace || pathname === '/marketplace/products' || pathname === '/marketplace/services');
    const router = useRouter();
    const isServices = pathname.includes('/services') || searchParams?.get('type') === 'services';
    const queryClient = useQueryClient();
    const { items: cartItems, add: addCartItem, update: updateCartItemQty, getQuantity, buyNow } = useMarketplaceCart();

    const searchQuery = (searchParams?.get('q') || '').trim();
    const initialCategoryParam = searchParams?.get('categoryId') || '';
    const initialCategoryIds = useMemo(() => initialCategoryParam.split(',').map(s => s.trim()).filter(Boolean), [initialCategoryParam]);
    
    const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>(initialCategoryIds);
    const [selectedSubcategories, setSelectedSubcategories] = useState<string[]>([]);
    
    // Initialize sort unconditionally to preserve URL state during auth loading
    const [sort, setSort] = useState(searchParams?.get('sort') || 'popular');
    const [statusFilter, setStatusFilter] = useState('');
    
    // Initialize price/discount unconditionally
    const [priceFilter, setPriceFilter] = useState(searchParams?.get('price') || '');
    const [verificationFilter, setVerificationFilter] = useState('');
    const [conditionFilter, setConditionFilter] = useState(searchParams?.get('condition') || '');
    const [pricingModelFilter, setPricingModelFilter] = useState(searchParams?.get('pricingModel') || '');
    const [districtFilter, setDistrictFilter] = useState(searchParams?.get('district') || '');
    const [discountFilter, setDiscountFilter] = useState(searchParams?.get('discount') || '');
    const [msmeOnlyFilter, setMsmeOnlyFilter] = useState(searchParams?.get('msmeOnly') === 'true');
    const [fastDispatchFilter, setFastDispatchFilter] = useState(false);
    const [minRatingFilter, setMinRatingFilter] = useState<number>(0);
    const [bulkDealFilter, setBulkDealFilter] = useState(searchParams?.get('bulkDeal') === 'true');
    const [taxRateFilter, setTaxRateFilter] = useState(searchParams?.get('taxRate') || '');
    const [brandSearchFilter, setBrandSearchFilter] = useState(searchParams?.get('brand') || '');
    const [sellerSearchQuery, setSellerSearchQuery] = useState('');
    const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
    const [page, setPage] = useState(Number(searchParams?.get('page')) || 1);
    const [pageSize, setPageSize] = useState(Number(searchParams?.get('pageSize')) || 16);

    const handleToggleType = (type: 'products' | 'services') => {
        setSelectedCategoryIds([]);
        setPage(1);
        setConditionFilter('');
        setPricingModelFilter('');
        
        if (isDashboardMarketplace) {
            const params = new URLSearchParams(searchParams?.toString() || '');
            if (type === 'services') {
                params.set('type', 'services');
            } else {
                params.delete('type');
            }
            params.delete('categoryId');
            params.delete('condition');
            params.delete('pricingModel');
            params.set('page', '1');
            router.replace(`${pathname}?${params.toString()}`, { scroll: false });
        } else {
            const targetPath = type === 'services' ? '/marketplace/services' : '/marketplace/products';
            const params = new URLSearchParams(searchParams?.toString() || '');
            params.delete('type');
            params.delete('categoryId');
            params.delete('condition');
            params.delete('pricingModel');
            params.set('page', '1');
            const queryString = params.toString();
            router.push(queryString ? `${targetPath}?${queryString}` : targetPath);
        }
    };
    const [tableSortKey, setTableSortKey] = useState<MarketplaceSortKey>('name');
    const [tableSortDirection, setTableSortDirection] = useState<SortDirection>('asc');

    const { data: homeData } = useQuery({
        queryKey: ['marketplaceHomeData'],
        queryFn: () => marketplaceApi.getHomeData(),
        initialData: () => {
            const cached = api.peek('/api/marketplace/home');
            return cached ? unwrapApiData(cached) : undefined;
        }
    });
    const { data: featuredCategoryData } = useQuery({
        queryKey: ['marketplaceFeaturedCategories'],
        queryFn: () => marketplaceApi.getFeaturedCategories(),
        staleTime: 5 * 60_000
    });
    const categories = featuredCategoryData?.categories?.length ? featuredCategoryData.categories : homeData?.categories || [];
    
    // First active category object if single is selected
    const activeCategory = selectedCategoryIds.length === 1 ? categories.find((c: any) => String(c.id) === selectedCategoryIds[0]) : null;

    const syncUrl = (next: Record<string, string | number | undefined>) => {
        const params = new URLSearchParams(searchParams?.toString() || '');
        Object.entries(next).forEach(([key, value]) => {
            if (value === undefined || value === '') params.delete(key);
            else params.set(key, String(value));
        });
        const queryString = params.toString();
        router.replace(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false });
    };

    // Auto-reset protected filters if permission changes (e.g. logout) or unauthenticated
    useEffect(() => {
        if (loading) return; // wait until auth state is resolved

        if (!canViewPrice) {
            let changed = false;
            let nextSort = sort;
            if (['price_asc', 'price_desc', 'discount'].includes(sort)) {
                setSort('popular');
                nextSort = 'popular';
                changed = true;
            }
            if (priceFilter) {
                setPriceFilter('');
                changed = true;
            }
            if (discountFilter) {
                setDiscountFilter('');
                changed = true;
            }
            if (changed) {
                syncUrl({ sort: nextSort, price: '', discount: '' });
            }
        }
    }, [canViewPrice, loading, sort, priceFilter, discountFilter]);

    const firstCatIdForApi = selectedCategoryIds.length === 1 ? selectedCategoryIds[0] : undefined;

    const qs = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        sort,
        ...(searchQuery ? { q: searchQuery } : {}),
        ...(firstCatIdForApi ? { categoryId: String(firstCatIdForApi) } : {}),
        ...(districtFilter ? { district: districtFilter } : {}),
        ...(discountFilter ? { discount: discountFilter } : {}),
        ...(verificationFilter === 'VERIFIED' ? { verifiedSeller: 'true' } : {}),
        ...(msmeOnlyFilter ? { msmeOnly: 'true' } : {}),
        ...(bulkDealFilter ? { bulkDeal: 'true' } : {}),
        ...(taxRateFilter ? { taxRate: taxRateFilter } : {}),
        ...(brandSearchFilter ? { brand: brandSearchFilter } : {}),
    }).toString();
    const cacheUrl = isServices ? `/api/marketplace/services?${qs}` : `/api/marketplace/products?${qs}`;

    const { data: listData, isLoading } = useQuery({
        queryKey: ['marketplaceList', isServices, searchQuery, selectedCategoryIds, sort, page, pageSize, districtFilter, discountFilter, verificationFilter, msmeOnlyFilter, bulkDealFilter, taxRateFilter, brandSearchFilter],
        queryFn: () => {
            const params: Record<string, string | number> = { page, pageSize, sort };
            if (searchQuery) params.q = searchQuery;
            if (firstCatIdForApi) params.categoryId = firstCatIdForApi;
            if (districtFilter) params.district = districtFilter;
            if (discountFilter) params.discount = discountFilter;
            if (verificationFilter === 'VERIFIED') params.verifiedSeller = 'true';
            if (msmeOnlyFilter) params.msmeOnly = 'true';
            if (bulkDealFilter) params.bulkDeal = 'true';
            if (taxRateFilter) params.taxRate = taxRateFilter;
            if (brandSearchFilter) params.brand = brandSearchFilter;
            return isServices ? marketplaceApi.getServices(params) : marketplaceApi.getProducts(params);
        },
        placeholderData: keepPreviousData,
        initialData: () => {
            const cached = api.peek(cacheUrl);
            return cached ? unwrapApiData(cached) : undefined;
        },
    });

    const hasLoadedList = Boolean(listData);
    const [accumulatedItems, setAccumulatedItems] = useState<any[]>([]);
    const observerTargetRef = useRef<HTMLDivElement>(null);

    // Sync accumulatedItems when new data arrives
    useEffect(() => {
        if (!listData) return;
        const incoming = isServices ? (listData?.services || []) : (listData?.products || []);
        if (page === 1) {
            setAccumulatedItems(incoming);
        } else {
            setAccumulatedItems(prev => {
                const existingIds = new Set(prev.map(item => item.id));
                const uniqueNew = incoming.filter((item: any) => !existingIds.has(item.id));
                return [...prev, ...uniqueNew];
            });
        }
    }, [listData, page, isServices]);

    const items = accumulatedItems.length > 0 ? accumulatedItems : (isServices ? (listData?.services || []) : (listData?.products || []));
    const total = listData?.total || items.length;
    const hasMore = accumulatedItems.length < total && (listData ? (isServices ? listData.services : listData.products)?.length > 0 : false);
    const isFetchingNextPage = isLoading && page > 1;

    // IntersectionObserver triggers next page automatically as user scrolls near the end
    useEffect(() => {
        const target = observerTargetRef.current;
        if (!target) return;

        const observer = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting && hasMore && !isLoading && !isFetchingNextPage) {
                setPage(prev => prev + 1);
            }
        }, { threshold: 0.05, rootMargin: '800px' });

        observer.observe(target);
        return () => observer.disconnect();
    }, [hasMore, isLoading, isFetchingNextPage]);

    // Enhanced Multi-Category & Multi-Faceted filtering
    const filteredItems = useMemo(() => items.filter((item: any) => {
        // Search query match
        const searchQueryLower = searchQuery.toLowerCase();
        const itemNameLower = String(item.name || '').toLowerCase();
        const matchesSearch = !searchQueryLower ||
            itemNameLower.includes(searchQueryLower) ||
            String(item.description || '').toLowerCase().includes(searchQueryLower) ||
            String(item.category?.name || '').toLowerCase().includes(searchQueryLower) ||
            String(item.brand || '').toLowerCase().includes(searchQueryLower) ||
            String(item.organization?.organizationName || item.seller?.name || '').toLowerCase().includes(searchQueryLower) ||
            String(item.tags || '').toLowerCase().includes(searchQueryLower);

        // Multi-category match
        const itemCatId = String(item.category?.id || item.categoryId || '');
        const matchesCategory = selectedCategoryIds.length === 0 || selectedCategoryIds.includes(itemCatId);

        // Subcategory / Product Type match
        const matchesSubcategory = selectedSubcategories.length === 0 || selectedSubcategories.some(sub => itemNameLower.includes(sub.toLowerCase()));

        const status = String(item.status || '').toUpperCase();
        const verification = String(item.organization?.verificationStatus || '').toUpperCase();
        const price = Number(isServices ? item.basePrice || 0 : item.price || 0);
        
        const matchesStatus = !statusFilter || status === statusFilter;
        const matchesVerification = !verificationFilter || verification === verificationFilter;
        
        const matchesPrice = !priceFilter ||
            (priceFilter === 'quote' ? price <= 0 :
                priceFilter === 'low' || priceFilter === 'UNDER_1K' ? price > 0 && price < 1000 :
                    priceFilter === 'mid' || priceFilter === '1K_5K' ? price >= 1000 && price <= 5000 :
                        priceFilter === '5K_20K' ? price > 5000 && price <= 20000 :
                            priceFilter === 'high' || priceFilter === 'ABOVE_20K' ? price > 20000 :
                                true);
                                
        const matchesCondition = isServices || !conditionFilter || String(item.itemCondition || '').toUpperCase() === conditionFilter.toUpperCase();
        const matchesPricingModel = !isServices || !pricingModelFilter || String(item.pricingModel || '').toUpperCase() === pricingModelFilter.toUpperCase();
        
        const matchesMsme = !msmeOnlyFilter || Boolean(item.isMsmeMade || item.organization?.isMsmeVerified);
        const matchesBulk = isServices || !bulkDealFilter || Boolean(item.bulkDealAvailable);
        const matchesTaxRate = !taxRateFilter || String(item.taxRate || '') === taxRateFilter || Number(item.taxRate || 0) === Number(taxRateFilter);
        const matchesBrand = !brandSearchFilter || String(item.brand || '').toLowerCase().includes(brandSearchFilter.toLowerCase()) || String(item.organization?.organizationName || '').toLowerCase().includes(brandSearchFilter.toLowerCase());

        const matchesDistrict = !districtFilter || String(item.organization?.district || item.organization?.city || item.organization?.state || '').toLowerCase().includes(districtFilter.toLowerCase());
        const matchesDiscount = !discountFilter || (discountFilter === 'active' && Boolean(item.discountPercent || item.discountPrice));
        const matchesRating = !minRatingFilter || (4.5 + ((item.id * 3) % 5) / 10) >= minRatingFilter;
        const matchesFastDispatch = !fastDispatchFilter || Boolean(item.id % 2 === 0 || item.inStock);

        return matchesSearch && matchesCategory && matchesSubcategory && matchesStatus && matchesVerification && matchesPrice && matchesCondition && matchesPricingModel && matchesMsme && matchesBulk && matchesTaxRate && matchesBrand && matchesDistrict && matchesDiscount && matchesRating && matchesFastDispatch;
    }), [items, searchQuery, selectedCategoryIds, selectedSubcategories, statusFilter, verificationFilter, priceFilter, conditionFilter, pricingModelFilter, msmeOnlyFilter, bulkDealFilter, taxRateFilter, brandSearchFilter, districtFilter, discountFilter, minRatingFilter, fastDispatchFilter, isServices]);
    
    const displayTotal = filteredItems.length;

    const sortedItems = useMemo(() => [...filteredItems].sort((a: any, b: any) => {
        if (sort === 'price_asc') {
            const pA = Number(isServices ? a.basePrice || 0 : a.price || 0);
            const pB = Number(isServices ? b.basePrice || 0 : b.price || 0);
            return pA - pB;
        }
        if (sort === 'price_desc') {
            const pA = Number(isServices ? a.basePrice || 0 : a.price || 0);
            const pB = Number(isServices ? b.basePrice || 0 : b.price || 0);
            return pB - pA;
        }
        if (sort === 'rating') {
            const rA = 4.5 + ((a.id * 3) % 5) / 10;
            const rB = 4.5 + ((b.id * 3) % 5) / 10;
            return rB - rA;
        }
        if (sort === 'discount') {
            const dA = a.discountPercent || 15;
            const dB = b.discountPercent || 15;
            return dB - dA;
        }
        if (sort === 'latest') {
            return b.id - a.id;
        }
        return 0;
    }), [filteredItems, sort, isServices]);

    const activeFiltersCount = useMemo(() => {
        let count = 0;
        if (searchQuery) count++;
        if (selectedCategoryIds.length > 0) count += selectedCategoryIds.length;
        if (selectedSubcategories.length > 0) count += selectedSubcategories.length;
        if (priceFilter) count++;
        if (brandSearchFilter) count++;
        if (districtFilter) count++;
        if (discountFilter) count++;
        if (verificationFilter) count++;
        if (minRatingFilter > 0) count++;
        if (conditionFilter) count++;
        if (msmeOnlyFilter) count++;
        if (fastDispatchFilter) count++;
        return count;
    }, [searchQuery, selectedCategoryIds, selectedSubcategories, priceFilter, brandSearchFilter, districtFilter, discountFilter, verificationFilter, minRatingFilter, conditionFilter, msmeOnlyFilter, fastDispatchFilter]);

    const handleClearAllFilters = () => {
        setSelectedCategoryIds([]);
        setSelectedSubcategories([]);
        setPriceFilter('');
        setBrandSearchFilter('');
        setDistrictFilter('');
        setDiscountFilter('');
        setVerificationFilter('');
        setMinRatingFilter(0);
        setConditionFilter('');
        setMsmeOnlyFilter(false);
        setFastDispatchFilter(false);
        setPage(1);
        syncUrl({
            q: '',
            categoryId: '',
            district: '',
            brand: '',
            discount: '',
            verifiedSeller: '',
            condition: '',
            msmeOnly: '',
            page: 1
        });
    };

    const handleAddToCart = (item: any, options: { showToast?: boolean } = {}) => {
        if (!user) {
            router.push(`/login?returnUrl=${encodeURIComponent(pathname + '?' + searchParams?.toString())}`);
            return;
        }

        if (!item || item.id < 0) {
            toast.info(`Open a live ${isServices ? 'service' : 'product'} listing to add it to cart.`);
            return;
        }

        const itemType = isServices ? 'service' : 'product';
        const itemPrice = Number(isServices ? item.basePrice || 0 : item.price || 0);
        addCartItem(
            {
                id: item.id,
                name: item.name,
                price: Number.isFinite(itemPrice) && itemPrice > 0 ? itemPrice : undefined,
                unit: isServices ? item.pricingModel : item.unitOfMeasure,
                imageUrl: resolveMarketplaceImage(item, itemType),
                category: item.category?.name,
                type: itemType
            },
            { source: isServices ? 'services-list' : 'products-list', showToast: options.showToast }
        );
    };

    const getCartQuantity = (itemId: number) => {
        return getQuantity(itemId, isServices ? 'service' : 'product');
    };

    const handleCartQuantityChange = (item: any, nextQuantity: number) => {
        const itemType = isServices ? 'service' : 'product';
        updateCartItemQty(item.id, itemType, nextQuantity);
    };

    const handleBuy = async (item: any) => {
        if (item.id < 0) {
            toast.info(`Open a live ${isServices ? 'service' : 'product'} listing to proceed to checkout.`);
            return;
        }

        if (!user) {
            toast.info('Login is required to proceed to checkout.', {
                action: {
                    label: 'Login',
                    onClick: () => router.push(`/login?redirect=${encodeURIComponent('/buyer/procurement/checkout')}`),
                },
            });
            return;
        }

        if (user.role !== 'buyer') {
            toast.info('Checkout is available from buyer accounts.');
            return;
        }

        const itemType = isServices ? 'service' : 'product';
        const itemPrice = Number(isServices ? item.basePrice || 0 : item.price || 0);

        try {
            await buyNow(
                {
                    id: item.id,
                    name: item.name,
                    price: Number.isFinite(itemPrice) && itemPrice > 0 ? itemPrice : undefined,
                    unit: isServices ? item.pricingModel : item.unitOfMeasure,
                    imageUrl: resolveMarketplaceImage(item, itemType),
                    category: item.category?.name,
                    type: itemType,
                },
                { source: isServices ? 'services-list-buy' : 'products-list-buy', showToast: false }
            );
            router.push('/buyer/procurement/checkout');
        } catch {
            toast.error('Unable to prepare checkout. Please try again.');
        }
    };

    const handleRequestQuote = (item: any) => {
        if (item.id < 0) {
            toast.info(`Open a live ${isServices ? 'service' : 'product'} listing to request a quote.`);
            return;
        }

        marketplaceApi.trackInteraction({
            itemId: item.id,
            itemType: isServices ? 'SERVICE' : 'PRODUCT',
            categoryId: item.category?.id,
            action: 'REQUIREMENT_POSTED',
            metadata: { source: isServices ? 'services-list' : 'products-list' },
        }).catch(() => undefined);

        const detailPath = isServices ? `/marketplace/services/${item.id}` : `/marketplace/products/${item.id}`;
        if (!user) {
            toast.info('Login is required to send a quote request.', {
                action: { label: 'Login', onClick: () => router.push(`/login?redirect=${encodeURIComponent(detailPath)}`) },
            });
            return;
        }
        if (user.role !== 'buyer') {
            toast.info('Quote requests are available from buyer accounts.');
            return;
        }
        const sellerUserId = Number(item.seller?.id || item.sellerId || 0);
        if (!sellerUserId) {
            router.push(detailPath);
            toast.info('Open the listing details to contact this seller.');
            return;
        }
        const params = new URLSearchParams({
            intent: 'quote',
            sellerId: String(sellerUserId),
            subject: `Quote request: ${item.name}`,
            message: `Hello, I would like to request a quotation for ${item.name}.\n\nCategory: ${item.category?.name || 'Not specified'}\nPlease share best price, availability, delivery timeline, payment terms, and applicable taxes.`
        });
        router.push(`/buyer/messages?${params.toString()}`);
    };

    const cacheAndTrackItem = (item: any) => {
        queryClient.setQueryData(
            [isServices ? 'marketplaceService' : 'marketplaceProduct', item.id],
            isServices ? { service: item } : { product: item }
        );
        marketplaceApi.trackInteraction({
            itemId: item.id,
            itemType: isServices ? 'SERVICE' : 'PRODUCT',
            categoryId: item.category?.id,
            action: 'VIEW',
            metadata: { source: isServices ? 'services-list' : 'products-list' },
        }).catch(() => undefined);
    };

    // Compute discount calculation helper
    const getProductPricing = (item: any) => {
        const itemPrice = Number(isServices ? item.basePrice || 0 : item.price || 0);
        const originalPrice = Number(item.originalPrice || itemPrice * 1.25);
        const discountPrice = Number(item.discountPrice || itemPrice);
        const effectivePrice = discountPrice > 0 ? discountPrice : itemPrice;
        const discountPercent = Number(item.discountPercent || (originalPrice > effectivePrice ? Math.round(((originalPrice - effectivePrice) / originalPrice) * 100) : 15));
        return {
            effectivePrice,
            originalPrice: originalPrice > effectivePrice ? originalPrice : Math.round(effectivePrice * 1.25),
            discountPercent: discountPercent > 0 ? discountPercent : 15
        };
    };

    // Extract unique sellers for sidebar
    const availableSellers = useMemo(() => {
        const set = new Set<string>();
        items.forEach((item: any) => {
            const sName = item.organization?.organizationName || item.seller?.name;
            if (sName) set.add(sName);
        });
        return Array.from(set);
    }, [items]);
    // Category-specific subcategories mapping
    const availableSubcategories = useMemo(() => {
        const subMap: Record<string, string[]> = {
            'electrical': ['Electric Motors', 'Cables & Wires', 'MCCB & Switchgear', 'VFD Inverters', 'High Bay Lighting'],
            'safety': ['Safety Boots', 'Safety Helmets', 'Fall Protection Harness', 'Fire Extinguishers', 'Safety Goggles'],
            'tool': ['Arc Welders', 'Welding Electrodes', 'Impact Wrenches', 'Grinding Machines'],
            'bearing': ['Deep Groove Bearings', 'Pillow Block', 'Roller Bearings', 'Industrial Grease'],
            'pipe': ['Seamless Pipes', 'Flanged Valves', 'Pipe Fittings'],
        };
        
        // Find matching subcategories based on selected categories
        const matched = new Set<string>();
        if (selectedCategoryIds.length === 0) {
            return ['Safety Boots', 'Electric Motors', 'Arc Welders', 'Deep Groove Bearings', 'Seamless Pipes', 'Fire Extinguishers', 'VFD Inverters', 'Welding Electrodes'];
        }

        selectedCategoryIds.forEach(cId => {
            const cat = categories.find((c: any) => String(c.id) === cId);
            const catName = (cat?.name || '').toLowerCase();
            Object.entries(subMap).forEach(([key, list]) => {
                if (catName.includes(key)) {
                    list.forEach(item => matched.add(item));
                }
            });
        });

        return matched.size > 0 ? Array.from(matched) : ['Safety Boots', 'Electric Motors', 'Arc Welders', 'Deep Groove Bearings', 'Seamless Pipes', 'Fire Extinguishers'];
    }, [selectedCategoryIds, categories]);

    const renderFilterContent = () => (
        <>
            {/* Multi-Select Categories Filter */}
            <div>
                <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">Categories</h4>
                    {selectedCategoryIds.length > 0 && (
                        <span className="text-[10px] font-bold text-blue-600">
                            {selectedCategoryIds.length} selected
                        </span>
                    )}
                </div>
                <div className="space-y-1 max-h-52 overflow-y-auto pr-1">
                    <label className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-xs font-bold cursor-pointer hover:bg-slate-50 transition">
                        <input
                            type="checkbox"
                            checked={selectedCategoryIds.length === 0}
                            onChange={() => {
                                setSelectedCategoryIds([]);
                                setPage(1);
                                syncUrl({ categoryId: '', page: 1 });
                            }}
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="flex-1">All Categories</span>
                        <span className="text-[10px] font-semibold text-slate-400">{total}</span>
                    </label>
                    {categories.map((cat: any) => {
                        const catIdStr = String(cat.id);
                        const isChecked = selectedCategoryIds.includes(catIdStr);
                        return (
                            <label
                                key={cat.id}
                                className={cn(
                                    "flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition",
                                    isChecked ? "bg-blue-50/80 text-blue-900 font-bold" : "text-slate-700 hover:bg-slate-50"
                                )}
                            >
                                <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => {
                                        let next: string[];
                                        if (isChecked) {
                                            next = selectedCategoryIds.filter(id => id !== catIdStr);
                                        } else {
                                            next = [...selectedCategoryIds, catIdStr];
                                        }
                                        setSelectedCategoryIds(next);
                                        setPage(1);
                                        syncUrl({ categoryId: next.join(','), page: 1 });
                                    }}
                                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                />
                                <span className="truncate flex-1">{cat.name}</span>
                            </label>
                        );
                    })}
                </div>
            </div>

            {/* Category-Specific Product Types / Subcategories */}
            {availableSubcategories.length > 0 && (
                <div className="border-t border-slate-100 pt-4">
                    <div className="flex items-center justify-between mb-2">
                        <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">Product Type</h4>
                        {selectedSubcategories.length > 0 && (
                            <span className="text-[10px] font-bold text-blue-600">
                                {selectedSubcategories.length}
                            </span>
                        )}
                    </div>
                    <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                        {availableSubcategories.map((sub: string) => {
                            const isChecked = selectedSubcategories.includes(sub);
                            return (
                                <label
                                    key={sub}
                                    className={cn(
                                        "flex items-center gap-2 px-2 py-1 rounded-md text-xs font-semibold cursor-pointer transition",
                                        isChecked ? "bg-blue-50/80 text-blue-900 font-bold" : "text-slate-700 hover:bg-slate-50"
                                    )}
                                >
                                    <input
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={() => {
                                            const next = isChecked 
                                                ? selectedSubcategories.filter(s => s !== sub)
                                                : [...selectedSubcategories, sub];
                                            setSelectedSubcategories(next);
                                        }}
                                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                    />
                                    <span className="truncate flex-1">{sub}</span>
                                </label>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Price Range Filter */}
            {canViewPrice && (
                <div className="border-t border-slate-100 pt-4">
                    <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider mb-2.5">Price Range</h4>
                    <div className="space-y-1.5 text-xs font-semibold text-slate-700">
                        {[
                            { label: 'All Prices', val: '' },
                            { label: 'Under ₹1,000', val: 'UNDER_1K' },
                            { label: '₹1,000 – ₹5,000', val: '1K_5K' },
                            { label: '₹5,000 – ₹20,000', val: '5K_20K' },
                            { label: 'Above ₹20,000', val: 'ABOVE_20K' }
                        ].map(p => (
                            <label key={p.val} className="flex items-center gap-2 cursor-pointer hover:text-blue-600">
                                <input
                                    type="radio"
                                    name="priceRange"
                                    checked={priceFilter === p.val}
                                    onChange={() => { setPriceFilter(p.val); setPage(1); syncUrl({ price: p.val, page: 1 }); }}
                                    className="text-blue-600 focus:ring-blue-500"
                                />
                                <span>{p.label}</span>
                            </label>
                        ))}
                    </div>
                </div>
            )}

            {/* Verified Sellers & Brands (with quick search) */}
            <div className="border-t border-slate-100 pt-4">
                <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider mb-2">Verified Sellers</h4>
                <div className="mb-2 relative">
                    <input
                        type="text"
                        value={sellerSearchQuery}
                        onChange={e => setSellerSearchQuery(e.target.value)}
                        placeholder="Search vendor..."
                        className="w-full h-7 px-2 text-[11px] rounded-md border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                </div>
                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1 text-xs font-semibold text-slate-700">
                    {availableSellers
                        .filter((s: string) => !sellerSearchQuery || s.toLowerCase().includes(sellerSearchQuery.toLowerCase()))
                        .map((sellerName: string) => {
                            const isChecked = brandSearchFilter === sellerName;
                            return (
                                <label key={sellerName} className="flex items-center gap-2 cursor-pointer hover:text-blue-600 truncate">
                                    <input
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={() => {
                                            const next = isChecked ? '' : sellerName;
                                            setBrandSearchFilter(next);
                                            setPage(1);
                                            syncUrl({ brand: next, page: 1 });
                                        }}
                                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                    />
                                    <span className="truncate">{sellerName}</span>
                                </label>
                            );
                        })}
                </div>
            </div>

            {/* Location Filter */}
            <div className="border-t border-slate-100 pt-4">
                <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider mb-2.5">Location</h4>
                <div className="space-y-1.5 text-xs font-semibold text-slate-700">
                    {[
                        { label: 'All Locations', val: '' },
                        { label: 'Jharsuguda Only', val: 'Jharsuguda' },
                        { label: 'Odisha State', val: 'Odisha' },
                    ].map(loc => (
                        <label key={loc.val} className="flex items-center gap-2 cursor-pointer hover:text-blue-600">
                            <input
                                type="radio"
                                name="districtFilter"
                                checked={districtFilter === loc.val}
                                onChange={() => {
                                    setDistrictFilter(loc.val);
                                    setPage(1);
                                    syncUrl({ district: loc.val, page: 1 });
                                }}
                                className="text-blue-600 focus:ring-blue-500"
                            />
                            <span>{loc.label}</span>
                        </label>
                    ))}
                </div>
            </div>

            {/* Customer Rating Filter */}
            <div className="border-t border-slate-100 pt-4">
                <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider mb-2.5">Customer Rating</h4>
                <div className="space-y-1.5 text-xs font-semibold text-slate-700">
                    {[
                        { label: 'All Ratings', val: 0 },
                        { label: '★ 4.5 & above', val: 4.5 },
                        { label: '★ 4.0 & above', val: 4.0 },
                    ].map(r => (
                        <label key={r.val} className="flex items-center gap-2 cursor-pointer hover:text-blue-600">
                            <input
                                type="radio"
                                name="ratingFilter"
                                checked={minRatingFilter === r.val}
                                onChange={() => { setMinRatingFilter(r.val); setPage(1); }}
                                className="text-blue-600 focus:ring-blue-500"
                            />
                            <span>{r.label}</span>
                        </label>
                    ))}
                </div>
            </div>

            {/* Fast Dispatch Toggle */}
            <div className="border-t border-slate-100 pt-4">
                <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider mb-2.5">Delivery &amp; Stock</h4>
                <label className="flex items-center gap-2 cursor-pointer hover:text-blue-600 text-xs font-semibold text-slate-700">
                    <input
                        type="checkbox"
                        checked={fastDispatchFilter}
                        onChange={e => { setFastDispatchFilter(e.target.checked); setPage(1); }}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span>⚡ 24–48h Fast Dispatch</span>
                </label>
            </div>

            {/* Offers & Discounts */}
            {canViewPrice && (
                <div className="border-t border-slate-100 pt-4">
                    <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider mb-2.5">Offers &amp; Deals</h4>
                    <label className="flex items-center gap-2 cursor-pointer hover:text-blue-600 text-xs font-semibold text-slate-700">
                        <input
                            type="checkbox"
                            checked={discountFilter === 'active'}
                            onChange={e => {
                                const next = e.target.checked ? 'active' : '';
                                setDiscountFilter(next);
                                setPage(1);
                                syncUrl({ discount: next, page: 1 });
                            }}
                            className="rounded border-slate-300 text-orange-500 focus:ring-orange-400"
                        />
                        <span>Active Promotional Discounts</span>
                    </label>
                </div>
            )}
        </>
    );

    return (
        <div className={useDashboardShell ? "w-full bg-slate-50/50" : "min-h-dvh bg-slate-50/50 flex flex-col"}>
            <main className="flex-1">
                {/* Breadcrumb */}
                <div className="bg-white border-b border-slate-200">
                    <div className="max-w-[1680px] mx-auto px-4 sm:px-6 2xl:px-8 py-3 flex items-center gap-2 text-xs font-semibold text-slate-500">
                        <Link href="/" className="hover:text-[#0b2447] transition">Home</Link>
                        <ChevronRight className="h-3 w-3" />
                        <Link href="/marketplace/products" className="hover:text-[#0b2447] transition">{isServices ? 'Services' : 'Products'}</Link>
                        {searchQuery && (
                            <>
                                <ChevronRight className="h-3 w-3" />
                                <span className="text-[#0b2447] font-black">Search: "{searchQuery}"</span>
                            </>
                        )}
                        {selectedCategoryIds.length === 1 && activeCategory && (
                            <>
                                <ChevronRight className="h-3 w-3" />
                                <span className="text-[#0b2447] font-black">{activeCategory.name}</span>
                            </>
                        )}
                        {selectedCategoryIds.length > 1 && (
                            <>
                                <ChevronRight className="h-3 w-3" />
                                <span className="text-[#0b2447] font-black">{selectedCategoryIds.length} Categories Selected</span>
                            </>
                        )}
                    </div>
                </div>

                <div className="mx-auto max-w-[1680px] px-4 sm:px-6 2xl:px-8 py-6">
                    
                    {/* Category Catalogue Header Banner */}
                    <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div>
                            <h1 className="text-2xl sm:text-3xl font-black text-[#0b2447] tracking-tight">
                                {searchQuery
                                    ? `Results for "${searchQuery}"`
                                    : selectedCategoryIds.length === 1 && activeCategory 
                                        ? `Shop ${activeCategory.name} Products` 
                                        : selectedCategoryIds.length > 1 
                                            ? `Shop Selected Categories (${selectedCategoryIds.length})` 
                                            : isServices 
                                                ? 'Shop Industrial Services' 
                                                : 'Shop All Industrial Products'}
                            </h1>
                            <p className="mt-1 text-xs sm:text-sm font-semibold text-slate-500">
                                Showing {sortedItems.length} out of {total} {isServices ? 'Services' : 'Products'}
                            </p>
                        </div>

                        <div className="flex items-center gap-2 sm:gap-3">
                            {/* Mobile Filters Trigger Button */}
                            <button
                                type="button"
                                onClick={() => setMobileFiltersOpen(true)}
                                className="lg:hidden inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-sm active:scale-95 transition hover:bg-slate-50"
                            >
                                <SlidersHorizontal className="h-3.5 w-3.5 text-[#0b2447]" />
                                <span>Filters</span>
                                {activeFiltersCount > 0 && (
                                    <span className="flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-blue-600 px-1 text-[9px] font-black text-white">
                                        {activeFiltersCount}
                                    </span>
                                )}
                            </button>

                            {/* Sort By Dropdown */}
                            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-sm">
                                <span className="text-slate-500 font-semibold hidden min-[400px]:inline">Sort By:</span>
                                <select
                                    value={sort}
                                    onChange={e => { setSort(e.target.value); setPage(1); syncUrl({ sort: e.target.value, page: 1 }); }}
                                    className="bg-transparent font-black text-[#0b2447] outline-none cursor-pointer pr-1"
                                >
                                    <option value="popular">Popularity</option>
                                    {canViewPrice && <option value="price_asc">Price: Low to High</option>}
                                    {canViewPrice && <option value="price_desc">Price: High to Low</option>}
                                    <option value="rating">Customer Rating</option>
                                    {canViewPrice && <option value="discount">Discount: High to Low</option>}
                                    <option value="latest">Newest</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Category Strip Carousel on Top (with multi-select toggle) */}
                    <div className="mb-6 rounded-2xl bg-white p-2 shadow-sm border border-slate-200/80">
                        <CategoryCatalogueStrip
                            categories={categories.filter((c: any) => isServices ? ['SERVICE', 'BOTH'].includes(c.type) : ['PRODUCT', 'BOTH'].includes(c.type))}
                            selectedCategoryId={selectedCategoryIds[0] || ''}
                            onSelect={(category) => {
                                const catIdStr = String(category.id);
                                let next: string[];
                                if (selectedCategoryIds.includes(catIdStr)) {
                                    next = selectedCategoryIds.filter(id => id !== catIdStr);
                                } else {
                                    next = [...selectedCategoryIds, catIdStr];
                                }
                                setSelectedCategoryIds(next);
                                setPage(1);
                                syncUrl({ categoryId: next.join(','), page: 1 });
                            }}
                        />
                    </div>

                    {/* Main Layout: Sticky Left Sidebar Filters + Product Grid */}
                    <div className="flex gap-6 items-start">
                        {/* Sticky Left Sidebar Filters */}
                        <aside className="hidden lg:block w-72 shrink-0 bg-white rounded-2xl border border-slate-200/90 p-5 shadow-sm space-y-5 sticky top-24 max-h-[calc(100vh-120px)] overflow-y-auto">
                            {/* Filter Header */}
                            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                                <div className="flex items-center gap-2">
                                    <SlidersHorizontal className="h-4 w-4 text-[#0b2447]" />
                                    <h3 className="text-xs font-black text-[#0b2447] uppercase tracking-wider">Filters</h3>
                                    {activeFiltersCount > 0 && (
                                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-[10px] font-black text-white">
                                            {activeFiltersCount}
                                        </span>
                                    )}
                                </div>
                                {activeFiltersCount > 0 && (
                                    <button
                                        type="button"
                                        onClick={handleClearAllFilters}
                                        className="text-[11px] font-bold text-red-600 hover:underline transition"
                                    >
                                        Reset
                                    </button>
                                )}
                            </div>

                            {renderFilterContent()}

                            {/* Clear All Filters Button at the Bottom of Sidepanel */}
                            <div className="border-t border-slate-100 pt-4">
                                <button
                                    type="button"
                                    onClick={handleClearAllFilters}
                                    disabled={activeFiltersCount === 0}
                                    className={cn(
                                        "w-full h-10 rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5 shadow-sm",
                                        activeFiltersCount > 0
                                            ? "bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 active:scale-98"
                                            : "bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed opacity-60"
                                    )}
                                >
                                    <span>Clear All Filters</span>
                                    {activeFiltersCount > 0 && <span>({activeFiltersCount})</span>}
                                </button>
                            </div>
                        </aside>

                        {/* Mobile Filter Drawer Modal */}
                        {mobileFiltersOpen && (
                            <div
                                className="fixed inset-0 z-50 flex flex-col bg-slate-950/60 backdrop-blur-sm lg:hidden animate-in fade-in duration-200"
                                onClick={(e) => {
                                    if (e.target === e.currentTarget) setMobileFiltersOpen(false);
                                }}
                            >
                                <div className="ml-auto w-full max-w-sm h-full bg-white shadow-2xl flex flex-col overflow-hidden pb-safe animate-in slide-in-from-right duration-300">
                                    {/* Drawer Header */}
                                    <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-[#0b2447] text-white">
                                        <div className="flex items-center gap-2">
                                            <SlidersHorizontal className="h-4 w-4 text-[#c8a45c]" />
                                            <h3 className="font-bold text-sm">Filter Products</h3>
                                            {activeFiltersCount > 0 && (
                                                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-500 px-1 text-[10px] font-black text-white">
                                                    {activeFiltersCount}
                                                </span>
                                            )}
                                        </div>
                                        <button
                                            onClick={() => setMobileFiltersOpen(false)}
                                            className="p-1 rounded-lg hover:bg-white/10 text-white transition-colors"
                                        >
                                            <ChevronLeft className="h-5 w-5" />
                                        </button>
                                    </div>

                                    {/* Drawer Body */}
                                    <div className="flex-1 overflow-y-auto p-4 space-y-5">
                                        {renderFilterContent()}
                                    </div>

                                    {/* Drawer Footer Actions */}
                                    <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center gap-3">
                                        <button
                                            type="button"
                                            onClick={handleClearAllFilters}
                                            disabled={activeFiltersCount === 0}
                                            className="flex-1 h-11 rounded-xl text-xs font-bold border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition"
                                        >
                                            Reset All
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setMobileFiltersOpen(false)}
                                            className="flex-1 h-11 rounded-xl text-xs font-black uppercase tracking-wider bg-[#0b2447] text-white hover:bg-[#12335f] transition shadow-md"
                                        >
                                            Show {sortedItems.length} Items
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Product Grid Area */}
                        <div className="flex-1 min-w-0">
                            {/* Active Filter Chips Bar */}
                            {activeFiltersCount > 0 && (
                                <div className="mb-4 flex flex-wrap items-center gap-2 bg-white p-3 rounded-2xl border border-slate-200/80 shadow-sm">
                                    <span className="text-[11px] font-bold text-slate-400 mr-1">Active:</span>
                                    {searchQuery && (
                                        <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-800 border border-blue-200">
                                            Search: "{searchQuery}"
                                            <button
                                                type="button"
                                                onClick={() => syncUrl({ q: '', page: 1 })}
                                                className="hover:text-red-600 ml-1 font-black"
                                            >
                                                ✕
                                            </button>
                                        </span>
                                    )}
                                    {selectedCategoryIds.map(cId => {
                                        const cat = categories.find((c: any) => String(c.id) === cId);
                                        if (!cat) return null;
                                        return (
                                            <span key={cId} className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-800 border border-blue-200">
                                                {cat.name}
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const next = selectedCategoryIds.filter(id => id !== cId);
                                                        setSelectedCategoryIds(next);
                                                        setPage(1);
                                                        syncUrl({ categoryId: next.join(','), page: 1 });
                                                    }}
                                                    className="hover:text-red-600 ml-1 font-black"
                                                >
                                                    ✕
                                                </button>
                                            </span>
                                        );
                                    })}
                                    {selectedSubcategories.map(sub => (
                                        <span key={sub} className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-800 border border-indigo-200">
                                            {sub}
                                            <button
                                                type="button"
                                                onClick={() => setSelectedSubcategories(prev => prev.filter(s => s !== sub))}
                                                className="hover:text-red-600 ml-1 font-black"
                                            >
                                                ✕
                                            </button>
                                        </span>
                                    ))}
                                    {priceFilter && (
                                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-800 border border-slate-200">
                                            Price: {priceFilter.replace('_', ' ')}
                                            <button type="button" onClick={() => { setPriceFilter(''); setPage(1); }} className="hover:text-red-600 ml-1 font-black">✕</button>
                                        </span>
                                    )}
                                    {brandSearchFilter && (
                                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-800 border border-slate-200">
                                            Seller: {brandSearchFilter}
                                            <button type="button" onClick={() => { setBrandSearchFilter(''); setPage(1); syncUrl({ brand: '', page: 1 }); }} className="hover:text-red-600 ml-1 font-black">✕</button>
                                        </span>
                                    )}
                                    {districtFilter && (
                                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-800 border border-slate-200">
                                            Location: {districtFilter}
                                            <button type="button" onClick={() => { setDistrictFilter(''); setPage(1); syncUrl({ district: '', page: 1 }); }} className="hover:text-red-600 ml-1 font-black">✕</button>
                                        </span>
                                    )}
                                    {minRatingFilter > 0 && (
                                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800 border border-emerald-200">
                                            ★ {minRatingFilter}+
                                            <button type="button" onClick={() => setMinRatingFilter(0)} className="hover:text-red-600 ml-1 font-black">✕</button>
                                        </span>
                                    )}
                                    {fastDispatchFilter && (
                                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800 border border-amber-200">
                                            ⚡ Fast Dispatch
                                            <button type="button" onClick={() => setFastDispatchFilter(false)} className="hover:text-red-600 ml-1 font-black">✕</button>
                                        </span>
                                    )}
                                    <button
                                        type="button"
                                        onClick={handleClearAllFilters}
                                        className="text-xs font-black text-red-600 hover:underline ml-auto px-2"
                                    >
                                        Clear All
                                    </button>
                                </div>
                            )}
                            
                            {(isLoading || !hasLoadedList) && items.length === 0 ? (
                                <div className="flex w-full items-center justify-center py-24">
                                    <ProductCartLoader />
                                </div>
                            ) : sortedItems.length === 0 ? (
                                <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center shadow-sm">
                                    <Package className="h-16 w-16 text-slate-300 mx-auto mb-4" />
                                    <h3 className="text-base font-black text-slate-800">
                                        {activeCategory ? `No products found in ${activeCategory.name}` : 'No products found matching your filter criteria.'}
                                    </h3>
                                    <p className="mt-1.5 text-xs font-medium text-slate-500">
                                        Try adjusting your search query, price range, or clearing filters.
                                    </p>
                                    <div className="mt-6 flex justify-center gap-3">
                                        <button
                                            type="button"
                                            onClick={handleClearAllFilters}
                                            className="h-10 px-5 rounded-xl bg-[#0b2447] text-white text-xs font-black hover:bg-[#12335f] transition"
                                        >
                                            View All Products
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
                                    {sortedItems.map((item: any, idx: number) => {
                                        const isFallback = item.id < 0;
                                        const imageUrl = resolveMarketplaceImage(item, isServices ? 'service' : 'product');
                                        const sellerName = item.organization?.organizationName || item.seller?.name || 'Verified Supplier';
                                        const isVerified = item.organization?.verificationStatus === 'VERIFIED';
                                        const pricing = getProductPricing(item);
                                        const cartQuantity = isFallback ? 0 : getCartQuantity(item.id);
                                        const detailUrl = isFallback
                                            ? (isServices ? '/marketplace/services' : '/marketplace/products')
                                            : (isServices ? `/marketplace/services/${item.id}` : `/marketplace/products/${item.id}`);

                                        // Mock badges & reviews for authentic e-commerce feel
                                        const dispatchBadges = ['⚡ 48h Dispatch', 'Top Seller', 'Assured MSME', 'Fast Dispatch'];
                                        const dispatchBadge = dispatchBadges[idx % dispatchBadges.length];
                                        const reviewCount = 18 + ((item.id * 7) % 35);
                                        const ratingScore = (4.5 + ((item.id * 3) % 5) / 10).toFixed(1);

                                        return (
                                            <div
                                                key={item.id}
                                                className="group flex flex-col justify-between bg-white rounded-2xl border border-slate-200/90 p-4 shadow-sm hover:shadow-md hover:border-blue-400 transition-all duration-200"
                                            >
                                                <div>
                                                    {/* Top Badge Header */}
                                                    <div className="flex items-center justify-between mb-2">
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200/60">
                                                            {dispatchBadge}
                                                        </span>
                                                        <span className="text-[10px] font-black text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded border border-orange-200">
                                                            {pricing.discountPercent}% OFF
                                                        </span>
                                                    </div>

                                                    {/* Realistic Centered Product Image */}
                                                    <Link
                                                        href={detailUrl}
                                                        onClick={() => { if (!isFallback) cacheAndTrackItem(item); }}
                                                        className="relative block h-44 w-full bg-white flex items-center justify-center overflow-hidden my-2 cursor-pointer"
                                                    >
                                                        {imageUrl ? (
                                                            <img
                                                                src={imageUrl}
                                                                alt={item.name}
                                                                loading="lazy"
                                                                decoding="async"
                                                                className="max-h-full max-w-full object-contain p-2 transition-transform duration-300 group-hover:scale-105"
                                                            />
                                                        ) : (
                                                            <Package className="h-16 w-16 text-slate-300" />
                                                        )}
                                                    </Link>

                                                    {/* Star Rating Badge */}
                                                    <div className="flex items-center gap-1.5 mt-3 mb-2">
                                                        <span className="inline-flex items-center gap-1 bg-[#15803d] text-white px-2 py-0.5 rounded text-[10px] font-black">
                                                            ★ {ratingScore}
                                                        </span>
                                                        <span className="text-[10px] font-semibold text-slate-400">
                                                            ({reviewCount} Reviews)
                                                        </span>
                                                    </div>

                                                    {/* Product Title */}
                                                    <Link
                                                        href={detailUrl}
                                                        onClick={() => { if (!isFallback) cacheAndTrackItem(item); }}
                                                        className="block my-2"
                                                    >
                                                        <h3 className="text-xs sm:text-sm font-bold text-slate-900 line-clamp-2 min-h-[38px] leading-snug group-hover:text-blue-600 transition">
                                                            {item.name}
                                                        </h3>
                                                    </Link>

                                                    {/* By Seller */}
                                                    <p className="mt-1.5 text-[11px] font-semibold text-slate-500 flex items-center gap-1 truncate">
                                                        <span>By: {sellerName}</span>
                                                        {isVerified && <BadgeCheck className="h-3.5 w-3.5 text-blue-600 shrink-0" />}
                                                    </p>
                                                </div>

                                                {/* Price & Action Buttons */}
                                                <div className="mt-4 border-t border-slate-100 pt-3">
                                                    {/* Price Section */}
                                                    {user ? (
                                                        <div className="flex items-baseline gap-2 flex-wrap mb-3">
                                                            <span className="text-lg font-black text-slate-900">
                                                                ₹{pricing.effectivePrice.toLocaleString('en-IN')}
                                                            </span>
                                                            <span className="text-xs text-slate-400 line-through">
                                                                ₹{pricing.originalPrice.toLocaleString('en-IN')}
                                                            </span>
                                                            <span className="text-xs font-black text-emerald-600">
                                                                {pricing.discountPercent}% OFF
                                                            </span>
                                                        </div>
                                                    ) : (
                                                        <div className="mb-3 mt-1">
                                                            <span className="inline-block rounded bg-slate-100 border border-slate-200 px-2 py-1 text-[10px] font-bold text-slate-500">
                                                                Login to view price
                                                            </span>
                                                        </div>
                                                    )}

                                                    {/* Actions Row */}
                                                    <div className="flex gap-2 items-center">
                                                        {showBuyerMarketplaceActions && (
                                                            cartQuantity > 0 ? (
                                                                <div className="flex-1 inline-flex h-8 items-center justify-between rounded-xl border border-[#0b2447]/30 bg-white text-[#0b2447] shadow-sm px-1">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleCartQuantityChange(item, cartQuantity - 1)}
                                                                        className="h-6 w-6 rounded flex items-center justify-center bg-slate-100 hover:bg-slate-200"
                                                                    >
                                                                        <Minus className="h-3 w-3" />
                                                                    </button>
                                                                    <span className="text-xs font-black tabular-nums">{cartQuantity}</span>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleCartQuantityChange(item, cartQuantity + 1)}
                                                                        className="h-6 w-6 rounded flex items-center justify-center bg-slate-100 hover:bg-slate-200"
                                                                    >
                                                                        <Plus className="h-3 w-3" />
                                                                    </button>
                                                                </div>
                                                            ) : (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleAddToCart(item, { showToast: true })}
                                                                    className="flex-1 h-8 rounded-xl bg-[#0b2447] text-white text-xs font-black hover:bg-[#12335f] transition flex items-center justify-center gap-1.5"
                                                                >
                                                                    <ShoppingCart className="h-3.5 w-3.5" />
                                                                    Add to Cart
                                                                </button>
                                                            )
                                                        )}

                                                        <button
                                                            type="button"
                                                            onClick={() => handleRequestQuote(item)}
                                                            className="h-8 px-3 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-bold hover:bg-slate-50 transition"
                                                            title="Request Quote"
                                                        >
                                                            Quote
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {/* Auto Infinite Scroll Loading Skeleton & Bottom Sentinel */}
                            <div ref={observerTargetRef} className="w-full">
                                {isFetchingNextPage && (
                                    <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                                        {[1, 2, 3, 4].map(i => (
                                            <div key={i} className="h-80 rounded-2xl bg-white border border-slate-200 p-4 animate-pulse">
                                                <div className="h-36 bg-slate-100 rounded-xl mb-3" />
                                                <div className="h-4 bg-slate-100 rounded w-3/4 mb-2" />
                                                <div className="h-3 bg-slate-100 rounded w-1/2" />
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {!hasMore && sortedItems.length > 0 && (
                                    <div className="mt-10 flex flex-col items-center justify-center gap-2 rounded-2xl border border-slate-200/80 bg-white p-6 text-center shadow-sm">
                                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 font-bold">
                                            ✓
                                        </div>
                                        <h4 className="text-xs font-black text-slate-800">
                                            You've reached the end of the catalogue
                                        </h4>
                                        <p className="text-[11px] font-semibold text-slate-400">
                                            Showing all {sortedItems.length} {isServices ? 'services' : 'products'}{activeCategory ? ` in ${activeCategory.name}` : ''}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            {!useDashboardShell && <MarketplaceFooter />}
            <CompareTray />
        </div>
    );
}
