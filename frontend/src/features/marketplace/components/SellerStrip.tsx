'use client';
import React, { useRef } from 'react';
import Link from 'next/link';
import { Building2, BadgeCheck, ChevronLeft, ChevronRight, Package, Wrench, MapPin } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { resolveMediaUrl } from '../../../lib/api';
import type { MarketplaceSeller } from '../api';

function sellerLogo(seller: MarketplaceSeller) {
    const profile = seller.profile || {};
    const rawLogo = seller.logoUrl || seller.logoFile?.url || profile.logoUrl || profile.logo || profile.organizationLogoUrl || profile.organizationLogo || null;
    return resolveMediaUrl(rawLogo);
}

function initials(name: string) {
    return name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map(part => part[0]?.toUpperCase())
        .join('') || 'V';
}

function getDeterministicIndex(str: string) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return Math.abs(hash);
}

const getInitialsBg = (id: number) => {
    const gradients = [
        'from-blue-50 to-indigo-100 text-[#0b2447] border-indigo-200/60 shadow-inner',
        'from-emerald-50 to-teal-100 text-emerald-800 border-emerald-200/60 shadow-inner',
        'from-purple-50 to-violet-100 text-purple-800 border-purple-200/60 shadow-inner',
        'from-amber-50 to-orange-100 text-amber-800 border-amber-200/60 shadow-inner',
        'from-rose-50 to-pink-100 text-rose-800 border-rose-200/60 shadow-inner',
    ];
    return gradients[Math.abs(id) % gradients.length];
};

function SellerLogoImage({
    logo,
    name,
    orgInitials,
    initialsBg
}: {
    logo?: string | null;
    name: string;
    orgInitials: string;
    initialsBg: string;
}) {
    const [imgError, setImgError] = React.useState(false);

    if (logo && !imgError) {
        return (
            <img
                src={logo}
                alt={`${name} logo`}
                onError={() => setImgError(true)}
                className="w-full h-full object-contain transition-transform duration-300 group-hover:scale-105"
                loading="lazy"
            />
        );
    }

    return (
        <span className={cn("flex h-full w-full items-center justify-center rounded-full bg-gradient-to-br text-base font-black tracking-wider text-slate-800 transition-transform duration-300 group-hover:scale-105", initialsBg)}>
            {orgInitials}
        </span>
    );
}

function SellerStripSkeleton() {
    return (
        <div className="flex gap-5 sm:gap-6 md:gap-7 overflow-x-auto pb-4 pt-3 px-4 sm:px-6 2xl:px-8 -mx-4 sm:-mx-6 2xl:-mx-8 no-scrollbar">
            {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex flex-col w-[125px] sm:w-[145px] shrink-0 items-center gap-2.5 animate-pulse">
                    <div className="h-24 w-24 sm:h-28 sm:w-28 rounded-full bg-slate-100 border border-slate-200/70" />
                    <div className="h-3.5 w-20 rounded bg-slate-100 mt-1" />
                </div>
            ))}
        </div>
    );
}

interface Props { sellers: MarketplaceSeller[]; }

export function SellerStrip({ sellers }: Props) {
    const scrollRef = useRef<HTMLDivElement>(null);
    const scroll = (dir: 'left' | 'right') => {
        scrollRef.current?.scrollBy({ left: dir === 'left' ? -320 : 320, behavior: 'smooth' });
    };

    return (
        <section id="verified-sellers" className="mt-0 border-b border-slate-100 bg-white scroll-mt-16" aria-labelledby="seller-strip-heading">
            <div className="mx-auto max-w-[1680px] px-4 pt-3 pb-6 sm:px-6 sm:pt-4 sm:pb-8 2xl:px-8">
                <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
                    <div>
                       
                        <h2 id="seller-strip-heading" className="mt-1 text-xl font-black text-[#0b2447] sm:text-2xl">Verified Seller Organizations</h2>
                        <p className="mt-1 max-w-2xl text-sm font-medium text-slate-600">Scrollable vendor row of trusted MSMEs with verified GST &amp; Udyam</p>
                    </div>
                    <Link href="/marketplace/sellers" className="inline-flex h-9 items-center gap-1.5 self-start rounded-lg border border-[#0b2447] px-4 text-xs font-bold text-[#0b2447] transition hover:bg-[#0b2447] hover:text-white sm:self-end">
                        View All <ChevronRight className="h-3.5 w-3.5" />
                    </Link>
                </div>

                <div className="relative group/strip">
                    <button
                        type="button"
                        onClick={() => scroll('left')}
                        className="absolute -left-2 lg:-left-4 top-[48px] sm:top-[56px] z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200/80 bg-white shadow-md backdrop-blur-md transition-all duration-300 hover:scale-110 hover:bg-[#0b2447] hover:text-white hover:border-[#0b2447] hover:shadow-lg active:scale-95 lg:flex text-slate-600"
                        aria-label="Scroll sellers left"
                    >
                        <ChevronLeft className="h-5 w-5" />
                    </button>

                    {sellers.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-8 text-center text-sm font-medium text-slate-500 my-2">
                            No verified seller organizations published yet.
                        </div>
                    ) : (
                        <div
                            ref={scrollRef}
                            className="flex gap-5 sm:gap-6 md:gap-7 overflow-x-auto pb-4 pt-3 px-4 sm:px-6 2xl:px-8 -mx-4 sm:-mx-6 2xl:-mx-8 no-scrollbar items-start"
                            role="list"
                            aria-label="Verified sellers"
                        >
                            {sellers.map(seller => {
                                const logo = sellerLogo(seller);
                                const orgInitials = initials(seller.organizationName);
                                const initialsBg = getInitialsBg(getDeterministicIndex(seller.organizationName));

                                return (
                                    <Link
                                        key={seller.id}
                                        href={`/vendors/${seller.id}`}
                                        className="group flex flex-col items-center gap-2.5 w-[125px] sm:w-[145px] shrink-0 text-center cursor-pointer transition-transform duration-200"
                                        role="listitem"
                                    >
                                        <span className="flex h-24 w-24 sm:h-28 sm:w-28 shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-white shadow-sm transition-all duration-300 group-hover:scale-105 group-hover:border-[#0b2447] group-hover:shadow-md p-1 sm:p-1.5">
                                            <SellerLogoImage
                                                logo={logo}
                                                name={seller.organizationName}
                                                orgInitials={orgInitials}
                                                initialsBg={initialsBg}
                                            />
                                        </span>

                                        <span className="block text-xs sm:text-sm font-semibold text-slate-800 group-hover:text-[#0b2447] transition-colors line-clamp-2 text-center leading-snug px-1 mt-0.5">
                                            {seller.organizationName}
                                        </span>
                                    </Link>
                                );
                            })}
                        </div>
                    )}

                    <button
                        type="button"
                        onClick={() => scroll('right')}
                        className="absolute -right-2 lg:-right-4 top-[48px] sm:top-[56px] z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200/80 bg-white shadow-md backdrop-blur-md transition-all duration-300 hover:scale-110 hover:bg-[#0b2447] hover:text-white hover:border-[#0b2447] hover:shadow-lg active:scale-95 lg:flex text-slate-600"
                        aria-label="Scroll sellers right"
                    >
                        <ChevronRight className="h-5 w-5" />
                    </button>
                </div>
            </div>
        </section>
    );
}
