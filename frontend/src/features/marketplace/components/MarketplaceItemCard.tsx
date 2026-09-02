'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Minus, Package, Plus, ShoppingCart, Wrench } from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../../hooks/useAuth';
import { cn } from '../../../lib/utils';
import { marketplaceApi, type MarketplaceProduct, type MarketplaceService } from '../api';
import { useMarketplaceCart } from '../hooks/useMarketplaceCart';
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
    hideSeller?: boolean;
    className?: string;
}

function inferItemType(item: MarketplaceDiscoveryItem, itemType?: MarketplaceItemType): MarketplaceItemType {
    if (itemType) return itemType;
    if ('pricingModel' in item || 'basePrice' in item || (item as any).itemType === 'SERVICE') return 'service';
    return 'product';
}

export function MarketplaceItemCard({
    item,
    itemType,
    showAddToCart = true,
    hideSeller = false,
    className,
}: MarketplaceItemCardProps) {
    const type = inferItemType(item, itemType);
    const { user } = useAuth();
    const router = useRouter();
    const queryClient = useQueryClient();
    const { add, update, getQuantity, buyNow } = useMarketplaceCart();

    const resolvedImageUrl = resolveMarketplaceImage(item, type);
    const [imageFailed, setImageFailed] = useState(false);
    const [prevImageUrl, setPrevImageUrl] = useState(resolvedImageUrl);
    if (prevImageUrl !== resolvedImageUrl) {
        setPrevImageUrl(resolvedImageUrl);
        setImageFailed(false);
    }
    const imageUrl = imageFailed ? '' : resolvedImageUrl;
    const detailHref = (item as any).detailUrl || `/marketplace/${type === 'service' ? 'services' : 'products'}/${item.id}`;
    const category = (item as any).category || ((item as any).categoryName ? { name: (item as any).categoryName, id: (item as any).categoryId } : undefined);

    // Pricing calculation - authentic discounts only
    const baseItemPrice = Number(type === 'service' ? (item as any).basePrice || (item as any).price || 0 : (item as any).price || 0);
    const originalPrice = Number((item as any).originalPrice || 0);
    const discountPrice = Number((item as any).discountPrice || 0);
    const explicitPercent = Number((item as any).discountPercent || 0);

    let effectivePrice = baseItemPrice;
    let displayOriginalPrice = originalPrice > 0 ? originalPrice : baseItemPrice;
    let discountPercent = 0;

    if (discountPrice > 0 && discountPrice < displayOriginalPrice) {
        effectivePrice = discountPrice;
        discountPercent = explicitPercent > 0 ? explicitPercent : Math.round(((displayOriginalPrice - discountPrice) / displayOriginalPrice) * 100);
    } else if (originalPrice > 0 && baseItemPrice > 0 && originalPrice > baseItemPrice) {
        effectivePrice = baseItemPrice;
        displayOriginalPrice = originalPrice;
        discountPercent = explicitPercent > 0 ? explicitPercent : Math.round(((originalPrice - baseItemPrice) / originalPrice) * 100);
    } else if (explicitPercent > 0 && explicitPercent < 100 && baseItemPrice > 0) {
        discountPercent = explicitPercent;
        displayOriginalPrice = originalPrice > 0 ? originalPrice : Math.round(baseItemPrice / (1 - explicitPercent / 100));
        effectivePrice = baseItemPrice;
    }

    // Authentic star rating & reviews
    const rawRating = (item as any).avgRating ?? (item as any).rating ?? (item as any).averageRating;
    const ratingScore = rawRating && Number(rawRating) > 0 ? Number(rawRating).toFixed(1) : null;
    const reviewCount = Number((item as any).reviewCount ?? (item as any).reviewsCount ?? 0);

    const sellerName = (item as any).seller?.name || (item as any).organization?.name || (item as any).organization?.organizationName;

    const cacheDetail = () => {
        if (item.id && typeof item.id === 'number' && item.id > 0) {
            void queryClient.prefetchQuery({
                queryKey: [type === 'service' ? 'marketplaceService' : 'marketplaceProduct', item.id],
                queryFn: () => type === 'service' ? marketplaceApi.getServiceDetail(item.id) : marketplaceApi.getProductDetail(item.id),
                staleTime: 60 * 1000,
            });
        }
        marketplaceApi.trackInteraction({
            itemId: item.id,
            itemType: type === 'service' ? 'SERVICE' : 'PRODUCT',
            categoryId: category?.id,
            action: 'VIEW',
            metadata: { source: 'marketplace-card', name: item.name },
        }).catch(() => undefined);
    };

    return (
        <article
            className={cn(
                'group relative flex w-[180px] sm:w-[200px] shrink-0 snap-start flex-col overflow-hidden rounded-xl bg-white p-2.5 sm:p-3 border border-slate-200/80 shadow-2xs hover:shadow-md hover:border-blue-300 transition-all duration-200 ease-out hover:-translate-y-0.5',
                className
            )}
        >
            <div className="flex-1 flex flex-col">
                {/* ── Product Image ── */}
                <Link
                    href={detailHref}
                    onClick={cacheDetail}
                    className="relative block h-32 sm:h-36 w-full overflow-hidden rounded-lg bg-gradient-to-br from-slate-50 via-blue-50/20 to-slate-100/60 border border-slate-100 flex items-center justify-center shrink-0 cursor-pointer transition-all duration-200 group-hover:border-blue-200"
                >
                    {imageUrl ? (
                        <img
                            src={imageUrl}
                            alt={item.name}
                            loading="lazy"
                            onError={() => setImageFailed(true)}
                            className="h-full w-full object-contain p-2 mix-blend-multiply transition-transform duration-200 ease-out group-hover:scale-105"
                        />
                    ) : (
                        <span className="flex h-full w-full items-center justify-center text-slate-300">
                            {type === 'service' ? <Wrench className="h-8 w-8 text-indigo-400" /> : <Package className="h-8 w-8 text-blue-400" />}
                        </span>
                    )}
                </Link>

                {/* ── Star Rating & Discount Pill Row ── */}
                <div className="mt-2 flex items-center justify-between gap-1 min-h-[18px]">
                    <div className="flex items-center gap-1">
                        {ratingScore && reviewCount > 0 ? (
                            <>
                                <span className="flex items-center text-[10px] font-bold text-amber-600 bg-amber-50 px-1 py-0.5 rounded border border-amber-200/60">
                                    <span className="mr-0.5 text-[10px] leading-none">★</span> {ratingScore}
                                </span>
                                <span className="text-[9px] font-medium text-slate-400">
                                    ({reviewCount})
                                </span>
                            </>
                        ) : (
                            <span className="text-[9px] font-medium text-slate-400 bg-slate-50 border border-slate-100 px-1.5 py-0.5 rounded">
                                ★ New Listing
                            </span>
                        )}
                    </div>

                    {user && discountPercent > 0 && (
                        <span className="inline-flex rounded bg-emerald-600 px-1.5 py-0.5 text-[8.5px] font-bold uppercase tracking-wider text-white shadow-2xs">
                            {discountPercent}% OFF
                        </span>
                    )}
                </div>

                {/* ── Product Title ── */}
                <Link href={detailHref} onClick={cacheDetail} className="block mt-1 mb-1">
                    <h3
                        className="line-clamp-2 text-xs font-bold leading-snug text-slate-800 transition-colors duration-150 group-hover:text-blue-600 min-h-[32px]"
                        title={item.name}
                    >
                        {item.name}
                    </h3>
                </Link>

                <div className="mt-auto">
                    {/* ── Pricing ── */}
                    {user ? (
                        <div className="flex items-baseline gap-1.5 flex-wrap my-1">
                            <span className="text-xs sm:text-sm font-black text-slate-900">
                                {effectivePrice > 0 ? `₹${effectivePrice.toLocaleString('en-IN')}` : 'Price on Request'}
                            </span>
                            {discountPercent > 0 && displayOriginalPrice > effectivePrice && (
                                <span className="text-[9.5px] text-slate-400 line-through">
                                    ₹{displayOriginalPrice.toLocaleString('en-IN')}
                                </span>
                            )}
                        </div>
                    ) : (
                        <div className="my-1">
                            <span className="inline-block rounded bg-slate-100 border border-slate-200 px-1.5 py-0.5 text-[9px] font-medium text-slate-500">
                                Login for price
                            </span>
                        </div>
                    )}

                    {/* ── Seller Info (optional) ── */}
                    {!hideSeller && sellerName && (
                        <div className="mb-1 text-[9.5px] font-medium text-slate-500 truncate" title={`Sold by ${sellerName}`}>
                            Sold by <span className="text-slate-700 font-semibold">{sellerName}</span>
                        </div>
                    )}
                </div>
            </div>

            {/* ── Action Button ── */}
            <div className="mt-1.5 pt-1.5 border-t border-slate-100">
                <Link
                    href={detailHref}
                    onClick={cacheDetail}
                    className="flex w-full items-center justify-center gap-1 rounded-lg bg-[#0b2447] hover:bg-blue-700 px-2.5 py-1.5 text-[11px] font-bold text-white shadow-2xs transition-colors duration-150 active:scale-[0.98]"
                >
                    <span>View {type === 'service' ? 'Service' : 'Product'}</span>
                    <span className="text-blue-200 transition-transform duration-150 group-hover:translate-x-0.5">&rarr;</span>
                </Link>
            </div>
        </article>
    );
}
