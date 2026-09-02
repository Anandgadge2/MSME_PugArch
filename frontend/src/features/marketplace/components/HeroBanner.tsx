'use client';
import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, ArrowRight, TrendingUp, ShieldCheck, Sparkles } from 'lucide-react';
import type { MarketplaceBanner } from '../api';
import { DEFAULT_MARKETPLACE_BANNERS } from '../../banners/defaultBanners';
import { BASE_URL, resolveMediaUrl } from '../../../lib/api';
import { useAuth } from '../../../hooks/useAuth';

const DEFAULT_IMAGES = [
    'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=1920&q=90&auto=format&fit=crop',
    'https://6a97e5bed601bb7bf57afe46.imgix.net/equalstock-Cz6pZG0uNCI-unsplash.jpg?w=1920&q=90&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1553877522-43269d4ea984?w=1920&q=90&auto=format&fit=crop',
    'https://6a97e5bed601bb7bf57afe46.imgix.net/tommao-wang-jr1DdTyU7eA-unsplash%20(1).jpg?utm_source=unsplash&utm_medium=referral&utm_content=creditShareLink',
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
    const [touchStart, setTouchStart] = useState<number | null>(null);
    const [touchEnd, setTouchEnd] = useState<number | null>(null);

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

    const handleTouchStart = (e: React.TouchEvent) => {
        setTouchEnd(null);
        setTouchStart(e.targetTouches[0].clientX);
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        setTouchEnd(e.targetTouches[0].clientX);
    };

    const handleTouchEnd = () => {
        if (!touchStart || !touchEnd) return;
        const distance = touchStart - touchEnd;
        if (distance > 50) {
            next();
        } else if (distance < -50) {
            prev();
        }
    };

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
            className="group/hero relative overflow-hidden bg-slate-950 w-full aspect-[16/10] xs:aspect-[16/9] sm:aspect-[2/1] md:aspect-[2.2/1] lg:aspect-[2.4/1] xl:aspect-[2.6/1] 2xl:aspect-[2.8/1] min-h-[300px] xs:min-h-[330px] sm:min-h-[380px] md:min-h-[440px] lg:min-h-[480px] xl:min-h-[520px] max-h-[640px] flex items-center"
            aria-label="Hero Banner"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
        >
            {/* Background image with smooth transition */}
            <div className="absolute inset-0 z-0 overflow-hidden bg-slate-900 select-none pointer-events-none">
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
                        className={`w-full h-full object-cover object-center transition-all duration-700 ease-out brightness-[1.02] contrast-[1.04] ${fading ? 'opacity-0 scale-105' : 'opacity-100 scale-100'}`}
                    />
                ) : null}

                {/* Multi-layered responsive contrast overlay */}
                <div className="absolute inset-0 bg-slate-950/40 sm:bg-slate-950/20" />
                <div className="absolute inset-0 bg-gradient-to-r from-slate-950/95 via-slate-950/75 via-45% to-transparent sm:w-[75%] lg:w-[58%]" />
                <div className="absolute inset-x-0 bottom-0 h-16 sm:h-24 bg-gradient-to-t from-slate-950/70 to-transparent" />
                
                {/* Ambient glowing light pulses */}
                <div className="absolute top-1/4 left-10 w-96 h-96 rounded-full bg-blue-500/10 blur-3xl animate-pulse pointer-events-none" style={{ animationDuration: '6s' }} />
                <div className="absolute bottom-10 left-1/3 w-80 h-80 rounded-full bg-[#c8a45c]/10 blur-3xl animate-pulse pointer-events-none" style={{ animationDuration: '8s' }} />
            </div>

            {/* Side Navigation Arrow - Left */}
            <button
                type="button"
                onClick={prev}
                className="hidden md:flex absolute left-3 lg:left-6 top-1/2 -translate-y-1/2 z-30 h-9 w-9 lg:h-11 lg:w-11 items-center justify-center rounded-full border border-white/25 bg-black/40 text-white backdrop-blur-md shadow-2xl transition-all duration-300 hover:scale-110 hover:border-[#c8a45c] hover:bg-black/75 active:scale-95 group/arrow focus:outline-none opacity-0 group-hover/hero:opacity-100 focus:opacity-100"
                aria-label="Previous Banner Slide"
            >
                <ChevronLeft className="h-4 w-4 lg:h-5 lg:w-5 transition-transform duration-200 group-hover/arrow:-translate-x-0.5" />
            </button>

            {/* Side Navigation Arrow - Right */}
            <button
                type="button"
                onClick={next}
                className="hidden md:flex absolute right-3 lg:right-6 top-1/2 -translate-y-1/2 z-30 h-9 w-9 lg:h-11 lg:w-11 items-center justify-center rounded-full border border-white/25 bg-black/40 text-white backdrop-blur-md shadow-2xl transition-all duration-300 hover:scale-110 hover:border-[#c8a45c] hover:bg-black/75 active:scale-95 group/arrow focus:outline-none opacity-0 group-hover/hero:opacity-100 focus:opacity-100"
                aria-label="Next Banner Slide"
            >
                <ChevronRight className="h-4 w-4 lg:h-5 lg:w-5 transition-transform duration-200 group-hover/arrow:translate-x-0.5" />
            </button>

            {/* Hero Main Content Container */}
            <div className="relative z-10 mx-auto w-full max-w-[1680px] px-4 sm:px-10 md:px-14 lg:px-16 2xl:px-20 py-6 sm:py-10 md:py-12 pb-10 sm:pb-14 lg:pb-16">
                
                {/* FLOATING CTA OVERLAY (Top Right) */}
                <div className="absolute top-2 right-2 sm:top-5 sm:right-6 lg:top-6 lg:right-8 z-30 flex flex-row items-center gap-2 sm:gap-2.5 pointer-events-auto">
                    <button 
                        onClick={handlePostRequirement} 
                        className="group inline-flex items-center justify-center gap-1.5 h-8 sm:h-9 lg:h-10 px-3 sm:px-4 lg:px-5 rounded-full border border-white/40 bg-black/50 backdrop-blur-md text-white text-[11px] sm:text-xs lg:text-sm font-bold hover:bg-white/20 hover:border-[#c8a45c]/70 active:scale-95 transition-all shadow-lg"
                    >
                        <span>Post Requirement</span>
                    </button>
                    <button 
                        onClick={handleStartSelling} 
                        className="relative overflow-hidden inline-flex items-center justify-center gap-1.5 h-8 sm:h-9 lg:h-10 px-3 sm:px-4 lg:px-5 rounded-full bg-white hover:bg-slate-100 text-[#0b2447] text-[11px] sm:text-xs lg:text-sm font-black active:scale-95 transition-all shadow-xl shadow-black/30 hover:shadow-[0_0_20px_rgba(200,164,92,0.4)]"
                    >
                        {/* Shimmer light sweep */}
                        <span className="absolute inset-0 -translate-x-full hover:animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-[#c8a45c]/30 to-transparent pointer-events-none" />
                        <span>Start Selling</span>
                    </button>
                </div>

                <div className="w-full max-w-xl lg:max-w-2xl">
                    <div className={`transition-all duration-300 ${fading ? 'opacity-0 translate-y-2' : 'opacity-100 translate-y-0'}`}>
                        
                     

                        {/* Title */}
                        <h1 className="mb-2 sm:mb-3 text-lg xs:text-xl sm:text-3xl md:text-4xl lg:text-[2.75rem] 2xl:text-5xl font-black leading-tight sm:leading-[1.12] tracking-tight text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]">
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
                            <p className="mb-3.5 sm:mb-5 text-[11px] xs:text-xs sm:text-sm md:text-base leading-relaxed text-slate-100/90 font-medium drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)] max-w-md sm:max-w-xl line-clamp-2 sm:line-clamp-3">
                                {slide.subtitle}
                            </p>
                        )}

                        {/* Responsive Action Buttons */}
                        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                            {ctaText && ctaLink && (
                                <Link
                                    href={ctaLink}
                                    onClick={(e) => handleCtaClick(e, ctaLink)}
                                    className="group relative overflow-hidden inline-flex items-center justify-center gap-1.5 h-8 sm:h-10 md:h-11 px-4 sm:px-6 rounded-full bg-white text-[#0b2447] text-[11px] sm:text-xs md:text-sm font-black hover:bg-slate-100 active:scale-95 transition-all shadow-xl shadow-black/40 hover:shadow-[0_0_25px_rgba(200,164,92,0.4)] shrink-0"
                                >
                                    <span className="absolute inset-0 -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-[#c8a45c]/20 to-transparent pointer-events-none" />
                                    <span>{ctaText}</span>
                                    <ArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 transition-transform duration-200 group-hover:translate-x-1 text-[#c8a45c]" />
                                </Link>
                            )}

                            <Link
                                href="/login"
                                className="inline-flex items-center justify-center gap-1.5 h-8 sm:h-10 md:h-11 px-3.5 sm:px-5 rounded-full border border-white/40 bg-black/40 backdrop-blur-md text-white text-[11px] sm:text-xs md:text-sm font-bold hover:bg-white/20 hover:border-[#c8a45c]/60 active:scale-95 transition-all shadow-lg shrink-0"
                            >
                                Login to Portal
                            </Link>
                        </div>
                    </div>
                </div>
            </div>

            {/* Floating Carousel Dots Indicator */}
            <div className="absolute bottom-2.5 sm:bottom-4 md:bottom-5 left-0 right-0 flex items-center justify-center z-20 pointer-events-auto">
                <div className="flex items-center gap-1.5 sm:gap-2 px-2.5 py-0.5 sm:py-1 rounded-full bg-black/30 backdrop-blur-xs border border-white/15">
                    {slides.map((_, i) => (
                        <button
                            key={i}
                            onClick={() => goTo(i)}
                            className={`rounded-full transition-all duration-300 focus:outline-none ${
                                i === current
                                    ? 'w-5 sm:w-7 h-1.5 bg-[#c8a45c] shadow-[0_0_10px_rgba(200,164,92,0.9)]'
                                    : 'w-1.5 h-1.5 bg-white/45 hover:bg-white/90 hover:scale-125 shadow-[0_1px_3px_rgba(0,0,0,0.8)]'
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
                    className="relative block w-full h-3 sm:h-5 md:h-7 text-[#f6f8fb]"
                    viewBox="0 0 1440 80"
                    preserveAspectRatio="none"
                >
                    <path
                        d="M0,30 C320,65 520,5 840,40 C1080,68 1280,20 1440,35 L1440,80 L0,80 Z"
                        fill="currentColor"
                        opacity="0.35"
                    />
                    <path
                        d="M0,45 C280,18 560,60 860,30 C1160,5 1320,50 1440,40 L1440,80 L0,80 Z"
                        fill="currentColor"
                        opacity="0.55"
                    />
                    <path
                        d="M0,52 C240,75 480,25 720,56 C960,82 1200,35 1440,58 L1440,80 L0,80 Z"
                        fill="currentColor"
                    />
                </svg>
            </div>
        </section>
    );
}
