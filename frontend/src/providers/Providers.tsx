'use client';
import { keepPreviousData, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/hooks/useAuth';
import { Toaster } from 'sonner';
import React, { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Lenis from 'lenis';

function SmoothScroll() {
  const pathname = usePathname();

  useEffect(() => {
    let lenis: Lenis | null = null;
    let rafId: number | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let mutationObserver: MutationObserver | null = null;
    let scheduledResizeFrame: number | null = null;

    const timeoutId = setTimeout(() => {
      const dashboardMain = document.querySelector('.dashboard-main') as HTMLElement | null;

      lenis = new Lenis({
        duration: 1.0,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        smoothWheel: true,
        autoResize: true,
        ...(dashboardMain ? { wrapper: dashboardMain } : {})
      });

      function raf(time: number) {
        lenis?.raf(time);
        rafId = requestAnimationFrame(raf);
      }
      rafId = requestAnimationFrame(raf);

      const updateLenisSizeThrottled = () => {
        if (scheduledResizeFrame) return;
        scheduledResizeFrame = requestAnimationFrame(() => {
          scheduledResizeFrame = null;
          lenis?.resize();
        });
      };

      // 1. Observe height of inner content element
      const contentEl = (dashboardMain?.firstElementChild as HTMLElement) || dashboardMain || document.body;
      if (contentEl && typeof ResizeObserver !== 'undefined') {
        resizeObserver = new ResizeObserver(() => {
          updateLenisSizeThrottled();
        });
        resizeObserver.observe(contentEl);
        if (dashboardMain && dashboardMain !== contentEl) {
          resizeObserver.observe(dashboardMain);
        }
      }

      // 2. Observe DOM mutations (row inserts, tab switches, dynamic list expansion)
      const containerEl = dashboardMain || document.body;
      if (containerEl && typeof MutationObserver !== 'undefined') {
        mutationObserver = new MutationObserver(() => {
          updateLenisSizeThrottled();
        });
        mutationObserver.observe(containerEl, {
          childList: true,
          subtree: false,
        });
      }

      // 3. Staggered updates to ensure limit recalculation as async API queries resolve
      [150, 500, 1500].forEach((delay) => {
        setTimeout(updateLenisSizeThrottled, delay);
      });
    }, 50);

    return () => {
      clearTimeout(timeoutId);
      if (rafId) cancelAnimationFrame(rafId);
      if (scheduledResizeFrame) cancelAnimationFrame(scheduledResizeFrame);
      if (resizeObserver) resizeObserver.disconnect();
      if (mutationObserver) mutationObserver.disconnect();
      if (lenis) lenis.destroy();
    };
  }, [pathname]);

  return null;
}

import { queryClient } from '@/lib/queryClient';

export const Providers = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <SmoothScroll />
      {children}
      <Toaster position="top-center" richColors closeButton expand={true} />
    </AuthProvider>
  </QueryClientProvider>
);
