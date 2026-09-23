import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const protectedPrefixes = ['/dashboard', '/seller', '/buyer', '/admin', '/master-admin', '/profile', '/quotations'];

// Public routes that start with protected prefixes but should be accessible without auth
const publicExceptions = ['/seller/register', '/buyer/register', '/admin/register', '/seller/rfq', '/seller/rfp'];

export function middleware(req: NextRequest) {
  // Allow requests to proceed to the Next.js client-side application so that
  // useAuth, App.tsx route guards, and local session caches can hydrate cleanly
  // without premature server-side redirects to '/' during page refreshes.
  return NextResponse.next();
}

export const config = { matcher: ['/((?!_next|favicon.ico).*)'] };
