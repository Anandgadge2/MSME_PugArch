import { getSellerPortalPath } from './shg';
import { safeInternalPath } from './safeNavigation';

export interface PortalNotification {
  id: number | string;
  title: string;
  message: string;
  type: string;
  isRead?: boolean;
  createdAt?: string;
  route?: string;
  redirectUrl?: string;
}

/**
 * Normalizes legacy, backend-internal, or malformed notification URLs into
 * valid frontend routes.
 */
function normalizeExplicitRoute(url: string, role?: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;

  // If the redirect is explicitly a generic dashboard/notifications home or dead route,
  // return null so our intelligent type-and-content inference can route
  // to the specific section instead of dropping the user onto the main page.
  const lower = trimmed.toLowerCase();
  if (
    lower === '/dashboard' ||
    lower === '/' ||
    lower === '/home' ||
    lower === '/notifications' ||
    lower === '/shg/dashboard' ||
    lower === '/master-admin' ||
    lower === '/quotations' ||
    lower === '/seller/opportunities' ||
    lower === '/shg/opportunities' ||
    lower === '/opportunities'
  ) {
    return null;
  }

  // Rewrite legacy procurement orders -> canonical Purchase Order routes
  const orderProcMatch = trimmed.match(/^\/(?:procurement-orders|orders\/procurement)\/([A-Za-z0-9-_]+)/i);
  if (orderProcMatch) {
    const id = orderProcMatch[1];
    return role === 'seller' || role === 'shg'
      ? `/seller/orders?orderId=${id}`
      : role === 'buyer'
      ? `/buyer/orders?orderId=${id}`
      : `/orders?orderId=${id}`;
  }
  if (trimmed === '/orders/procurement' || trimmed === '/procurement-orders') {
    return role === 'seller' || role === 'shg'
      ? '/seller/orders'
      : role === 'buyer'
      ? '/buyer/orders'
      : '/orders';
  }

  // Rewrite /admin/bids/:id -> /bids/:id
  const adminBidMatch = trimmed.match(/^\/admin\/bids\/([^/?#]+)/i);
  if (adminBidMatch) {
    return `/bids/${adminBidMatch[1]}`;
  }

  // Rewrite /buyer/procurement/events/:id -> /bids/:id
  const buyerEventMatch = trimmed.match(/^\/buyer\/procurement\/events\/([^/?#]+)/i);
  if (buyerEventMatch) {
    return `/bids/${buyerEventMatch[1]}`;
  }

  // Rewrite legacy approvals -> role-based target
  if (trimmed === '/approvals' || trimmed.startsWith('/approvals?')) {
    return role === 'admin' ? '/admin/onboarding' : '/buyer/my-procurements';
  }

  // Rewrite generic /orders/repeat
  if (trimmed === '/orders/repeat') {
    return role === 'buyer' ? '/buyer/repeat-orders' : '/orders';
  }

  return trimmed;
}

/**
 * Extracts specific entity IDs (bid ID, order ID, invoice ID, quoteRequestId) from notification
 * text, title, or raw URLs.
 */
function extractEntityReferences(item: PortalNotification): {
  bidId?: string;
  orderId?: string;
  invoiceId?: string;
  quoteRequestId?: string;
} {
  const combined = `${item.route || ''} ${item.redirectUrl || ''} ${item.title || ''} ${item.message || ''}`;

  // Bid references: e.g. /bids/123, PRC-24, RC-2026-22135, RA-2026-001, RFQ-2026-001, RFP-2026-001, TND-123, BID-123
  const bidMatch =
    combined.match(/\/bids\/([A-Za-z0-9-_]+)/i) ||
    combined.match(/\/(?:rfq|rfp|open-tender|limited-tender|rate-contract|reverse-auction)\/([A-Za-z0-9-_]+)/i) ||
    combined.match(/\b((?:RC|RA|PRC|RFQ|RFP|TND|TENDER|LTND|BID|DP)-[A-Za-z0-9-_]+)\b/i) ||
    combined.match(/\b(?:bid|requirement|tender|opportunity)\s+#?([A-Za-z0-9-_]+)\b/i);

  // Order references: e.g. /orders?orderId=123, PO-RFQ-2026-82662, PO-PB-123, PO-123, WO-PB-123, Purchase Order #123
  const orderMatch =
    combined.match(/[?&]orderId=([A-Za-z0-9-_]+)/i) ||
    combined.match(/\/(?:procurement-orders|orders\/procurement|purchase-orders|orders)\/([A-Za-z0-9-_]+)/i) ||
    combined.match(/\b((?:PO-PB-|PO-RFQ-|PO-DP-|PO-|WO-PB-|WO-)[A-Za-z0-9-_]+)\b/i) ||
    combined.match(/\b(?:purchase\s+order|order|po)\s+#?([A-Za-z0-9-_]+)\b/i);

  // Invoice references: e.g. /invoices/123, INV-123, Invoice #123
  const invoiceMatch =
    combined.match(/\/invoices\/([A-Za-z0-9-_]+)/i) ||
    combined.match(/\b(INV-[A-Za-z0-9-_]+)\b/i) ||
    combined.match(/\binvoice\s+#?([A-Za-z0-9-_]+)\b/i);

  // Quote Request references: e.g. quoteRequestId=7, Quote Request #7
  const qrMatch =
    combined.match(/[?&]quoteRequestId=(\d+)/i) ||
    combined.match(/\bQuote\s+Request\s+#?(\d+)\b/i);

  return {
    bidId: bidMatch ? bidMatch[1] : undefined,
    orderId: orderMatch ? orderMatch[1] : undefined,
    invoiceId: invoiceMatch ? invoiceMatch[1] : undefined,
    quoteRequestId: qrMatch ? qrMatch[1] : undefined,
  };
}

/**
 * Intelligently computes the target destination page/section when a notification
 * is clicked, opening the proper details view page ID-wise and preventing unintended bounces.
 */
export const routeForNotification = (
  item: PortalNotification,
  role?: string,
  user?: any,
): string => {
  const userRole = (role || user?.role || '').toLowerCase();
  const rawExplicit = item.route || item.redirectUrl;
  const { bidId, orderId, invoiceId, quoteRequestId } = extractEntityReferences(item);

  // Check if explicit route is merely a generic listing that should yield to entity extraction
  const isGenericExplicit =
    !rawExplicit ||
    ['/dashboard', '/', '/home', '/notifications', '/shg/dashboard', '/master-admin', '/quotations', '/seller/opportunities', '/shg/opportunities', '/opportunities', '/seller/orders', '/buyer/orders', '/orders'].includes(rawExplicit.trim().toLowerCase());

  if (rawExplicit && (!isGenericExplicit || (!orderId && !bidId && !quoteRequestId && !invoiceId))) {
    const normalized = normalizeExplicitRoute(rawExplicit, userRole);
    if (normalized) {
      return safeInternalPath(normalized, '/notifications');
    }
  }

  const type = String(item.type || '').toLowerCase();
  const text = `${item.title || ''} ${item.message || ''}`.toLowerCase();

  // 1. Purchase Orders & Direct Purchases (ID-wise opening)
  if (
    orderId ||
    type.includes('purchase_order') ||
    type.includes('po_') ||
    type.includes('quotation_accepted') ||
    type.includes('quote_response_accepted') ||
    type.includes('quote_request_closed') ||
    text.includes('purchase order') ||
    text.includes('quotation accepted') ||
    text.includes('response was accepted') ||
    type.includes('direct_purchase')
  ) {
    if (orderId) {
      if (userRole === 'seller' || userRole === 'shg') return `/seller/orders?orderId=${encodeURIComponent(orderId)}`;
      if (userRole === 'buyer') return `/buyer/orders?orderId=${encodeURIComponent(orderId)}`;
      return `/orders?orderId=${encodeURIComponent(orderId)}`;
    }
    if (userRole === 'seller' || userRole === 'shg') return '/seller/orders';
    if (userRole === 'buyer') return '/buyer/orders';
    return '/orders';
  }

  // 2. Bid Award & Counter-Offer Notifications
  if (
    type.includes('award') ||
    type.includes('counter_offer') ||
    type === 'bid_awarded' ||
    text.includes('award offer') ||
    text.includes('bid award') ||
    text.includes('awarded')
  ) {
    if (userRole === 'seller' || userRole === 'shg') {
      if (bidId) return `/bids/${encodeURIComponent(bidId)}`;
      return '/seller/awards';
    }
    if (userRole === 'buyer') {
      if (bidId) return `/bids/${encodeURIComponent(bidId)}`;
      return '/buyer/my-procurements';
    }
    return bidId ? `/bids/${encodeURIComponent(bidId)}` : '/admin/delivery';
  }

  // 3. Delivery, Shipment, Logistics, GRN & Inspection
  if (
    type.includes('grn') ||
    type.includes('delivery') ||
    type.includes('dispatch') ||
    type.includes('shipment') ||
    type.includes('tracking') ||
    text.includes('grn') ||
    text.includes('delivery') ||
    text.includes('dispatched')
  ) {
    if (orderId) {
      if (userRole === 'seller' || userRole === 'shg') return `/seller/delivery-management?search=${encodeURIComponent(orderId)}`;
      return `/orders/tracking?search=${encodeURIComponent(orderId)}`;
    }
    if (userRole === 'seller' || userRole === 'shg') {
      return '/seller/delivery-management';
    }
    return '/orders/tracking';
  }

  // 4. Invoices & Billing
  if (type.includes('invoice') || text.includes('invoice')) {
    if (userRole === 'seller' || userRole === 'shg') return '/seller/invoices';
    if (userRole === 'buyer') return '/buyer/invoices';
    return '/payments/invoices';
  }

  // 5. Payments, Settlement & Escrow
  if (type.includes('escrow') || text.includes('escrow')) {
    return userRole === 'buyer' ? '/buyer/escrow' : '/escrow';
  }
  if (type.includes('payment') || type.includes('settlement') || text.includes('payment')) {
    if (userRole === 'buyer') return '/buyer/payments';
    if (userRole === 'admin') return '/admin/payments';
    return '/payments';
  }

  // 6. Disputes & Grievances
  if (type.includes('dispute') || text.includes('dispute')) {
    if (userRole === 'admin') return '/admin/disputes';
    return userRole === 'buyer' ? '/buyer/disputes' : '/seller/disputes';
  }
  if (type.includes('grievance') || text.includes('grievance')) {
    return userRole === 'admin' ? '/admin/disputes?tab=grievances' : (userRole === 'buyer' ? '/buyer/disputes' : '/seller/disputes');
  }

  // 7. Onboarding, Profile & KYC
  if (
    type.includes('onboarding') ||
    type.includes('section_') ||
    type.includes('admin_feedback') ||
    type.includes('gst_verified') ||
    type.includes('kyc')
  ) {
    if (userRole === 'admin') return '/admin/onboarding';
    if (userRole === 'buyer') return '/buyer/onboarding';
    return getSellerPortalPath(user);
  }

  // 8. Direct Messages
  if (type.includes('message') || text.includes('message')) {
    if (userRole === 'admin' || userRole === 'master_admin') return '/admin/messages';
    return userRole === 'buyer' ? '/buyer/messages' : '/seller/messages';
  }

  // 9. RFQ & Quote Requests (e.g. "NEW RFQ RECEIVED", "Quote request: ...")
  if (
    type.includes('quote') ||
    type.includes('rfq') ||
    text.includes('quote request') ||
    text.includes('rfq')
  ) {
    if (quoteRequestId) {
      if (userRole === 'seller' || userRole === 'shg') {
        return `/seller/rfq/submit-quotation?quoteRequestId=${encodeURIComponent(quoteRequestId)}`;
      }
      return `/buyer/rfq/detail?requirementId=${encodeURIComponent(quoteRequestId)}&tab=clarifications`;
    }
    if (bidId) {
      if (userRole === 'seller' || userRole === 'shg') {
        return `/seller/procurement/rfq/${encodeURIComponent(bidId)}`;
      }
      return `/bids/${encodeURIComponent(bidId)}`;
    }
    if (userRole === 'buyer') return '/buyer/my-procurements';
    return '/seller/opportunities/rfqs';
  }

  // 10. Reverse Auction (e.g. "NEW PROCUREMENT OPPORTUNITY: REVERSE AUCTION", PRC-24, RA-...)
  if (
    type.includes('auction') ||
    text.includes('reverse auction') ||
    text.includes('auction') ||
    (bidId && bidId.startsWith('RA-'))
  ) {
    const auctionId = bidId ? (bidId.startsWith('PRC-') ? bidId.replace(/^PRC-/, '') : bidId) : undefined;
    if (auctionId) {
      if (userRole === 'seller' || userRole === 'shg') {
        return `/seller/procurement/reverse-auction/${encodeURIComponent(auctionId)}`;
      }
      if (userRole === 'buyer') {
        return `/buyer/procurement/reverse-auction/${encodeURIComponent(auctionId)}`;
      }
      return `/reverse-auctions/${encodeURIComponent(auctionId)}`;
    }
    return userRole === 'buyer' ? '/buyer/my-procurements' : '/seller/opportunities/auctions';
  }

  // 11. Rate Contract (e.g. "NEW PROCUREMENT OPPORTUNITY: RATE CONTRACT 1", RC-2026-22135)
  if (
    text.includes('rate contract') ||
    type.includes('rate_contract') ||
    (bidId && bidId.startsWith('RC-'))
  ) {
    if (bidId) {
      if (userRole === 'seller' || userRole === 'shg') {
        return `/seller/procurement/rate-contract/${encodeURIComponent(bidId)}`;
      }
      if (userRole === 'buyer') {
        return `/buyer/rate-contracts?search=${encodeURIComponent(bidId)}`;
      }
      return `/bids/${encodeURIComponent(bidId)}`;
    }
    return userRole === 'buyer' ? '/buyer/rate-contracts' : '/seller/opportunities/rate-contracts';
  }

  // 12. Invitations & Procurement Opportunities (Tenders, RFPs, Bids)
  if (
    type.includes('invit') ||
    text.includes('invited') ||
    type.includes('tender') ||
    type.includes('bid') ||
    type.includes('procurement') ||
    type.includes('opportunity')
  ) {
    if (bidId) {
      if (userRole === 'seller' || userRole === 'shg') {
        if (text.includes('open tender') || bidId.startsWith('TND-') || bidId.startsWith('TENDER-')) {
          return `/seller/procurement/open-tender/${encodeURIComponent(bidId)}`;
        }
        if (text.includes('limited tender') || bidId.startsWith('LTND-')) {
          return `/seller/procurement/limited-tender/${encodeURIComponent(bidId)}`;
        }
        if (text.includes('rfp') || bidId.startsWith('RFP-')) {
          return `/seller/procurement/rfp/${encodeURIComponent(bidId)}`;
        }
      }
      return `/bids/${encodeURIComponent(bidId)}`;
    }
    if (userRole === 'buyer') return '/buyer/my-procurements';
    if (userRole === 'seller' || userRole === 'shg') return '/seller/opportunities';
    return '/admin/delivery';
  }

  // 13. Organization & Categories
  if (type.includes('organization')) {
    return userRole === 'admin' ? '/admin/organizations' : (userRole === 'buyer' ? '/buyer/profile' : '/seller/profile');
  }
  if (type.includes('category')) {
    return '/admin/categories';
  }

  // Fallback to role-specific active section rather than generic dashboard
  if (userRole === 'seller' || userRole === 'shg') return '/seller/orders';
  if (userRole === 'buyer') return '/buyer/my-procurements';
  if (userRole === 'admin') return '/admin/onboarding';

  return '/notifications';
};
