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
        const t = setInterval(next, 6500);
        return () => clearInterval(t);
    }, [next]);

    const slide = slides[current];
    const ctaLink = slide.ctaLink || slide.targetUrl;
    const ctaText = slide.ctaText || (ctaLink ? 'View Details' : '');
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
            className="relative overflow-hidden bg-[#07172e] min-h-[250px] sm:min-h-[460px] lg:min-h-[520px] flex items-center"
            aria-label="Hero Banner"
        >
            {/* Background image — Clear, vibrant 100% full coverage with mobile zoom */}
            <div className="absolute inset-0 z-0 overflow-hidden">
                {activeImageSrc ? (
                    <img
                        key={`${slide.id}-${current}`}
                        src={activeImageSrc}
                        alt={slide.title || 'Marketplace Hero Banner'}
                        loading="eager"
                        onError={() => {
                            setCurrentImg(DEFAULT_IMAGES[current % DEFAULT_IMAGES.length]);
                        }}
                        className={`w-full h-full object-cover object-center scale-[1.4] sm:scale-100 origin-center transition-all duration-300 ${fading ? 'opacity-0' : 'opacity-100'}`}
                    />
                ) : null}
                {/* Clean translucent overlay — uniform on mobile so entire image is visible, gradient on desktop */}
                <div className="absolute inset-0 bg-black/40 sm:bg-gradient-to-r sm:from-[#07172e]/95 sm:via-[#0b2447]/70 sm:to-transparent" />
            </div>

            {/* Hero Main Content Container */}
            <div className="relative z-10 mx-auto w-full max-w-[1680px] px-3.5 py-4 pb-6 sm:px-6 sm:py-14 sm:pb-20 lg:py-16 lg:pb-24 2xl:px-8">
                
                {/* FLOATING CTA OVERLAY (Desktop Only) */}
                <div className="hidden sm:flex absolute sm:top-6 sm:right-6 2xl:right-8 z-30 flex-row flex-nowrap justify-end gap-2.5 pointer-events-auto">
                    <button 
                        onClick={handlePostRequirement} 
                        className="h-9 sm:h-10 px-4 sm:px-5 rounded-full bg-white/10 hover:bg-white/20 border border-white/30 backdrop-blur-md text-white text-[11px] sm:text-xs font-bold transition-all active:scale-95 shadow-sm"
                    >
                        Post Requirement
                    </button>
                    <button 
                        onClick={handleStartSelling} 
                        className="h-9 sm:h-10 px-4 sm:px-5 rounded-full bg-white hover:bg-slate-50 text-[#0b2447] text-[11px] sm:text-xs font-black transition-all active:scale-95 shadow-lg shadow-black/20"
                    >
                        Start Selling
                    </button>
                </div>

                <div className="w-full max-w-2xl">
                    <div className={`transition-all duration-300 ${fading ? 'opacity-0 translate-y-2' : 'opacity-100 translate-y-0'}`}>
                        {/* Official Trust Pill Badge */}
                        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 sm:px-3 sm:py-1 rounded-full bg-black/50 border border-emerald-400/50 text-[8.5px] sm:text-xs font-bold text-emerald-300 uppercase tracking-wider mb-1.5 sm:mb-4 backdrop-blur-md shadow-sm">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                            <span className="sm:hidden">Official MSME Portal · Jharsuguda</span>
                            <span className="hidden sm:inline">Official MSME Marketplace · Jharsuguda District, Odisha</span>
                        </div>

                        {/* Title */}
                        <h1 className="mb-1 sm:mb-3 text-lg sm:text-4xl md:text-5xl lg:text-[3.2rem] font-black leading-[1.16] tracking-tight text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                            {slide.title.split('\n').map((line, i) => (
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
                            <p className="mb-2.5 sm:mb-6 text-[10.5px] sm:text-sm lg:text-base leading-snug text-slate-100 font-medium drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)] max-w-xl line-clamp-2 sm:line-clamp-none">
                                {slide.subtitle}
                            </p>
                        )}

                        {/* Action Buttons: Minimal footprint on Mobile ONLY */}
                        {/* Mobile Actions */}
                        <div className="flex sm:hidden items-center gap-2 w-auto">
                            <Link
                                href={ctaLink || '/marketplace/products'}
                                onClick={(e) => ctaLink && handleCtaClick(e, ctaLink)}
                                className="inline-flex h-7.5 px-3 rounded-full bg-white text-[#0b2447] text-[10.5px] font-black items-center justify-center gap-1 shadow-md active:scale-95 transition-all shrink-0"
                            >
                                <span>{ctaText || 'Explore'}</span>
                                <ArrowRight className="h-3 w-3" />
                            </Link>
                            <button
                                onClick={handlePostRequirement}
                                className="inline-flex h-7.5 px-3 rounded-full bg-black/40 hover:bg-black/60 border border-white/40 backdrop-blur-md text-white text-[10.5px] font-bold items-center justify-center active:scale-95 transition-all shrink-0"
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
                                    className="group inline-flex items-center justify-center gap-2.5 h-11 sm:h-12 px-6 sm:px-7 rounded-full bg-white text-[#0b2447] text-xs sm:text-sm font-extrabold hover:bg-slate-100 active:scale-95 transition-all shadow-xl shadow-black/30"
                                >
                                    <span>{ctaText}</span>
                                    <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
                                </Link>
                            )}
                            <Link
                                href="/login"
                                className="inline-flex items-center justify-center gap-2 h-11 sm:h-12 px-6 rounded-full border border-white/40 bg-black/25 backdrop-blur-md text-white text-xs sm:text-sm font-bold hover:bg-white/20 active:scale-95 transition-all shadow-md"
                            >
                                Login to Portal
                            </Link>
                        </div>
                    </div>
                </div>
            </div>

            {/* Compact Carousel Controls */}
            <div className="absolute bottom-1.5 sm:bottom-4 left-0 right-0 flex items-center justify-center z-20">
                <div className="flex items-center gap-1.5">
                    <button
                        onClick={prev}
                        className="w-4.5 h-4.5 sm:w-6 sm:h-6 rounded-full bg-white/20 hover:bg-white/40 flex items-center justify-center text-white active:scale-90 transition-all"
                        aria-label="Previous slide"
                    >
                        <ChevronLeft className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                    </button>

                    <div className="flex gap-1">
                        {slides.map((_, i) => (
                            <button
                                key={i}
                                onClick={() => goTo(i)}
                                className={`rounded-full transition-all duration-300 ${i === current ? 'w-4 sm:w-5 h-1 sm:h-1.5 bg-white shadow-sm' : 'w-1 sm:w-1.5 h-1 sm:h-1.5 bg-white/40 hover:bg-white/60'}`}
                                aria-label={`Go to slide ${i + 1}`}
                                aria-current={i === current ? 'true' : undefined}
                            />
                        ))}
                    </div>

                    <button
                        onClick={next}
                        className="w-4.5 h-4.5 sm:w-6 sm:h-6 rounded-full bg-white/20 hover:bg-white/40 flex items-center justify-center text-white active:scale-90 transition-all"
                        aria-label="Next slide"
                    >
                        <ChevronRight className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                    </button>
                </div>
            </div>

            {/* Rich organic wave divider at bottom */}
            <div className="absolute bottom-0 left-0 right-0 overflow-hidden leading-none pointer-events-none z-10">
                <svg
                    className="relative block w-full h-3 sm:h-8 md:h-12 text-[#f6f8fb]"
                    viewBox="0 0 1200 80"
                    preserveAspectRatio="none"
                >
                    <path
                        d="M0,30 C180,60 380,0 600,40 C820,70 1020,10 1200,30 L1200,80 L0,80 Z"
                        fill="currentColor"
                    ></path>
                </svg>
            </div>
        </section>
    );
}



