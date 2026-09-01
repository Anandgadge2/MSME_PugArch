/**
 * Centralized Route Builder Utility
 * ──────────────────────────────────
 * Single source of truth for all procurement-related URL construction.
 * Replaces scattered string-template URLs across the codebase with
 * type-safe, consistent route builders.
 *
 * URL Pattern:
 *   /{role}/procurement/{type-slug}/{id}
 *   /{role}/procurement/{type-slug}/{id}/{action}
 */

import type { ProcurementMethodId } from '../features/procurementWizard/procurementMethodsConfig';

/* ── slug mapping ─────────────────────────────────────────────────── */

const METHOD_SLUG_MAP: Record<ProcurementMethodId, string> = {
  RFQ: 'rfq',
  RFP: 'rfp',
  OPEN_TENDER: 'open-tender',
  LIMITED_TENDER: 'limited-tender',
  REVERSE_AUCTION: 'reverse-auction',
  RATE_CONTRACT: 'rate-contract',
  REPEAT_ORDER: 'rfq', // repeat orders share the RFQ detail view
};

const SLUG_TO_METHOD: Record<string, ProcurementMethodId> = Object.fromEntries(
  Object.entries(METHOD_SLUG_MAP)
    .filter(([, slug], _i, arr) => {
      // Only include first mapping for each slug (skip REPEAT_ORDER → rfq)
      return arr.findIndex(([, s]) => s === slug) === arr.indexOf(arr.find(([, s]) => s === slug)!);
    })
    .map(([method, slug]) => [slug, method as ProcurementMethodId])
) as Record<string, ProcurementMethodId>;

/** Convert canonical method to URL slug */
export function methodToSlug(method: string): string {
  const upper = method.toUpperCase().replace(/[- ]/g, '_') as ProcurementMethodId;
  return METHOD_SLUG_MAP[upper] ?? method.toLowerCase().replace(/_/g, '-');
}

/** Convert URL slug back to canonical method */
export function slugToMethod(slug: string): ProcurementMethodId | undefined {
  return SLUG_TO_METHOD[slug];
}

/* ── route builders ───────────────────────────────────────────────── */

export const sellerRoutes = {
  /** Seller opportunities listing with optional type filter */
  opportunities: (type?: ProcurementMethodId) =>
    type
      ? `/seller/procurement/opportunities?type=${methodToSlug(type)}`
      : '/seller/procurement/opportunities',

  /** Procurement detail view: /seller/procurement/{type}/{id} */
  detail: (type: string, id: string | number) =>
    `/seller/procurement/${methodToSlug(type)}/${encodeURIComponent(String(id))}`,

  /** Respond / submit quotation: /seller/procurement/{type}/{id}/respond */
  respond: (type: string, id: string | number) =>
    `/seller/procurement/${methodToSlug(type)}/${encodeURIComponent(String(id))}/respond`,

  /** Reverse auction live room */
  auctionLive: (id: string | number) =>
    `/seller/procurement/reverse-auction/${encodeURIComponent(String(id))}/live`,

  /** Reverse auction results */
  auctionResults: (id: string | number) =>
    `/seller/procurement/reverse-auction/${encodeURIComponent(String(id))}/results`,

  /** Submitted bids listing */
  bids: {
    submitted: '/seller/bids/submitted' as const,
    draft: '/seller/bids/draft' as const,
    awarded: '/seller/bids/awarded' as const,
  },
} as const;

export const buyerRoutes = {
  /** Buyer procurement detail view */
  detail: (type: string, id: string | number) =>
    `/buyer/procurement/${methodToSlug(type)}/${encodeURIComponent(String(id))}`,

  /** Create procurement (with optional method preset) */
  create: (method?: ProcurementMethodId) =>
    method
      ? `/buyer/procurement/create?method=${method}`
      : '/buyer/procurement/create',

  /** My procurements listing */
  myProcurements: (type?: string) =>
    type
      ? `/buyer/my-procurements?type=${type}`
      : '/buyer/my-procurements',

  /** Supplier responses */
  responses: '/buyer/procurement/responses' as const,

  /** Procurement drafts */
  drafts: '/buyer/procurement/drafts' as const,
} as const;

/* ── legacy redirect helpers ──────────────────────────────────────── */

/**
 * Mapping of old URL patterns → new URL builders.
 * Used in App.tsx to create backwards-compatible redirects.
 */
export interface LegacyRedirectResult {
  to: string;
  permanent: boolean;
}

/**
 * Attempt to resolve a legacy URL to the new canonical URL.
 * Returns null if the path is not a legacy pattern.
 */
export function resolveLegacyUrl(
  pathname: string,
  searchParams: URLSearchParams,
): LegacyRedirectResult | null {
  const requestId = searchParams.get('requestId') || searchParams.get('requirementId') || searchParams.get('id') || searchParams.get('bidId') || searchParams.get('rfqId');

  // /seller/rfq?requestId=... → /seller/procurement/rfq/{id}
  // NOTE: We can't distinguish Open/Limited Tender from RFQ at the URL level alone;
  // the page component will need to handle the type resolution after data fetch.
  if (pathname === '/seller/rfq' && requestId) {
    return { to: sellerRoutes.detail('RFQ', requestId), permanent: false };
  }
  if (pathname === '/seller/rfp' && requestId) {
    return { to: sellerRoutes.detail('RFP', requestId), permanent: false };
  }
  if (pathname === '/seller/rate-contract' && requestId) {
    return { to: sellerRoutes.detail('RATE_CONTRACT', requestId), permanent: false };
  }

  // /seller/rfq/submit-quotation?requestId=... → /seller/procurement/rfq/{id}/respond
  if (pathname === '/seller/rfq/submit-quotation' && requestId) {
    return { to: sellerRoutes.respond('RFQ', requestId), permanent: false };
  }
  if (pathname === '/seller/rfp/submit-quotation' && requestId) {
    return { to: sellerRoutes.respond('RFP', requestId), permanent: false };
  }
  if ((pathname === '/seller/rate-contract/submit-quotation' || pathname === '/seller/rate-contracts/submit-quotation') && requestId) {
    return { to: sellerRoutes.respond('RATE_CONTRACT', requestId), permanent: false };
  }

  // /reverse-auctions/:id → /seller/procurement/reverse-auction/:id
  const raMatch = pathname.match(/^\/reverse-auctions\/(\d+)$/);
  if (raMatch) {
    return { to: sellerRoutes.detail('REVERSE_AUCTION', raMatch[1]), permanent: false };
  }
  const raLiveMatch = pathname.match(/^\/reverse-auctions\/(\d+)\/live$/);
  if (raLiveMatch) {
    return { to: sellerRoutes.auctionLive(raLiveMatch[1]), permanent: false };
  }
  const raResultMatch = pathname.match(/^\/reverse-auctions\/(\d+)\/results$/);
  if (raResultMatch) {
    return { to: sellerRoutes.auctionResults(raResultMatch[1]), permanent: false };
  }

  return null;
}
