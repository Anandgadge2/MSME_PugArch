'use client';

import React, { useEffect, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { Loader2 } from './loader';

/**
 * Enterprise Global Navigation Progress Bar & Route Transition Indicator.
 * Automatically activates on:
 * 1. Global link clicks (<a href="...">) to internal routes
 * 2. Next.js router.push() and router.replace() calls (via history interception)
 * 3. Custom 'app:route-start' events
 * 4. Next.js pathname and searchParams transitions
 */
export function NavigationProgressBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isNavigating, setIsNavigating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showSlowWarning, setShowSlowWarning] = useState(false);

  // Complete and reset progress bar on route arrival
  useEffect(() => {
    if (isNavigating) {
      setProgress(100);
      const timer = setTimeout(() => {
        setIsNavigating(false);
        setProgress(0);
        setShowSlowWarning(false);
      }, 250);
      return () => clearTimeout(timer);
    }
  }, [pathname, searchParams]);

  // Global listener for all navigation triggers across the portal
  useEffect(() => {
    let progressTimer: NodeJS.Timeout;
    let slowTimer: NodeJS.Timeout;
    let safetyTimer: NodeJS.Timeout;

    const startProgress = () => {
      setIsNavigating(true);
      setShowSlowWarning(false);
      setProgress(20);

      progressTimer = setTimeout(() => {
        setProgress(55);
        progressTimer = setTimeout(() => {
          setProgress(85);
        }, 350);
      }, 150);

      // If the route takes more than 400ms to open/download chunk, show visible indicator
      slowTimer = setTimeout(() => {
        setShowSlowWarning(true);
      }, 400);

      // Safety fallback: auto-clear after 10s if route transition aborts
      safetyTimer = setTimeout(() => {
        setIsNavigating(false);
        setProgress(0);
        setShowSlowWarning(false);
      }, 10000);
    };

    const handleCustomRouteStart = () => {
      startProgress();
    };

    // Intercept clicks on internal links
    const handleClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement)?.closest?.('a[href], button[data-navigate]');
      if (!target) return;

      const href = target.getAttribute('href') || target.getAttribute('data-navigate');
      if (
        href &&
        href.startsWith('/') &&
        !href.startsWith('//') &&
        !href.startsWith('/#') &&
        !target.getAttribute('target') &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.shiftKey
      ) {
        const cleanCurrent = window.location.pathname + window.location.search;
        if (href !== cleanCurrent && href !== window.location.pathname) {
          startProgress();
        }
      }
    };

    // Intercept programmatic router.push and router.replace
    const originalPushState = window.history.pushState;
    const originalReplaceState = window.history.replaceState;

    window.history.pushState = function (...args) {
      const url = args[2];
      if (url && typeof url === 'string' && url.startsWith('/') && url !== window.location.pathname) {
        startProgress();
      }
      return originalPushState.apply(this, args);
    };

    window.history.replaceState = function (...args) {
      const url = args[2];
      if (url && typeof url === 'string' && url.startsWith('/') && url !== window.location.pathname) {
        startProgress();
      }
      return originalReplaceState.apply(this, args);
    };

    window.addEventListener('app:route-start', handleCustomRouteStart as EventListener);
    document.addEventListener('click', handleClick, true);

    return () => {
      window.history.pushState = originalPushState;
      window.history.replaceState = originalReplaceState;
      window.removeEventListener('app:route-start', handleCustomRouteStart as EventListener);
      document.removeEventListener('click', handleClick, true);
      clearTimeout(progressTimer);
      clearTimeout(slowTimer);
      clearTimeout(safetyTimer);
    };
  }, []);

  if (!isNavigating && progress === 0) return null;

  return (
    <>
      {/* Sleek Top Progress Bar */}
      <div
        aria-hidden="true"
        className="fixed top-0 left-0 right-0 z-[999999] h-[3px] bg-transparent pointer-events-none"
      >
        <div
          className="h-full bg-gradient-to-r from-[#c5a556] via-amber-400 to-[#12335f] transition-all duration-300 ease-out shadow-[0_0_14px_rgba(197,165,86,0.9)]"
          style={{
            width: `${progress}%`,
            opacity: progress === 100 ? 0 : 1,
            transitionProperty: 'width, opacity',
          }}
        />
      </div>

      {/* Visible Floating Indicator on Slow Networks (>400ms) */}
      {showSlowWarning && (
        <div
          role="status"
          aria-live="polite"
          className="fixed top-4 right-4 z-[999999] flex items-center gap-2.5 rounded-full bg-[#0b2447]/95 backdrop-blur-md text-white px-4 py-2 shadow-2xl text-xs font-bold border border-[#c5a556]/50 animate-in fade-in slide-in-from-top-3 duration-200"
        >
          <Loader2 className="h-4 w-4 animate-spin text-[#c5a556]" />
          <span>Opening page...</span>
        </div>
      )}
    </>
  );
}

/**
 * Programmatic helper to trigger the top progress bar immediately
 * when navigating via router.push()
 */
export function triggerRouteProgress() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('app:route-start'));
  }
}
