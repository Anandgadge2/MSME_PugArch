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

    return (
        <article
            className={cn(
                'group relative flex w-[190px] sm:w-[215px] shrink-0 snap-start flex-col overflow-hidden rounded-2xl bg-white p-3.5 border border-slate-200/80 shadow-sm hover:shadow-xl hover:border-blue-200/80 transition-all duration-300 ease-out hover:-translate-y-1',
                className
            )}
        >
            <div className="flex-1 flex flex-col">
                {/* ── Product Image ── */}
                <Link
                    href={detailHref}
                    onClick={cacheDetail}
                    className="relative block h-[155px] sm:h-[165px] w-full overflow-hidden rounded-xl bg-gradient-to-br from-slate-50 via-blue-50/25 to-slate-100 border border-slate-100/90 flex items-center justify-center shrink-0 cursor-pointer shadow-inner transition-all duration-300 group-hover:border-blue-200"
                >
                    {imageUrl ? (
                        <img
                            src={imageUrl}
                            alt={item.name}
                            loading="lazy"
                            onError={() => setImageFailed(true)}
                            className="h-full w-full object-contain p-2 mix-blend-multiply transition-transform duration-300 ease-out group-hover:scale-108"
                        />
                    ) : (
                        <span className="flex h-full w-full items-center justify-center text-slate-300">
                            {type === 'service' ? <Wrench className="h-10 w-10 text-indigo-400" /> : <Package className="h-10 w-10 text-blue-400" />}
                        </span>
                    )}
                </Link>

                {/* ── Star Rating & Discount Pill Row ── */}
                <div className="mt-3 flex items-center justify-between gap-1.5 min-h-[22px]">
                    <div className="flex items-center gap-1">
                        {ratingScore && reviewCount > 0 ? (
                            <>
                                <span className="flex items-center text-xs font-black text-amber-500 bg-amber-50 px-1.5 py-0.5 rounded-md border border-amber-200/60">
                                    <span className="mr-0.5 text-xs leading-none">★</span> {ratingScore}
                                </span>
                                <span className="text-[10px] font-semibold text-slate-400">
                                    ({reviewCount})
                                </span>
                            </>
                        ) : (
                            <span className="text-[10px] font-semibold text-slate-400 bg-slate-50 border border-slate-100 px-1.5 py-0.5 rounded-md">
                                ★ New Listing
                            </span>
                        )}
                    </div>

                    {user && discountPercent > 0 && (
                        <span className="inline-flex rounded-full bg-gradient-to-r from-emerald-500 to-teal-600 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-white shadow-sm">
                            {discountPercent}% OFF
                        </span>
                    )}
                </div>

                {/* ── Product Title ── */}
                <Link href={detailHref} onClick={cacheDetail} className="block mt-1.5 mb-2">
                    <h3
                        className="line-clamp-2 text-xs sm:text-[13px] font-bold leading-snug text-slate-800 transition-colors duration-200 group-hover:text-blue-600"
                        title={item.name}
                    >
                        {item.name}
                    </h3>
                </Link>

                <div className="mt-auto">
                    {/* ── Seller Info ── */}
                    {sellerName && (
                        <div className="mb-2 text-[10px] font-medium text-slate-500 truncate" title={`Sold by ${sellerName}`}>
                            Sold by <span className="text-slate-700 font-semibold">{sellerName}</span>
                        </div>
                    )}
                </div>
            </div>

            {/* ── Action Button ── */}
            <div className="mt-1 pt-1.5 border-t border-slate-100">
                <Link
                    href={detailHref}
                    onClick={cacheDetail}
                    className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-[#0b2447] via-[#123668] to-[#0b2447] hover:from-blue-600 hover:via-indigo-600 hover:to-blue-600 px-3 py-2 text-xs font-bold text-white shadow-sm hover:shadow-blue-500/25 transition-all duration-300 active:scale-[0.98]"
                >
                    <span>View Product</span>
                    <span className="text-blue-200 transition-transform duration-200 group-hover:translate-x-0.5">&rarr;</span>
                </Link>
            </div>
        </article>
    );
}
