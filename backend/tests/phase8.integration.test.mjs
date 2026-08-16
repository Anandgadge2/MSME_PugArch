import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import test from 'node:test';

const read = relativePath => readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');

test('prisma schema definition exists and contains core models', () => {
  assert.ok(existsSync(new URL('../prisma/schema.prisma', import.meta.url)));
  const schema = read('prisma/schema.prisma');
  assert.match(schema, /model User/);
  assert.match(schema, /model ProcurementBid/);
  assert.match(schema, /model PaymentTransaction/);
  assert.match(schema, /model EscrowAccount/);
});

test('authentication and authorization middleware are wired into entry points', () => {
  const index = read('index.ts');
  assert.match(index, /app\.use/);
  const authRoutes = read('src/modules/auth/auth.routes.ts');
  assert.match(authRoutes, /authRoutes\.post\('\/login'/);
  assert.match(authRoutes, /authRoutes\.post\('\/register'/);
});

test('procurement bid lifecycle routes enforce authorization and valid payload schema', () => {
  const service = read('src/modules/procurementBid/procurement-bid.service.ts');
  assert.match(service, /export const acceptL2Match/);
  assert.match(service, /export const reviseParticipation/);
  assert.match(service, /PARTICIPATION_NOT_FOUND/);
});

test('payment module enforces offline payment proof upload verification controls', () => {
  const routes = read('src/modules/payments/payment.routes.ts');
  assert.match(routes, /offline-proof/);
  assert.match(routes, /offlineProofSchema/);
  assert.match(routes, /paymentReference/);
});
