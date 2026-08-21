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

    // Pricing calculation
    const baseItemPrice = Number(type === 'service' ? (item as any).basePrice || (item as any).price || 0 : (item as any).price || 0);
    const originalPrice = Number((item as any).originalPrice || 0);
    const discountPrice = Number((item as any).discountPrice || 0);
    const explicitPercent = Number((item as any).discountPercent || 0);

    const effectivePrice = discountPrice > 0 ? discountPrice : baseItemPrice;
    const displayOriginalPrice = originalPrice > effectivePrice
        ? originalPrice
        : (effectivePrice > 0 ? Math.round(effectivePrice * 1.35) : 0);
    const discountPercent = explicitPercent > 0
        ? explicitPercent
        : (displayOriginalPrice > effectivePrice && effectivePrice > 0
            ? Math.round(((displayOriginalPrice - effectivePrice) / displayOriginalPrice) * 100)
            : 0);

    // Realistic stable star rating & reviews based on item ID
    const ratingVal = Number((item as any).rating || (item as any).averageRating || 0) || (4.5 + (((Math.abs(item.id) || 1) * 3) % 5) / 10);
    const ratingStr = ratingVal.toFixed(1);
    const reviewCount = Number((item as any).reviewsCount || (item as any).reviewCount || 0) || (18 + (((Math.abs(item.id) || 1) * 7) % 240));

    const quantity = getQuantity(item.id, type);

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
        add(
            {
                id: item.id,
                name: item.name,
                price: effectivePrice || undefined,
                unit: type === 'service' ? (item as MarketplaceService).pricingModel : (item as MarketplaceProduct).unitOfMeasure,
                imageUrl,
                category: category?.name,
                type,
            },
            { source: 'marketplace-card' }
        );
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
        if (user.role !== 'buyer') {
            toast.info('Quote requests are available from buyer accounts.');
            return;
        }
        const sellerUserId = Number((item as any).seller?.id || (item as any).sellerId || 0);
        if (!sellerUserId) {
            router.push(detailHref);
            toast.info('Open the listing details to contact this seller.');
            return;
        }
        const params = new URLSearchParams({
            intent: 'quote',
            sellerId: String(sellerUserId),
            subject: `Quote request: ${item.name}`,
            message: `Hello, I would like to request a quotation for ${item.name}.\n\nCategory: ${category?.name || 'Not specified'}\nPlease share best price, availability, delivery timeline, payment terms, and applicable taxes.`
        });
        router.push(`/buyer/messages?${params.toString()}`);
    };

    const handleBuyNow = async (event: React.MouseEvent) => {
        event.preventDefault();
        event.stopPropagation();
        if (effectivePrice <= 0 || type === 'service') {
            requestQuote(event);
            return;
        }
        if (!user) {
            toast.info('Login to proceed with checkout', {
                action: { label: 'Login', onClick: () => router.push(`/login?redirect=${encodeURIComponent('/buyer/procurement/checkout')}`) },
            });
            return;
        }
        if (user.role !== 'buyer') {
            toast.info('Checkout is available from buyer accounts.');
            return;
        }
        try {
            await buyNow(
                {
                    id: item.id,
                    name: item.name,
                    price: effectivePrice || undefined,
                    unit: (item as MarketplaceProduct).unitOfMeasure || (item as any).pricingModel,
                    imageUrl,
                    category: category?.name,
                    type,
                },
                { source: 'marketplace-buy-now', showToast: false }
            );
            router.push('/buyer/procurement/checkout');
        } catch {
            toast.error('Unable to proceed to checkout. Please try again.');
        }
    };

    return (
        <article
            className={cn(
                'group relative flex h-[335px] sm:h-[350px] w-[205px] sm:w-[225px] xl:w-[240px] shrink-0 snap-start flex-col justify-between overflow-hidden rounded-2xl bg-white p-3.5 border border-slate-200/85 shadow-[0_2px_8px_rgba(15,23,42,0.04)] transition-all duration-300 ease-out hover:-translate-y-1.5 hover:shadow-[0_12px_30px_rgba(15,23,42,0.08)] hover:border-slate-300',
                className
            )}
        >
            <div>
                {/* ── Product Image ── */}
                <Link
                    href={detailHref}
                    onClick={cacheDetail}
                    className="relative block h-36 sm:h-40 w-full overflow-hidden rounded-xl bg-white flex items-center justify-center shrink-0 cursor-pointer"
                >
                    {imageUrl ? (
                        <img
                            src={imageUrl}
                            alt={item.name}
                            loading="lazy"
                            onError={() => setImageFailed(true)}
                            className="h-full w-full object-contain p-2 transition-transform duration-300 ease-out group-hover:scale-105"
                        />
                    ) : (
                        <span className="flex h-full w-full items-center justify-center text-slate-300">
                            {type === 'service' ? <Wrench className="h-12 w-12" /> : <Package className="h-12 w-12" />}
                        </span>
                    )}
                </Link>

                {/* ── Star Rating Row ── */}
                <div className="mt-3 mb-2 flex items-center gap-1.5">
                    <span className="inline-flex items-center gap-0.5 rounded bg-[#15803d] px-1.5 py-0.5 text-[10.5px] font-bold text-white shadow-xs">
                        {ratingStr} <span className="text-[8.5px]">★</span>
                    </span>
                    <span className="text-[11px] font-medium text-slate-400">
                        ({reviewCount} Reviews)
                    </span>
                </div>

                {/* ── Product Title ── */}
                <Link href={detailHref} onClick={cacheDetail} className="block my-2">
                    <h3
                        className="line-clamp-2 text-xs sm:text-[13px] font-medium leading-snug text-slate-800 transition-colors duration-200 group-hover:text-[#0284c7] min-h-[34px] sm:min-h-[36px]"
                        title={item.name}
                    >
                        {item.name}
                    </h3>
                </Link>

                {/* ── Price Row ── */}
                <div className="mt-2.5 flex items-baseline gap-2 flex-wrap">
                    {effectivePrice > 0 ? (
                        <>
                            <span className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">
                                ₹{effectivePrice.toLocaleString('en-IN')}
                            </span>
                            {displayOriginalPrice > effectivePrice && (
                                <span className="text-[11px] font-normal text-slate-400 line-through">
                                    ₹{displayOriginalPrice.toLocaleString('en-IN')}
                                </span>
                            )}
                            {discountPercent > 0 && (
                                <span className="text-[11px] font-bold text-[#15803d]">
                                    {discountPercent}% OFF
                                </span>
                            )}
                        </>
                    ) : (
                        <span className="inline-flex rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-700">
                            Quote Based
                        </span>
                    )}
                </div>
            </div>

            {/* ── Action Buttons (Always visible on mobile/touch, smooth slide+fade on desktop hover) ── */}
            <div
                className={cn(
                    'mt-2 pt-1 transition-all duration-200 ease-out',
                    quantity > 0
                        ? 'opacity-100 translate-y-0 pointer-events-auto'
                        : 'opacity-100 translate-y-0 pointer-events-auto sm:opacity-0 sm:translate-y-2 sm:pointer-events-none sm:group-hover:opacity-100 sm:group-hover:translate-y-0 sm:group-hover:pointer-events-auto'
                )}
            >
                <div className="flex items-center gap-2">
                    {type === 'product' && effectivePrice > 0 ? (
                        showAddToCart && (
                            quantity > 0 ? (
                                <div className="flex h-9 min-w-[78px] sm:min-w-[84px] shrink-0 items-center justify-between rounded-lg border border-[#dc2626] bg-white px-1 text-[#dc2626] shadow-sm transition-all duration-200">
                                    <button
                                        type="button"
                                        onClick={(e) => changeQuantity(e, quantity - 1)}
                                        className="flex h-7 w-7 items-center justify-center rounded hover:bg-red-50 active:scale-85 transition-all text-[#dc2626]"
                                        aria-label="Decrease quantity"
                                    >
                                        <Minus className="h-3 w-3" />
                                    </button>
                                    <span className="text-xs font-black tabular-nums px-1 select-none">{quantity}</span>
                                    <button
                                        type="button"
                                        onClick={(e) => changeQuantity(e, quantity + 1)}
                                        className="flex h-7 w-7 items-center justify-center rounded hover:bg-red-50 active:scale-85 transition-all text-[#dc2626]"
                                        aria-label="Increase quantity"
                                    >
                                        <Plus className="h-3 w-3" />
                                    </button>
                                </div>
                            ) : (
                                <button
                                    type="button"
                                    onClick={addToCart}
                                    className="flex h-9 w-9 sm:w-10 shrink-0 items-center justify-center rounded-lg border border-[#dc2626] bg-white text-[#dc2626] shadow-sm transition-all duration-150 hover:bg-red-50 hover:scale-105 active:scale-90"
                                    title="Add to cart"
                                    aria-label="Add to cart"
                                >
                                    <ShoppingCart className="h-4 w-4" />
                                </button>
                            )
                        )
                    ) : (
                        <Link
                            href={detailHref}
                            onClick={cacheDetail}
                            className="flex h-9 w-9 sm:w-10 shrink-0 items-center justify-center rounded-lg border border-[#dc2626] bg-white text-[#dc2626] shadow-sm transition-all duration-150 hover:bg-red-50 hover:scale-105 active:scale-90"
                            title="View details"
                        >
                            <ShoppingCart className="h-4 w-4" />
                        </Link>
                    )}

                    {effectivePrice > 0 && type === 'product' ? (
                        <button
                            type="button"
                            onClick={handleBuyNow}
                            className="flex h-9 flex-1 items-center justify-center rounded-lg bg-[#dc2626] px-2 text-xs font-bold uppercase tracking-wider text-white shadow-sm transition-all duration-150 hover:bg-[#b91c1c] hover:shadow hover:scale-[1.02] active:scale-95"
                        >
                            BUY NOW
                        </button>
                    ) : (
                        <button
                            type="button"
                            onClick={requestQuote}
                            className="flex h-9 flex-1 items-center justify-center rounded-lg bg-[#dc2626] px-2 text-xs font-bold uppercase tracking-wider text-white shadow-sm transition-all duration-150 hover:bg-[#b91c1c] hover:shadow hover:scale-[1.02] active:scale-95"
                        >
                            BUY NOW
                        </button>
                    )}
                </div>
            </div>
        </article>
    );
}
