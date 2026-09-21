import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const readBackend = relativePath => readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
const readFrontend = relativePath => readFileSync(new URL(`../../frontend/${relativePath}`, import.meta.url), 'utf8');

test('Seller Award and PO Login Alert & Notification Deep-Linking Suite', async (t) => {
  await t.test('1. Backend registers /seller/pending-awards-and-pos endpoint with seller & shg access', () => {
    const routes = readBackend('src/modules/procurementBid/procurement-bid.routes.ts');
    assert.match(routes, /router\.get\('\/seller\/pending-awards-and-pos',\s*authenticate,\s*requireAccountType\('seller',\s*'shg'\)/);
    assert.match(routes, /orderService\.listPendingAwardsAndPOsForSeller/);
  });

  await t.test('2. Backend listPendingAwardsAndPOsForSeller queries live database for OFFERED awards and issued POs', () => {
    const service = readBackend('src/modules/procurementBid/procurement-order.service.ts');
    assert.match(service, /export const listPendingAwardsAndPOsForSeller = async/);
    assert.match(service, /awardStatus:\s*\{\s*in:\s*\['OFFERED',\s*'RECOMMENDED',\s*'ADMIN_APPROVED'\]\s*\}/);
    assert.match(service, /status:\s*\{\s*in:\s*\['issued',\s*'generated',\s*'pending_acceptance',\s*'placed'\]\s*\}/);
    assert.match(service, /hasPending:\s*formattedAwards\.length > 0 \|\| formattedPOs\.length > 0/);
  });

  await t.test('3. Backend PO notification redirects directly to /seller/orders?orderId=:id rather than unmapped path', () => {
    const service = readBackend('src/modules/procurementBid/procurement-order.service.ts');
    assert.match(service, /redirectUrl:\s*`\/seller\/orders\?orderId=\$\{result\.id\}`/);
  });

  await t.test('4. Frontend routeForNotification normalizes routes and avoids dashboard redirects', () => {
    const notifs = readFrontend('src/lib/notifications.ts');
    assert.match(notifs, /function normalizeExplicitRoute/);
    assert.match(notifs, /\/seller\/orders\?orderId=\$\{id\}/);
    assert.match(notifs, /extractEntityReferences/);
    assert.match(notifs, /bid_awarded/);
    assert.match(notifs, /quotation_accepted/);
  });

  await t.test('5. Frontend App.tsx mounts SellerAwardPoAlertPopup for seller & shg users', () => {
    const app = readFrontend('src/App.tsx');
    assert.match(app, /const SellerAwardPoAlertPopup = lazy/);
    assert.match(app, /<SellerAwardPoAlertPopup \/>/);
    assert.match(app, /user\.role === 'seller' \|\| user\.role === 'shg'/);
  });

  await t.test('6. Frontend SellerAwardPoAlertPopup exists and accepts awards and POs directly', () => {
    const popup = readFrontend('src/features/notifications/SellerAwardPoAlertPopup.tsx');
    assert.match(popup, /\/api\/seller\/pending-awards-and-pos/);
    assert.match(popup, /handleAcceptAward/);
    assert.match(popup, /handleAcceptPO/);
    assert.match(popup, /role="alertdialog"/);
  });
});
