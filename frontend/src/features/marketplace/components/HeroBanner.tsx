'use client';
import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react';
import type { MarketplaceBanner } from '../api';
import { DEFAULT_MARKETPLACE_BANNERS } from '../../banners/defaultBanners';
import { BASE_URL, resolveMediaUrl } from '../../../lib/api';
import { useAuth } from '../../../hooks/useAuth';

const DEFAULT_IMAGES = [
    'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=1920&q=90&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=1920&q=90&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1553877522-43269d4ea984?w=1920&q=90&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1565043666747-69f6646db940?w=1920&q=90&auto=format&fit=crop',
];

interface Props { banners: MarketplaceBanner[]; }

const resolveImageSrc = (url?: string, index = 0) => {
    if (!url || url.trim() === '' || url === 'null' || url === 'undefined') {
        return DEFAULT_IMAGES[index % DEFAULT_IMAGES.length];
    }
    const resolved = resolveMediaUrl(url);
    if (resolved) return resolved;
    if (/^(https?:|data:|blob:)/i.test(url)) return url;
    if (url.startsWith('/')) return `${BASE_URL}${url}`;
    return url;
};

export function HeroBanner({ banners }: Props) {
    const { user } = useAuth();
    const router = useRouter();
    const slides = banners.length > 0 ? banners : DEFAULT_MARKETPLACE_BANNERS as unknown as MarketplaceBanner[];
    const [current, setCurrent] = useState(0);
    const [fading, setFading] = useState(false);
    const [currentImg, setCurrentImg] = useState<string>(() => resolveImageSrc(slides[0]?.imageUrl, 0));

    useEffect(() => {
        const url = slides[current]?.imageUrl;
        setCurrentImg(resolveImageSrc(url, current));
    }, [slides, current]);

    const goTo = useCallback((idx: number) => {
        setFading(true);
        setTimeout(() => { setCurrent(idx); setFading(false); }, 220);
    }, []);

    const next = useCallback(() => goTo((current + 1) % slides.length), [current, slides.length, goTo]);
    const prev = useCallback(() => goTo((current - 1 + slides.length) % slides.length), [current, slides.length, goTo]);

    useEffect(() => {
        const t = setInterval(next, 7000);
        return () => clearInterval(t);
    }, [next]);

    const slide = slides[current] || slides[0] || (DEFAULT_MARKETPLACE_BANNERS[0] as unknown as MarketplaceBanner);
    const ctaLink = slide?.ctaLink || slide?.targetUrl;
    const ctaText = slide?.ctaText || (ctaLink ? 'View Details' : '');
    const activeImageSrc = currentImg || resolveImageSrc(slide?.imageUrl, current);

    const handleCtaClick = (e: React.MouseEvent<HTMLAnchorElement>, link: string) => {
        if (link.startsWith('#')) {
            e.preventDefault();
            document.querySelector(link)?.scrollIntoView({ behavior: 'smooth' });
        }
    };

    const handlePostRequirement = () => {
        if (user?.role === 'buyer') {
            router.push('/buyer/procurement/create');
        } else {
            router.push('/buyer/register');
        }
    };

    const handleStartSelling = () => {
        if (user?.role === 'seller') {
            router.push('/seller/opportunities');
        } else {
            router.push('/seller/register');
        }
    };

    return (
        <section
            className="group/hero relative overflow-hidden bg-slate-950 min-h-[320px] sm:min-h-[500px] lg:min-h-[560px] flex items-center"
            aria-label="Hero Banner"
        >
            {/* Background image — Vibrant, rich 100% full coverage */}
            <div className="absolute inset-0 z-0 overflow-hidden bg-slate-900">
                {activeImageSrc ? (
                    <img
                        key={`${slide?.id ?? 'slide'}-${current}`}
                        src={activeImageSrc}
                        alt={slide?.title || 'Marketplace Hero Banner'}
                        loading="eager"
                        referrerPolicy="no-referrer"
                        crossOrigin="anonymous"
                        onError={() => {
                            setCurrentImg(DEFAULT_IMAGES[current % DEFAULT_IMAGES.length]);
                        }}
                        className={`w-full h-full object-cover object-center transition-all duration-500 ease-out brightness-[1.02] contrast-[1.05] ${fading ? 'opacity-0 scale-105' : 'opacity-100 scale-100'}`}
                    />
                ) : null}

                {/* Focused contrast overlay: Soft dark gradient behind text for crisp readability while preserving photo clarity */}
                <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/45 to-transparent sm:w-[75%] lg:w-[65%]" />
                <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/40 to-transparent" />
            </div>

            {/* Side Navigation Arrow - Left */}
            <button
                type="button"
                onClick={prev}
                className="absolute left-2.5 sm:left-5 lg:left-8 top-1/2 -translate-y-1/2 z-30 flex h-9 w-9 sm:h-11 sm:w-11 items-center justify-center rounded-full border border-white/25 bg-black/40 text-white backdrop-blur-md shadow-2xl transition-all duration-300 hover:scale-110 hover:border-white/60 hover:bg-black/75 active:scale-95 group/arrow focus:outline-none opacity-100 md:opacity-0 md:group-hover/hero:opacity-100 focus:opacity-100"
                aria-label="Previous Banner Slide"
            >
                <ChevronLeft className="h-5 w-5 sm:h-6 sm:w-6 transition-transform duration-200 group-hover/arrow:-translate-x-0.5" />
            </button>

            {/* Side Navigation Arrow - Right */}
            <button
                type="button"
                onClick={next}
                className="absolute right-2.5 sm:right-5 lg:right-8 top-1/2 -translate-y-1/2 z-30 flex h-9 w-9 sm:h-11 sm:w-11 items-center justify-center rounded-full border border-white/25 bg-black/40 text-white backdrop-blur-md shadow-2xl transition-all duration-300 hover:scale-110 hover:border-white/60 hover:bg-black/75 active:scale-95 group/arrow focus:outline-none opacity-100 md:opacity-0 md:group-hover/hero:opacity-100 focus:opacity-100"
                aria-label="Next Banner Slide"
            >
                <ChevronRight className="h-5 w-5 sm:h-6 sm:w-6 transition-transform duration-200 group-hover/arrow:translate-x-0.5" />
            </button>

            {/* Hero Main Content Container */}
            <div className="relative z-10 mx-auto w-full max-w-[1680px] px-8 sm:px-16 lg:px-20 py-8 pb-12 sm:py-16 sm:pb-24 lg:py-20 lg:pb-28 2xl:px-24">
                
                {/* FLOATING CTA OVERLAY (Desktop Only) */}
                <div className="hidden sm:flex absolute sm:top-6 sm:right-6 2xl:right-8 z-30 flex-row flex-nowrap justify-end gap-2.5 pointer-events-auto">
                    <button 
                        onClick={handlePostRequirement} 
                        className="h-9 sm:h-10 px-4 sm:px-5 rounded-full bg-white/15 hover:bg-white/100 hover:text-black/100 border border-white/30 backdrop-blur-md text-white text-[11px] sm:text-xs font-bold transition-all active:scale-95 shadow-md"
                    >
                        Post Requirement
                    </button>
                    <button 
                        onClick={handleStartSelling} 
                        className="h-9 sm:h-10 px-4 sm:px-5 rounded-full bg-white hover:bg-slate-50 text-[#0b2447] text-[11px] sm:text-xs font-black transition-all active:scale-95 shadow-xl shadow-black/30"
                    >
                        Start Selling
                    </button>
                </div>

                <div className="w-full max-w-2xl">
                    <div className={`transition-all duration-300 ${fading ? 'opacity-0 translate-y-2' : 'opacity-100 translate-y-0'}`}>
                        {/* Official Trust Pill Badge */}
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full bg-black/60 border border-emerald-400/60 text-[8.5px] sm:text-xs font-bold text-emerald-300 uppercase tracking-wider mb-2 sm:mb-4 backdrop-blur-md shadow-md">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                            <span className="sm:hidden">Official MSME Portal · Jharsuguda</span>
                            <span className="hidden sm:inline">Official MSME Marketplace · Jharsuguda District, Odisha</span>
                        </div>

                        {/* Title */}
                        <h1 className="mb-2 sm:mb-3.5 text-xl sm:text-4xl md:text-5xl lg:text-[3.2rem] font-black leading-[1.15] tracking-tight text-white drop-shadow-[0_3px_8px_rgba(0,0,0,0.9)]">
                            {(slide?.title || 'MSME Marketplace').split('\n').map((line, i) => (
                                <React.Fragment key={i}>
                                    {i > 0 && (
                                        <>
                                            <span className="sm:hidden"> </span>
                                            <br className="hidden sm:inline" />
                                        </>
                                    )}
                                    {line}
                                </React.Fragment>
                            ))}
                        </h1>

                        {/* Subtitle */}
                        {slide.subtitle && (
                            <p className="mb-4 sm:mb-6 text-[11px] sm:text-sm lg:text-base leading-relaxed text-white/95 font-medium drop-shadow-[0_2px_5px_rgba(0,0,0,0.9)] max-w-xl line-clamp-2 sm:line-clamp-none">
                                {slide.subtitle}
                            </p>
                        )}

                        {/* Mobile Actions */}
                        <div className="flex sm:hidden items-center gap-2 w-auto">
                            <Link
                                href={ctaLink || '/marketplace/products'}
                                onClick={(e) => ctaLink && handleCtaClick(e, ctaLink)}
                                className="inline-flex h-8 px-3.5 rounded-full bg-white text-[#0b2447] text-[11px] font-black items-center justify-center gap-1 shadow-lg active:scale-95 transition-all shrink-0"
                            >
                                <span>{ctaText || 'Explore'}</span>
                                <ArrowRight className="h-3 w-3" />
                            </Link>
                            <button
                                onClick={handlePostRequirement}
                                className="inline-flex h-8 px-3.5 rounded-full bg-black/50 hover:bg-black/70 border border-white/40 backdrop-blur-md text-white text-[11px] font-bold items-center justify-center active:scale-95 transition-all shrink-0"
                            >
                                Post Requirement
                            </button>
                        </div>

                        {/* Desktop Actions */}
                        <div className="hidden sm:flex flex-row flex-wrap gap-3">
                            {ctaText && ctaLink && (
                                <Link
                                    href={ctaLink}
                                    onClick={(e) => handleCtaClick(e, ctaLink)}
                                    className="group inline-flex items-center justify-center gap-2.5 h-11 sm:h-12 px-6 sm:px-7 rounded-full bg-white text-[#0b2447] text-xs sm:text-sm font-extrabold hover:bg-slate-100 active:scale-95 transition-all shadow-xl shadow-black/40"
                                >
                                    <span>{ctaText}</span>
                                    <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
                                </Link>
                            )}
                            <Link
                                href="/login"
                                className="inline-flex items-center justify-center gap-2 h-11 sm:h-12 px-6 rounded-full border border-white/40 bg-black/30 backdrop-blur-md text-white text-xs sm:text-sm font-bold hover:bg-white/20 active:scale-95 transition-all shadow-lg"
                            >
                                Login to Portal
                            </Link>
                        </div>
                    </div>
                </div>
            </div>

            {/* Transparent Floating Carousel Dots Indicator */}
            <div className="absolute bottom-5 sm:bottom-8 left-0 right-0 flex items-center justify-center z-20 pointer-events-auto">
                <div className="flex items-center gap-1.5 sm:gap-2">
                    {slides.map((_, i) => (
                        <button
                            key={i}
                            onClick={() => goTo(i)}
                            className={`rounded-full transition-all duration-300 focus:outline-none ${
                                i === current
                                    ? 'w-7 sm:w-8 h-1.5 bg-white shadow-[0_0_10px_rgba(255,255,255,0.9),0_2px_4px_rgba(0,0,0,0.8)]'
                                    : 'w-1.5 h-1.5 sm:w-2 sm:h-2 bg-white/45 hover:bg-white/90 hover:scale-125 shadow-[0_1px_3px_rgba(0,0,0,0.8)]'
                            }`}
                            aria-label={`Go to slide ${i + 1}`}
                            aria-current={i === current ? 'true' : undefined}
                        />
                    ))}
                </div>
            </div>

            {/* Multi-layered dynamic curvy wave divider at bottom */}
            <div className="absolute -bottom-0.5 left-0 right-0 overflow-hidden leading-none pointer-events-none z-10">
                <svg
                    className="relative block w-full h-6 sm:h-10 md:h-14 text-[#f6f8fb]"
                    viewBox="0 0 1440 80"
                    preserveAspectRatio="none"
                >
                    {/* Layer 1 - Soft accent wave */}
                    <path
                        d="M0,30 C320,65 520,5 840,40 C1080,68 1280,20 1440,35 L1440,80 L0,80 Z"
                        fill="currentColor"
                        opacity="0.35"
                    />
                    {/* Layer 2 - Flowing mid wave */}
                    <path
                        d="M0,45 C280,18 560,60 860,30 C1160,5 1320,50 1440,40 L1440,80 L0,80 Z"
                        fill="currentColor"
                        opacity="0.55"
                    />
                    {/* Layer 3 - Main crisp organic curve */}
                    <path
                        d="M0,52 C240,75 480,25 720,56 C960,82 1200,35 1440,58 L1440,80 L0,80 Z"
                        fill="currentColor"
                    />
                </svg>
            </div>
        </section>
    );
}
