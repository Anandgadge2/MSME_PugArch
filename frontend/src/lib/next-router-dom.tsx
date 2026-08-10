'use client';
import NextLink from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import React from 'react';

export const Link = ({ to, children, onClick, onMouseEnter, onFocus, target, prefetch = true, ...props }: any) => {
  const router = useRouter();
  const href = String(to || '#');

  const handlePrefetch = () => {
    if (href && href !== '#' && !href.startsWith('http') && prefetch !== false) {
      try {
        router.prefetch(href);
      } catch {
        // Ignore prefetch failures for dynamic/external routes
      }
    }
  };

  const handleMouseEnter = (event: React.MouseEvent<HTMLAnchorElement>) => {
    onMouseEnter?.(event);
    handlePrefetch();
  };

  const handleFocus = (event: React.FocusEvent<HTMLAnchorElement>) => {
    onFocus?.(event);
    handlePrefetch();
  };

  const handleClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      target === '_blank' ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }

    event.preventDefault();
    router.push(href);
  };

  return (
    <NextLink
      href={href}
      target={target}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onFocus={handleFocus}
      prefetch={prefetch}
      {...props}
    >
      {children}
    </NextLink>
  );
};
export const useNavigate = () => {
  const router = useRouter();
  const navigateFunc = (to: string, options?: { replace?: boolean }) => options?.replace ? router.replace(to) : router.push(to);
  (navigateFunc as any).prefetch = (to: string) => {
    try {
      router.prefetch(to);
    } catch {
      // Ignore
    }
  };
  return navigateFunc;
};
export const useLocation = () => {
  const pathname = usePathname() || '/';
  const search = useSearchParams()?.toString() || '';
  return { pathname, search: search ? `?${search}` : '', state: null };
};
export const useParams = <T extends Record<string, string>>() => {
  const pathname = usePathname() || '/';
  const match = pathname.match(/^\/seller\/tenders\/([^/]+)\/bid$/);
  return ((match ? { id: match[1] } : {}) as T);
};

export const BrowserRouter = ({ children }: any) => <>{children}</>;
export const Router = BrowserRouter;
export const Routes = ({ children }: any) => <>{children}</>;
export const Route = () => null;
export const Navigate = ({ to }: any) => {
  const router = useRouter();
  React.useEffect(() => { router.replace(to); }, [to, router]);
  return null;
};
