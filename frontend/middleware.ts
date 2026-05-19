import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const protectedPrefixes = ['/dashboard','/seller','/buyer','/admin','/profile','/quotations'];

const backendOriginFor = (host: string) => {
  const configured = process.env.NEXT_PUBLIC_API_URL || process.env.API_URL || '';
  if (configured) return configured.replace(/\/$/, '');

  if (host === 'msme-pugarch-frontend.vercel.app') return 'https://msme-pugarch-backend.vercel.app';
  if (host === 'msme-frontend.vercel.app') return 'https://msme-backend.vercel.app';
  if (host.startsWith('msme-pugarch-frontend-')) return `https://${host.replace('msme-pugarch-frontend-', 'msme-pugarch-backend-')}`;
  if (host.startsWith('msme-frontend-')) return `https://${host.replace('msme-frontend-', 'msme-backend-')}`;
  if (host.includes('-frontend-')) return `https://${host.replace('-frontend-', '-backend-')}`;

  return '';
};

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  if (pathname.startsWith('/api/')) {
    const backendOrigin = backendOriginFor(req.nextUrl.hostname);
    if (backendOrigin) {
      return NextResponse.rewrite(`${backendOrigin}${pathname}${search}`);
    }
  }

  const token = req.cookies.get('token')?.value;
  const needsAuth = protectedPrefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  if (needsAuth && !token) {
    const url = req.nextUrl.clone();
    url.pathname = '/';
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ['/((?!_next|favicon.ico).*)'] };
