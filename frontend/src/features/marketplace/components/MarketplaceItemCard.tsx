'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BadgeCheck, Eye, FileText, MapPin, Minus, Package, Plus, ShoppingCart, Wrench } from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '../../../components/ui/button';
import { useAuth } from '../../../hooks/useAuth';
import { cn } from '../../../lib/utils';
import { marketplaceApi, type MarketplaceProduct, type MarketplaceService } from '../api';
import { useGuestCart } from '../hooks/useGuestCart';
import { CompareToggleButton } from './CompareToggleButton';
import { resolveMarketplaceImage } from '../utils/marketplaceImages';

export type MarketplaceDiscoveryItem = MarketplaceProduct | MarketplaceService | (Record<string, any> & {
    id: number;
    name: string;
});

type MarketplaceItemType = 'product' | 'service';

interface MarketplaceItemCardProps {
    item: MarketplaceDiscoveryItem;
    itemType?: MarketplaceItemType;
    showAddToCart?: boolean;
    showCompare?: boolean;
    showRequestQuote?: boolean;
    className?: string;
}

function inferItemType(item: MarketplaceDiscoveryItem, itemType?: MarketplaceItemType): MarketplaceItemType {
    if (itemType) return itemType;
    if ('pricingModel' in item || 'basePrice' in item || (item as any).itemType === 'SERVICE') return 'service';
    return 'product';
}

function getCurrentPrice(item: MarketplaceDiscoveryItem, type: MarketplaceItemType) {
    const discountPrice = Number((item as any).discountPrice || 0);
    if (discountPrice > 0) return discountPrice;
    return Number(type === 'service' ? (item as MarketplaceService).basePrice || 0 : (item as MarketplaceProduct).price || 0);
}

function getDiscount(item: MarketplaceDiscoveryItem) {
    const original = Number((item as any).originalPrice || 0);
    const discountPrice = Number((item as any).discountPrice || 0);
    const explicitPercent = Number((item as any).discountPercent || 0);
    const active = (item as any).isOfferActive !== false;
    if (!active || original <= 0 || discountPrice <= 0 || discountPrice >= original) {
        return null;
    }
    const percent = explicitPercent > 0 ? explicitPercent : Math.round(((original - discountPrice) / original) * 100);
    return { original, discountPrice, percent };
}

function formatMoney(value: number) {
    return `Rs. ${value.toLocaleString('en-IN')}`;
}

