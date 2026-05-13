'use client';
import NextLink from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import React from 'react';

export const Link = ({ to, children, ...props }: any) => <NextLink href={to} {...props}>{children}</NextLink>;
export const useNavigate = () => {
  const router = useRouter();
  return (to: string, options?: { replace?: boolean }) => options?.replace ? router.replace(to) : router.push(to);
};
export const useLocation = () => {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  return { pathname, search: search ? `?${search}` : '', state: null };
};
export const useParams = <T extends Record<string, string>>() => {
  const pathname = usePathname();
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
