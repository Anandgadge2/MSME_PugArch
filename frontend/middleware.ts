import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  const response = NextResponse.next();
  // Set cookie to skip PremiumLoader splash screen on first visit
  // (prevents 1.15s render delay for Lighthouse and real users)
  if (!req.cookies.get('jsg_initial_load')) {
    response.cookies.set('jsg_initial_load', 'true', {
      path: '/',
      maxAge: 365 * 24 * 60 * 60,
      sameSite: 'lax',
    });
  }
  return response;
}

export const config = {
  matcher: [
    // Only match page routes, skip all static files and Next.js internals
    '/((?!_next|favicon\\.ico|favicon\\.png|logoo\\.png|logo\\.png|msme-logo\\.png|category-photos|banners|products|org-logos|docs|llms\\.txt|.*\\.(?:png|jpg|jpeg|webp|svg|ico|woff2|woff|ttf|eot|css|js|map|pdf)).*)',
  ],
};