export function MarketplaceItemCard({
    item,
    itemType,
    showAddToCart = true,
    showCompare = true,
    showRequestQuote = true,
    className,
}: MarketplaceItemCardProps) {
    const type = inferItemType(item, itemType);
    const { user } = useAuth();
    const router = useRouter();
    const queryClient = useQueryClient();
    const { items: cartItems, add, update } = useGuestCart();
    const [imageFailed, setImageFailed] = React.useState(false);
    const resolvedImageUrl = resolveMarketplaceImage(item, type);
    const imageUrl = imageFailed ? '' : resolvedImageUrl;
    const detailHref = (item as any).detailUrl || `/marketplace/${type === 'service' ? 'services' : 'products'}/${item.id}`;
    const category = (item as any).category || ((item as any).categoryName ? { name: (item as any).categoryName, id: (item as any).categoryId } : undefined);
    const organization = (item as any).organization;
    const sellerName = organization?.organizationName || (item as any).sellerName || (item as any).seller?.name || 'Verified MSME seller';
    const sellerVerified = organization?.verificationStatus === 'VERIFIED' || (item as any).sellerVerified;
    const location = organization?.city || organization?.district || (item as any).district || (item as any).location;
    const price = getCurrentPrice(item, type);
    const discount = getDiscount(item);
    const cartItem = cartItems.find((cart) => cart.id === item.id && cart.type === type);
    const quantity = cartItem?.quantity || 0;

    React.useEffect(() => {
        setImageFailed(false);
    }, [resolvedImageUrl]);

    const isLocal = String(location || '').toLowerCase().includes('jharsuguda') || String(organization?.state || '').toLowerCase().includes('odisha');
    const isHerShg = [organization?.organizationType, organization?.profile?.groupType, organization?.profile?.category, (item as any).sellerType]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes('shg') || String(value).toLowerCase().includes('women'));

    const cacheDetail = () => {
        queryClient.setQueryData(
            [type === 'service' ? 'marketplaceService' : 'marketplaceProduct', item.id],
            type === 'service' ? { service: item, relatedServices: [] } : { product: item, relatedProducts: [] }
        );
        marketplaceApi.trackInteraction({
            itemId: item.id,
            itemType: type === 'service' ? 'SERVICE' : 'PRODUCT',
            categoryId: category?.id,
            action: 'VIEW',
            metadata: { source: 'marketplace-card', name: item.name },
        }).catch(() => undefined);
    };

    const addToCart = (event: React.MouseEvent) => {
        event.preventDefault();
        event.stopPropagation();
        add({
            id: item.id,
            name: item.name,
            price: price || undefined,
            unit: type === 'service' ? (item as MarketplaceService).pricingModel : (item as MarketplaceProduct).unitOfMeasure,
            imageUrl,
            category: category?.name,
            type,
        });
        marketplaceApi.trackInteraction({
            itemId: item.id,
            itemType: type === 'service' ? 'SERVICE' : 'PRODUCT',
            categoryId: category?.id,
            action: 'ADD_TO_CART',
            metadata: { source: 'marketplace-card' },
        }).catch(() => undefined);
        toast.success(`${item.name} added to cart`);
    };

    const changeQuantity = (event: React.MouseEvent, nextQuantity: number) => {
        event.preventDefault();
        event.stopPropagation();
        update(item.id, type, nextQuantity);
    };

    const requestQuote = (event: React.MouseEvent) => {
        event.preventDefault();
        event.stopPropagation();
        if (!user) {
            toast.info('Login to request a quote', {
                action: { label: 'Login', onClick: () => router.push(`/login?redirect=${encodeURIComponent(detailHref)}`) },
            });
            return;
        }
        marketplaceApi.trackInteraction({
            itemId: item.id,
            itemType: type === 'service' ? 'SERVICE' : 'PRODUCT',
            categoryId: category?.id,
            action: 'REQUIREMENT_POSTED',
            metadata: { source: 'request-quote-button' },
        }).catch(() => undefined);
        router.push(`/buyer/requirements/new?itemType=${type.toUpperCase()}&itemId=${item.id}`);
    };

    return (
        <article className={cn('group flex min-h-[354px] w-56 shrink-0 snap-start flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-[#0b2447]/30 hover:shadow-md sm:w-60 2xl:w-64', className)}>
            <Link href={detailHref} onClick={cacheDetail} className="relative block h-36 overflow-hidden bg-slate-50">
                {imageUrl ? (
                    <img src={imageUrl} alt={item.name} loading="lazy" onError={() => setImageFailed(true)} className="h-full w-full object-contain p-2 transition duration-300 group-hover:scale-105" />
                ) : (
                    <span className="flex h-full w-full items-center justify-center text-slate-300">
                        {type === 'service' ? <Wrench className="h-10 w-10" /> : <Package className="h-10 w-10" />}
                    </span>
                )}
                <span className="absolute left-2 top-2 rounded bg-white/95 px-2 py-1 text-[9px] font-black uppercase tracking-wider text-[#0b2447] shadow-sm">
                    {type === 'service' ? 'Service' : 'Product'}
                </span>
                {discount && (
                    <span className="absolute right-2 top-2 rounded bg-[#fff7ed] px-2 py-1 text-[9px] font-black uppercase tracking-wide text-[#c86413] shadow-sm">
                        {discount.percent}% off
                    </span>
                )}
            </Link>

            <div className="flex flex-1 flex-col p-3">
                <div className="mb-2 flex flex-wrap gap-1">
                    {sellerVerified && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[9px] font-black uppercase text-emerald-700">
                            <BadgeCheck className="h-2.5 w-2.5" /> Verified
                        </span>
                    )}
                    {isLocal && (
                        <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[9px] font-black uppercase text-blue-700">
                            Local MSME
                        </span>
                    )}
                    {isHerShg && (
                        <span className="rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-[9px] font-black uppercase text-green-700">
                            HerSHG
                        </span>
                    )}
                </div>

                {category?.name && (
                    <Link href={`/marketplace/${type === 'service' ? 'services' : 'products'}?categoryId=${category.id || ''}`} className="text-[9px] font-black uppercase tracking-wider text-[#0b2447]/55 hover:text-[#0b2447]">
                        {category.name}
                    </Link>
                )}
                <Link href={detailHref} onClick={cacheDetail}>
                    <h3 className="mt-1 line-clamp-2 min-h-[34px] text-xs font-black leading-snug text-slate-900 transition group-hover:text-[#0b2447]">
                        {item.name}
                    </h3>
                </Link>
                <p className="mt-1 truncate text-[10px] font-semibold text-slate-500">{sellerName}</p>
                {location && (
                    <p className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold text-slate-400">
                        <MapPin className="h-3 w-3" /> {location}
                    </p>
                )}

                <div className="mt-3 min-h-[42px]">
                    {price > 0 ? (
                        <div>
                            <p className="text-base font-black text-[#0b2447]">{formatMoney(price)}</p>
                            <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                                {discount && <span className="text-[10px] font-bold text-slate-400 line-through">{formatMoney(discount.original)}</span>}
                                <span className="text-[10px] font-bold text-slate-500">
                                    {type === 'service' ? ((item as MarketplaceService).pricingModel || 'Quote') : ((item as MarketplaceProduct).unitOfMeasure || (item as any).unit || 'Unit')}
                                </span>
                            </div>
                        </div>
                    ) : (
                        <span className="inline-flex rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] font-black uppercase text-amber-700">
                            Request quote
                        </span>
                    )}
                </div>

                <div className="mt-auto space-y-2 pt-3">
                    <div className="grid grid-cols-[1fr_auto] gap-2">
                        <Link href={detailHref} onClick={cacheDetail}>
                            <Button type="button" variant="outline" size="sm" className="w-full gap-1">
                                <Eye className="h-3.5 w-3.5" /> Details
                            </Button>
                        </Link>
                        {showCompare && (
                            <CompareToggleButton item={{ type, id: item.id, categoryId: category?.id }} iconOnly className="h-8 w-8" />
                        )}
                    </div>
                    {showAddToCart && (
                        quantity > 0 ? (
                            <div className="flex h-8 items-center justify-between overflow-hidden rounded-lg border-2 border-[#0b2447]">
                                <button type="button" onClick={(event) => changeQuantity(event, quantity - 1)} className="flex h-full w-9 items-center justify-center text-[#0b2447] transition hover:bg-blue-50" aria-label="Decrease quantity">
                                    <Minus className="h-3.5 w-3.5" />
                                </button>
                                <span className="text-xs font-black tabular-nums text-[#0b2447]">{quantity}</span>
                                <button type="button" onClick={(event) => changeQuantity(event, quantity + 1)} className="flex h-full w-9 items-center justify-center text-[#0b2447] transition hover:bg-blue-50" aria-label="Increase quantity">
                                    <Plus className="h-3.5 w-3.5" />
                                </button>
                            </div>
                        ) : (
                            <Button type="button" size="sm" onClick={addToCart} className="w-full gap-1">
                                <ShoppingCart className="h-3.5 w-3.5" /> Add to Cart
                            </Button>
                        )
                    )}
                    {showRequestQuote && (
                        <Button type="button" variant="outline" size="sm" onClick={requestQuote} className="w-full gap-1 border-[#0b2447]/20 text-[#0b2447]">
                            <FileText className="h-3.5 w-3.5" /> Request Quote
                        </Button>
                    )}
                </div>
            </div>
        </article>
    );
}
