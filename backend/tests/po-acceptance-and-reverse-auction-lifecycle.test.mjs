import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = relativePath => readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');

test('1. PO UI does not auto-accept when activeAward is ACCEPTED', () => {
  const unifiedView = read('../frontend/src/features/rfq/components/ProcurementDetailUnifiedView.tsx');

  const isPoAcceptedMatch = unifiedView.match(/const isPOAccepted = Boolean\(([\s\S]*?)\);/);
  assert.ok(isPoAcceptedMatch, 'isPOAccepted must be defined in ProcurementDetailUnifiedView');
  assert.doesNotMatch(
    isPoAcceptedMatch[1],
    /activeAward\?\.awardStatus === ['"]ACCEPTED['"]/,
    'isPOAccepted must NOT auto-accept simply because activeAward.awardStatus is ACCEPTED'
  );

  assert.match(unifiedView, /Accept PO &amp; Commit Delivery|Accept PO & Commit Delivery/);
  assert.match(unifiedView, /Decline PO/);
});

test('2. Backend acceptPO updates standby non-selected bidders to NOT_SELECTED', () => {
  const orderService = read('src/modules/procurementBid/procurement-order.service.ts');

  assert.match(orderService, /po\.bidId/);
  assert.match(orderService, /linkedBidId/);
  assert.match(orderService, /finalStatus:\s*['"]NOT_SELECTED['"]/);
  assert.match(orderService, /title:\s*['"]Tender Concluded['"]/);
});

test('3. Backend rejectPO / declinePO route and service exist with validation', () => {
  const orderService = read('src/modules/procurementBid/procurement-order.service.ts');
  const routes = read('src/modules/procurementBid/procurement-bid.routes.ts');

  assert.match(orderService, /export const rejectPO = async/);
  assert.match(orderService, /finalStatus:\s*['"]PO_DECLINED['"]/);
  assert.match(orderService, /status:\s*['"]cancelled['"]/);

  assert.match(routes, /\/seller\/purchase-orders\/:id\/reject/);
  assert.match(routes, /\/seller\/purchase-orders\/:id\/decline/);
});

test('4. SellerAwardPoAlertPopup includes Decline PO option with reason', () => {
  const alertPopup = read('../frontend/src/features/notifications/SellerAwardPoAlertPopup.tsx');

  assert.match(alertPopup, /handleDeclinePO/);
  assert.match(alertPopup, /\/api\/seller\/purchase-orders\/\$\{poId\}\/decline/);
  assert.match(alertPopup, /Reason for Declining PO/);
  assert.match(alertPopup, /Confirm Decline/);
});

test('5. Single-packet RFQ reverse auction is visible to seller without false guard', () => {
  const unifiedView = read('../frontend/src/features/rfq/components/ProcurementDetailUnifiedView.tsx');

  assert.match(
    unifiedView,
    /linkedAuction\s*&&\s*!\(linkedAuction as any\)\.auctionPlanned\s*&&\s*\["LIVE",\s*"SCHEDULED"\]\.includes/
  );
});

test('6. Seller Bids Page identifies REVERSE_AUCTION_ACTIVE and links to live auction', () => {
  const sellerBids = read('../frontend/src/features/procurementBid/pages/SellerBidsPage.tsx');

  assert.match(sellerBids, /REVERSE_AUCTION_ACTIVE/);
  assert.match(sellerBids, /\/seller\/procurement\/reverse-auction\//);
  assert.match(sellerBids, /Live/);
});

test('7. Reverse Auction start-from-bids retains sellerOrgId and sellerUserId', () => {
  const bidResults = read('../frontend/src/features/procurementBid/pages/BidResultsPage.tsx');
  const raRoutes = read('src/routes/reverse-auction.routes.ts');

  assert.match(bidResults, /sellerOrgId:\s*r\.sellerOrgId/);
  assert.match(bidResults, /sellerUserId:\s*r\.sellerUserId/);

  assert.match(raRoutes, /start-from-bids/);
  assert.match(raRoutes, /broadcastToAuction/);
  assert.match(raRoutes, /broadcastToProcurement/);
});

test('8. Seller Dashboard tiles and urgent actions reflect live reverse auctions', () => {
  const urgentInbox = read('../frontend/src/features/dashboard/components/UrgentActionsInbox.tsx');
  const actionCards = read('../frontend/src/features/dashboard/components/RoleAwareActionCards.tsx');

  assert.match(urgentInbox, /act-live-auction/);
  assert.match(urgentInbox, /Live Reverse Auction/);
  assert.match(actionCards, /Live Reverse Auctions/);
});
