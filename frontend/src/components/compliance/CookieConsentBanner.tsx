'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  Cookie,
  Shield,
  ShieldCheck,
  CheckCircle2,
  X,
  SlidersHorizontal,
  ExternalLink,
  Lock,
  ChevronRight,
  Info,
  Check,
} from 'lucide-react';
import { FocusTrap } from '../ui/FocusTrap';
import { cn } from '../../lib/utils';

export interface CookiePreferences {
  necessary: boolean;
  analytics: boolean;
  functional: boolean;
  timestamp: string;
  version: string;
}

const STORAGE_KEY = 'jsg_cookie_consent_v1';
const COOKIE_VERSION = '2026-v1';

/**
 * Global helper to re-open the cookie and data collection preferences modal from anywhere (e.g. footer).
 */
export function openCookieConsentPreferences() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('jsg:open-cookie-preferences'));
  }
}

export function CookieConsentBanner() {
  const [mounted, setMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isCustomizeOpen, setIsCustomizeOpen] = useState(false);

  // Preference switches
  const [analyticsEnabled, setAnalyticsEnabled] = useState(false);
  const [functionalEnabled, setFunctionalEnabled] = useState(false);

  const customizeTriggerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    setMounted(true);
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed: CookiePreferences = JSON.parse(stored);
        setAnalyticsEnabled(Boolean(parsed.analytics));
        setFunctionalEnabled(Boolean(parsed.functional));
        setIsOpen(false);
      } else {
        // Show banner on first visit
        setIsOpen(true);
      }
    } catch {
      setIsOpen(true);
    }

    const handleOpenEvent = () => {
      setIsCustomizeOpen(true);
    };

    window.addEventListener('jsg:open-cookie-preferences', handleOpenEvent);
    return () => {
      window.removeEventListener('jsg:open-cookie-preferences', handleOpenEvent);
    };
  }, []);

  const savePreferences = (preferences: CookiePreferences) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
      const mode = preferences.analytics ? 'all' : 'essential';
      document.cookie = `jsg_cookie_consent=${mode}; path=/; max-age=31536000; SameSite=Lax`;
    } catch (e) {
      console.error('Failed to save cookie preferences', e);
    }
    setIsOpen(false);
    setIsCustomizeOpen(false);
  };

  const handleAcceptAll = () => {
    const prefs: CookiePreferences = {
      necessary: true,
      analytics: true,
      functional: true,
      timestamp: new Date().toISOString(),
      version: COOKIE_VERSION,
    };
    setAnalyticsEnabled(true);
    setFunctionalEnabled(true);
    savePreferences(prefs);
  };

  const handleRejectOptional = () => {
    const prefs: CookiePreferences = {
      necessary: true,
      analytics: false,
      functional: false,
      timestamp: new Date().toISOString(),
      version: COOKIE_VERSION,
    };
    setAnalyticsEnabled(false);
    setFunctionalEnabled(false);
    savePreferences(prefs);
  };

  const handleSaveCustom = () => {
    const prefs: CookiePreferences = {
      necessary: true,
      analytics: analyticsEnabled,
      functional: functionalEnabled,
      timestamp: new Date().toISOString(),
      version: COOKIE_VERSION,
    };
    savePreferences(prefs);
  };

  if (!mounted) return null;

  return (
    <>
      {/* ─── Bottom-Docked Notice Banner (First Visit) ────────────────── */}
      {isOpen && !isCustomizeOpen && (
        <aside
          role="region"
          aria-label="Cookie and Data Privacy Consent"
          aria-live="polite"
          className="fixed bottom-0 inset-x-0 z-[9990] bg-[#07172b]/95 backdrop-blur-md border-t-2 border-[#1e3a63] text-white shadow-2xl p-4 sm:p-5 transition-all duration-300 animate-in slide-in-from-bottom-6"
        >
          <div className="mx-auto max-w-7xl flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            {/* Notice text & DPDP statement */}
            <div className="flex items-start gap-3.5 max-w-4xl">
              <div className="h-10 w-10 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-sky-400 shrink-0 mt-0.5">
                <Cookie className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-black uppercase tracking-wider text-white">
                    Data Collection & Cookie Preferences
                  </h2>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    DPDP Act 2023 Compliant
                  </span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed font-normal">
                  JSG SMILE uses strictly necessary cookies to safeguard sessions, prevent CSRF attacks, and ensure platform security. With your consent, we also collect anonymized performance telemetry to improve portal reliability. No advertising or third-party trackers are used.
                </p>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] pt-0.5">
                  <a
                    href="/docs/Privacy_Policy_JSG_Smile.pdf"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sky-300 hover:text-white underline underline-offset-2 flex items-center gap-1 font-semibold"
                  >
                    Privacy Policy <ExternalLink className="h-3 w-3" aria-hidden="true" />
                  </a>
                  <span className="text-slate-500" aria-hidden="true">•</span>
                  <a
                    href="/terms-of-use"
                    className="text-sky-300 hover:text-white underline underline-offset-2 font-semibold"
                  >
                    Terms of Use
                  </a>
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap items-center gap-2.5 sm:self-end lg:self-center shrink-0">
              <button
                type="button"
                ref={customizeTriggerRef}
                onClick={() => setIsCustomizeOpen(true)}
                className="h-10 px-3.5 rounded-xl border border-slate-600 bg-slate-800/80 hover:bg-slate-700 text-xs font-bold text-slate-200 transition-colors flex items-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-[#c8a45c]"
              >
                <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
                Customize
              </button>
              <button
                type="button"
                onClick={handleRejectOptional}
                className="h-10 px-4 rounded-xl border border-slate-600 bg-transparent hover:bg-slate-800 text-xs font-bold text-slate-200 transition-colors focus:outline-none focus:ring-2 focus:ring-[#c8a45c]"
              >
                Essential Only
              </button>
              <button
                type="button"
                onClick={handleAcceptAll}
                className="h-10 px-5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-xs font-black uppercase tracking-wider text-white shadow-lg transition-all focus:outline-none focus:ring-2 focus:ring-white"
              >
                Accept All
              </button>
            </div>
          </div>
        </aside>
      )}

      {/* ─── Preference Customization Modal (Focus-Trapped & Accessible) ── */}
      {isCustomizeOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="cookie-modal-title"
          aria-describedby="cookie-modal-desc"
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200"
        >
          <FocusTrap
            active={isCustomizeOpen}
            onEscape={() => setIsCustomizeOpen(false)}
            returnFocusRef={customizeTriggerRef}
            className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]"
          >
            {/* Modal Header */}
            <div className="bg-[#0b2447] text-white p-5 flex items-start justify-between gap-4 border-b border-blue-950">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-emerald-400" aria-hidden="true" />
                  <h2 id="cookie-modal-title" className="text-base font-black tracking-wide text-white">
                    Data Privacy & Cookie Settings
                  </h2>
                </div>
                <p id="cookie-modal-desc" className="text-xs text-slate-300 leading-normal">
                  Manage how JSG SMILE stores technical session tokens and processes operational telemetry under the Digital Personal Data Protection Act 2023.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsCustomizeOpen(false)}
                aria-label="Close cookie preferences modal"
                className="rounded-lg p-1.5 text-slate-300 hover:text-white hover:bg-white/10 transition-colors focus:outline-none focus:ring-2 focus:ring-white"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 sm:p-6 overflow-y-auto space-y-4 divide-y divide-slate-100 text-slate-800">
              {/* Category 1: Strictly Necessary */}
              <div className="pt-0 space-y-2">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1 pr-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black uppercase tracking-wider text-slate-900">
                        1. Strictly Necessary & Security Cookies
                      </span>
                      <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                        Always Active
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Essential for authentication, CSRF anti-tampering protection, session verification, and basic navigation. The portal cannot function securely without these cookies.
                    </p>
                    <div className="text-[11px] font-mono text-slate-500 bg-slate-50 p-2 rounded border border-slate-100">
                      Identifiers: <span className="font-semibold text-slate-700">csrfToken, jsg_initial_load, isSidebarCollapsed</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 shrink-0 mt-1">
                    <Lock className="h-4 w-4 text-slate-400" aria-hidden="true" />
                    <span>Locked</span>
                  </div>
                </div>
              </div>

              {/* Category 2: Performance & Telemetry */}
              <div className="pt-4 space-y-2">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1 pr-2">
                    <label
                      htmlFor="cookie-analytics-toggle"
                      className="text-xs font-black uppercase tracking-wider text-slate-900 cursor-pointer"
                    >
                      2. Performance & System Health Telemetry
                    </label>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Measures page latency, API response times, and system error rates in aggregate. All telemetry is self-hosted with zero third-party data sharing.
                    </p>
                  </div>
                  <div className="shrink-0 mt-1">
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        id="cookie-analytics-toggle"
                        type="checkbox"
                        checked={analyticsEnabled}
                        onChange={e => setAnalyticsEnabled(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[#0b2447] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#0b2447]"></div>
                      <span className="sr-only">Toggle Performance & Telemetry</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Category 3: Functional Preferences */}
              <div className="pt-4 space-y-2">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1 pr-2">
                    <label
                      htmlFor="cookie-functional-toggle"
                      className="text-xs font-black uppercase tracking-wider text-slate-900 cursor-pointer"
                    >
                      3. Functional & Accessibility Preferences
                    </label>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Preserves client-side accessibility selections, table page size preferences, and localized filters across sessions.
                    </p>
                  </div>
                  <div className="shrink-0 mt-1">
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        id="cookie-functional-toggle"
                        type="checkbox"
                        checked={functionalEnabled}
                        onChange={e => setFunctionalEnabled(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[#0b2447] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#0b2447]"></div>
                      <span className="sr-only">Toggle Functional Preferences</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* DPDP Legal Rights Disclosure */}
              <div className="pt-4">
                <div className="rounded-xl bg-slate-50 border border-slate-200 p-3.5 text-xs space-y-1.5">
                  <div className="flex items-center gap-1.5 font-bold text-slate-900">
                    <Info className="h-4 w-4 text-[#0b2447]" aria-hidden="true" />
                    <span>Statutory Data Principal Rights</span>
                  </div>
                  <p className="text-slate-600 text-[11px] leading-relaxed">
                    Under Section 6(6) of the DPDP Act 2023, you have the statutory right to withdraw consent at any time without negative consequence to essential platform security. You may also manage KYC and transactional data sharing via your account's Consent Center.
                  </p>
                </div>
              </div>
            </div>

            {/* Modal Footer Controls */}
            <div className="bg-slate-50 p-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleRejectOptional}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-xs font-bold text-slate-700 transition-colors focus:outline-none focus:ring-2 focus:ring-[#0b2447]"
              >
                Reject Non-Essential
              </button>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={handleSaveCustom}
                  className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-xs font-bold text-white transition-colors focus:outline-none focus:ring-2 focus:ring-slate-900"
                >
                  Save Choices
                </button>
                <button
                  type="button"
                  onClick={handleAcceptAll}
                  className="flex-1 sm:flex-initial px-5 py-2.5 rounded-xl bg-[#0b2447] hover:bg-[#12335f] text-xs font-black uppercase tracking-wider text-white shadow-md transition-all focus:outline-none focus:ring-2 focus:ring-[#0b2447]"
                >
                  Accept All
                </button>
              </div>
            </div>
          </FocusTrap>
        </div>
      )}
    </>
  );
}
