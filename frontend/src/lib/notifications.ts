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

  // If the redirect is explicitly a generic dashboard/notifications home,
  // return null so our intelligent type-and-content inference can route
  // to the specific section instead of dropping the user onto the main page.
  const lower = trimmed.toLowerCase();
  if (
    lower === '/dashboard' ||
    lower === '/' ||
    lower === '/home' ||
    lower === '/notifications' ||
    lower === '/shg/dashboard' ||
    lower === '/master-admin'
  ) {
    return null;
  }

  // Rewrite /orders/procurement/:id -> /procurement-orders/:id
  const orderProcMatch = trimmed.match(/^\/orders\/procurement\/(\d+)/i);
  if (orderProcMatch) {
    return `/procurement-orders/${orderProcMatch[1]}`;
  }
  if (trimmed === '/orders/procurement') {
    return role === 'buyer' ? '/buyer/orders' : '/seller/awards';
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
    return role === 'admin' ? '/admin/bids' : '/buyer/my-procurements';
  }

  // Rewrite generic /orders/repeat
  if (trimmed === '/orders/repeat') {
    return role === 'buyer' ? '/buyer/repeat-orders' : '/orders';
  }

  return trimmed;
}

/**
 * Extracts specific entity IDs (bid ID, order ID, invoice ID) from notification
 * text, title, or raw URLs.
 */
function extractEntityReferences(item: PortalNotification): {
  bidId?: string;
  orderId?: string;
  invoiceId?: string;
} {
  const combined = `${item.route || ''} ${item.redirectUrl || ''} ${item.title || ''} ${item.message || ''}`;

  // Bid references: e.g. /bids/123, BID-123, PRC-123, Bid #123, requirement 123
  const bidMatch =
    combined.match(/\/bids\/([A-Za-z0-9-_]+)/i) ||
    combined.match(/\b(?:BID|PRC|TND)-([A-Za-z0-9-_]+)/i) ||
    combined.match(/\b(?:bid|requirement|tender)\s+#?([0-9]+)\b/i);

  // Order references: e.g. /procurement-orders/123, PO-PB-123, PO-123, Purchase Order #123, /orders/123
  const orderMatch =
    combined.match(/\/(?:procurement-orders|orders\/procurement)\/(\d+)/i) ||
    combined.match(/\b(?:PO-PB-[A-Za-z0-9-_]+|PO-[A-Za-z0-9-_]+)/i) ||
    combined.match(/\b(?:purchase\s+order|order)\s+#?([0-9]+)\b/i);

  // Invoice references: e.g. /invoices/123, INV-123, Invoice #123
  const invoiceMatch =
    combined.match(/\/invoices\/([A-Za-z0-9-_]+)/i) ||
    combined.match(/\bINV-([A-Za-z0-9-_]+)/i) ||
    combined.match(/\binvoice\s+#?([0-9]+)\b/i);

  return {
    bidId: bidMatch ? bidMatch[1] : undefined,
    orderId: orderMatch ? orderMatch[1] : undefined,
    invoiceId: invoiceMatch ? invoiceMatch[1] : undefined
  };
}

/**
 * Intelligently computes the target destination page/section when a notification
 * is clicked, preventing unintended bounces to the main dashboard.
 */
export const routeForNotification = (
  item: PortalNotification,
  role?: string,
  user?: any,
): string => {
  const userRole = (role || user?.role || '').toLowerCase();
  const rawExplicit = item.route || item.redirectUrl;

  if (rawExplicit) {
    const normalized = normalizeExplicitRoute(rawExplicit, userRole);
    if (normalized) {
      return safeInternalPath(normalized, '/notifications');
    }
  }

  const type = String(item.type || '').toLowerCase();
  const text = `${item.title || ''} ${item.message || ''}`.toLowerCase();
  const { bidId, orderId } = extractEntityReferences(item);

  // 1. Bid Award & Counter-Offer Notifications
  if (
    type.includes('award') ||
    type.includes('counter_offer') ||
    type === 'bid_awarded' ||
    text.includes('award offer') ||
    text.includes('bid award') ||
    text.includes('awarded')
  ) {
    if (userRole === 'seller' || userRole === 'shg') {
      if (bidId) return `/bids/${bidId}`;
      return '/seller/awards';
    }
    if (userRole === 'buyer') {
      if (bidId) return `/bids/${bidId}`;
      return '/buyer/my-procurements';
    }
    return bidId ? `/bids/${bidId}` : '/admin/bids';
  }

  // 2. Purchase Order & Direct Orders
  if (
    type.includes('purchase_order') ||
    type.includes('po_') ||
    type.includes('quotation_accepted') ||
    text.includes('purchase order') ||
    text.includes('quotation accepted') ||
    type.includes('direct_purchase')
  ) {
    if (orderId && /^\d+$/.test(orderId)) {
      return `/procurement-orders/${orderId}`;
    }
    if (userRole === 'seller' || userRole === 'shg') {
      return '/seller/awards';
    }
    if (userRole === 'buyer') {
      return '/buyer/orders';
    }
    return '/orders';
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
    if (orderId && /^\d+$/.test(orderId)) {
      return `/procurement-orders/${orderId}`;
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

  // 9. Invitations & Procurement Opportunities
  if (type.includes('invit') || text.includes('invited')) {
    if (bidId) return `/bids/${bidId}`;
    return userRole === 'buyer' ? '/buyer/my-procurements' : '/seller/procurement/events';
  }

  // 10. RFQ, Quotes & Clarifications
  if (type.includes('quote') || type.includes('rfq') || type.includes('rfp')) {
    if (userRole === 'buyer') return '/buyer/my-procurements';
    return '/quotations';
  }

  // 11. Bids, Tenders & Auctions
  if (
    type.includes('tender') ||
    type.includes('auction') ||
    type.includes('bid') ||
    type.includes('procurement')
  ) {
    if (bidId) return `/bids/${bidId}`;
    if (userRole === 'buyer') return '/buyer/my-procurements';
    if (userRole === 'seller' || userRole === 'shg') return '/seller/procurement/events';
    return '/admin/bids';
  }

  // 12. Organization & Categories
  if (type.includes('organization')) {
    return userRole === 'admin' ? '/admin/organizations' : (userRole === 'buyer' ? '/buyer/profile' : '/seller/profile');
  }
  if (type.includes('category')) {
    return '/admin/categories';
  }

  // Fallback to role-specific active section rather than the generic dashboard home
  if (userRole === 'seller' || userRole === 'shg') return '/seller/orders';
  if (userRole === 'buyer') return '/buyer/my-procurements';
  if (userRole === 'admin') return '/admin/bids';

  return '/notifications';
};
