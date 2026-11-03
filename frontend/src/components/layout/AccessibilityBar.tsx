'use client';
import React from 'react';
import Link from 'next/link';
import { useAccessibility } from '@/providers/AccessibilityProvider';
import { Eye, Type, Globe, Volume2 } from 'lucide-react';

export function AccessibilityBar() {
  const { fontSize, setFontSize, contrastMode, setContrastMode, language, setLanguage } = useAccessibility();

  const handleSkipToContent = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    const target = document.getElementById('main-content');
    if (target) {
      target.focus();
      target.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div
      role="region"
      aria-label="Universal Accessibility and Government Identity Bar"
      className="w-full bg-[#07172e] text-slate-300 text-[11px] border-b border-slate-800/80 px-3 py-1 sm:px-6 z-[60] relative"
    >
      <div className="max-w-[1680px] mx-auto flex flex-wrap items-center justify-between gap-2">
        {/* Sovereign Government Identity Header */}
        <div className="flex items-center gap-2 font-bold tracking-wider uppercase text-[10px] text-slate-300">
          <div className="flex items-center h-2.5 w-6 rounded-xs overflow-hidden shadow-xs shrink-0" aria-hidden="true">
            <span className="w-1/3 h-full bg-[#ff9933]" />
            <span className="w-1/3 h-full bg-white flex items-center justify-center">
              <span className="h-1 w-1 rounded-full bg-[#000080]" />
            </span>
            <span className="w-1/3 h-full bg-[#138808]" />
          </div>
          <span className="hidden sm:inline text-slate-300">Government of Odisha</span>
          <span className="text-slate-600 hidden sm:inline">|</span>
          <span className="text-slate-200">District Administration Jharsuguda</span>
        </div>

        {/* Accessibility & Language Controls */}
        <div className="flex items-center gap-2 sm:gap-4 ml-auto">
          {/* Skip link */}
          <a
            href="#main-content"
            onClick={handleSkipToContent}
            className="hover:text-white transition-colors underline-offset-2 hover:underline focus:ring-1 focus:ring-amber-400 focus:outline-none px-1 rounded"
          >
            Skip to Content
          </a>

          <span className="text-slate-700" aria-hidden="true">|</span>

          {/* Screen Reader Link */}
          <Link
            href="/screen-reader-access"
            className="hidden md:inline-flex items-center gap-1 hover:text-white transition-colors focus:ring-1 focus:ring-amber-400 focus:outline-none px-1 rounded"
            title="Screen Reader Access information"
          >
            <Volume2 className="h-3 w-3 text-amber-400" aria-hidden="true" />
            <span>Screen Reader</span>
          </Link>

          <span className="text-slate-700 hidden md:inline" aria-hidden="true">|</span>

          {/* Font Resizing Controls (A-, A, A+) */}
          <div className="inline-flex items-center gap-0.5 bg-slate-900/80 rounded border border-slate-700/60 p-0.5" role="group" aria-label="Text Size Controls">
            <button
              type="button"
              onClick={() => setFontSize('small')}
              aria-pressed={fontSize === 'small'}
              aria-label="Decrease text size"
              className={`px-1.5 py-0.5 text-[10px] font-black rounded transition-colors ${
                fontSize === 'small' ? 'bg-amber-400 text-slate-950' : 'text-slate-400 hover:text-white'
              }`}
            >
              A-
            </button>
            <button
              type="button"
              onClick={() => setFontSize('normal')}
              aria-pressed={fontSize === 'normal'}
              aria-label="Standard text size"
              className={`px-1.5 py-0.5 text-[10px] font-black rounded transition-colors ${
                fontSize === 'normal' ? 'bg-amber-400 text-slate-950' : 'text-slate-400 hover:text-white'
              }`}
            >
              A
            </button>
            <button
              type="button"
              onClick={() => setFontSize('large')}
              aria-pressed={fontSize === 'large'}
              aria-label="Increase text size"
              className={`px-1.5 py-0.5 text-[10px] font-black rounded transition-colors ${
                fontSize === 'large' ? 'bg-amber-400 text-slate-950' : 'text-slate-400 hover:text-white'
              }`}
            >
              A+
            </button>
          </div>

          <span className="text-slate-700" aria-hidden="true">|</span>

          {/* High Contrast Toggle */}
          <button
            type="button"
            onClick={() => setContrastMode(contrastMode === 'high-contrast' ? 'standard' : 'high-contrast')}
            aria-pressed={contrastMode === 'high-contrast'}
            aria-label="Toggle High Contrast Display"
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold transition-all border ${
              contrastMode === 'high-contrast'
                ? 'bg-yellow-400 text-black border-yellow-300 font-extrabold'
                : 'bg-slate-900/60 text-slate-300 border-slate-700/60 hover:text-white'
            }`}
          >
            <Eye className="h-2.5 w-2.5" aria-hidden="true" />
            <span className="hidden sm:inline">Contrast</span>
          </button>

          <span className="text-slate-700" aria-hidden="true">|</span>

          {/* Bilingual / Language Toggle (English, Odia, Hindi) */}
          <div className="inline-flex items-center gap-1 text-[10px] font-bold">
            <Globe className="h-2.5 w-2.5 text-slate-400 hidden sm:inline" aria-hidden="true" />
            <button
              type="button"
              onClick={() => setLanguage('en')}
              className={`px-1 rounded transition-colors ${language === 'en' ? 'text-amber-400 font-black' : 'text-slate-400 hover:text-white'}`}
              aria-label="Select English language"
            >
              EN
            </button>
            <span className="text-slate-700">/</span>
            <button
              type="button"
              onClick={() => setLanguage('hi')}
              className={`px-1 rounded transition-colors ${language === 'hi' ? 'text-amber-400 font-black' : 'text-slate-400 hover:text-white'}`}
              aria-label="Select Hindi language"
            >
              हिन्दी
            </button>
            <span className="text-slate-700">/</span>
            <button
              type="button"
              onClick={() => setLanguage('or')}
              className={`px-1 rounded transition-colors ${language === 'or' ? 'text-amber-400 font-black' : 'text-slate-400 hover:text-white'}`}
              aria-label="Select Odia language"
            >
              ଓଡ଼ିଆ
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
