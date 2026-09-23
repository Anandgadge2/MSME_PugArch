import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const readBackend = relativePath => readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');

test('Seller and SHG Public Procurement Notification Dispatch Suite', async (t) => {
  await t.test('1. notificationService contains notifySellersAndShgsOfProcurement method', () => {
    const notificationService = readBackend('src/services/notification.service.ts');
    assert.match(notificationService, /async notifySellersAndShgsOfProcurement\(/);
    assert.match(notificationService, /role:\s*\{\s*in:\s*\['seller',\s*'shg'\]/);
    assert.match(notificationService, /type:\s*'procurement\.opportunity'/);
    assert.match(notificationService, /this\.notifyUser\(user\.id,\s*notifyOpts,\s*\['in_app',\s*'email'\]\)/);
  });

  await t.test('2. phase4.routes.ts dispatches notifications to sellers/SHGs on procurement submit', () => {
    const phase4Routes = readBackend('src/routes/phase4.routes.ts');
    assert.match(phase4Routes, /notificationService\.notifySellersAndShgsOfProcurement\(\{[\s\S]*?id:\s*bid\.id/);
    assert.match(phase4Routes, /notificationService\.notifySellersAndShgsOfProcurement\(\{[\s\S]*?id:\s*auction\.id/);
  });

  await t.test('3. procurement-bid.service.ts dispatches notifications to sellers/SHGs on bid publish and approval', () => {
    const bidService = readBackend('src/modules/procurementBid/procurement-bid.service.ts');
    assert.match(bidService, /notificationService\.notifySellersAndShgsOfProcurement\(\{[\s\S]*?id:\s*bid\.id/);
  });
});
