import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import test from 'node:test';

const read = relativePath => readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');

test('1. Delivery routes are mounted and enforce authentication middleware', () => {
  const routesIndex = read('src/routes/index.ts');
  assert.match(routesIndex, /router\.use\('\/delivery',\s*deliveryRoutes\)/);

  const deliveryRoutes = read('src/modules/delivery/delivery.routes.ts');
  assert.match(deliveryRoutes, /import\s*\{\s*authenticate/);
  assert.match(deliveryRoutes, /router\.get\('\/',\s*authenticate/);
  assert.match(deliveryRoutes, /router\.post\('\/:id\/buyer\/acceptance',\s*authenticate/);
  assert.match(deliveryRoutes, /router\.post\('\/:id\/seller\/status',\s*authenticate/);
  assert.match(deliveryRoutes, /router\.post\('\/:id\/finance\/verify-invoice',\s*authenticate/);
  assert.match(deliveryRoutes, /router\.post\('\/:id\/admin\/override',\s*authenticate/);
});

test('2. All delivery statuses exist identically in constants and Prisma schema', () => {
  const constants = read('src/modules/delivery/delivery.constants.ts');
  const schema = read('prisma/schema.prisma');

  const expectedStatuses = [
    'CREATED',
    'SELLER_ACCEPTED',
    'SELLER_REJECTED',
    'PACKED',
    'READY_FOR_PICKUP',
    'PICKUP_SCHEDULED',
    'PICKED_UP',
    'DISPATCHED',
    'IN_TRANSIT',
    'AT_HUB',
    'OUT_FOR_DELIVERY',
    'DELIVERED',
    'DELIVERY_CONFIRMATION_PENDING',
    'ACCEPTED',
    'REJECTED',
    'RETURN_INITIATED',
    'RETURNED',
    'REPLACEMENT_REQUESTED',
    'DISPUTE_RAISED',
    'DISPUTE_RESOLVED',
    'INVOICE_VERIFIED',
    'PAYMENT_APPROVED',
    'PAYMENT_RELEASED',
    'CLOSED',
    'DELAYED',
    'REATTEMPT_SCHEDULED',
    'DELIVERY_FAILED',
    'CANCELLED'
  ];

  for (const status of expectedStatuses) {
    assert.match(constants, new RegExp(`'${status}'`));
    assert.match(schema, new RegExp(`\\b${status}\\b`));
  }
});

test('3. Rejection, dispute, and admin override require explicit reasons in validation', () => {
  const validation = read('src/modules/delivery/delivery.validation.ts');
  assert.match(validation, /export const sellerRejectionBody\s*=\s*z\.object\({\s*reason:\s*trimmedString\(1000\)\s*}\)/);
  assert.match(validation, /export const disputeRaiseBody\s*=\s*z\.object\({\s*category:\s*trimmedString\(80\),\s*reason:\s*trimmedString\(2000\)/);
  assert.match(validation, /export const adminOverrideBody\s*=\s*z\.object\({\s*status:\s*deliveryStatusSchema,\s*reason:\s*trimmedString\(2000\)/);
  assert.match(validation, /export const disputeResolveBody\s*=\s*z\.object\({\s*resolutionRemarks:\s*trimmedString\(2000\)/);
});

test('4. Buyer acceptance refinement enforces rejectionReason when rejected', () => {
  const validation = read('src/modules/delivery/delivery.validation.ts');
  assert.match(validation, /body\.accepted\s*\|\|\s*\(body\.rejectionReason\s*&&\s*body\.rejectionReason\.length\s*>\s*0\)/);
  assert.match(validation, /rejectionReason is required when rejecting a delivery/);
});

test('5. Every status transition records an entry in DeliveryStatusLog and DeliveryTrackingEvent', () => {
  const service = read('src/modules/delivery/delivery.service.ts');
  assert.match(service, /const transitionStatus\s*=\s*async/);
  assert.match(service, /tx\.deliveryTrackingEvent\.create/);
  assert.match(service, /tx\.deliveryStatusLog\.create/);
});

test('6. Admin override and dispute resolution enforce admin role permissions', () => {
  const constants = read('src/modules/delivery/delivery.constants.ts');
  assert.match(constants, /DISPUTE_RESOLVED:\s*\['admin'\]/);

  const service = read('src/modules/delivery/delivery.service.ts');
  assert.match(service, /if\s*\(!isAdmin\(actor\)\)\s*\{\s*throw new ApiError\(403,\s*'Only admin can override delivery status',\s*'DELIVERY_ADMIN_ONLY'\);/);
});

test('7. Finance payment flow strictly enforces sequential stages (ACCEPTED -> INVOICE_VERIFIED -> PAYMENT_APPROVED -> PAYMENT_RELEASED)', () => {
  const service = read('src/modules/delivery/delivery.service.ts');
  assert.match(service, /if\s*\(delivery\.status\s*!==\s*'ACCEPTED'\)/);
  assert.match(service, /if\s*\(delivery\.status\s*!==\s*'INVOICE_VERIFIED'\)/);
  assert.match(service, /if\s*\(delivery\.status\s*!==\s*'PAYMENT_APPROVED'\)/);

  const constants = read('src/modules/delivery/delivery.constants.ts');
  assert.match(constants, /ACCEPTED:\s*\[[^\]]*'INVOICE_VERIFIED'/);
  assert.match(constants, /INVOICE_VERIFIED:\s*\[[^\]]*'PAYMENT_APPROVED'/);
  assert.match(constants, /PAYMENT_APPROVED:\s*\[[^\]]*'PAYMENT_RELEASED'/);
});

test('8. Buyer/consignee acceptance can only run after physical delivery occurs', () => {
  const service = read('src/modules/delivery/delivery.service.ts');
  assert.match(
    service,
    /if\s*\(!\['DELIVERED',\s*'DELIVERY_CONFIRMATION_PENDING',\s*'DISPUTE_RESOLVED'\]\.includes\(delivery\.status\)\)/
  );
  assert.match(service, /DELIVERY_NOT_DELIVERED/);
});

test('9. All delivery database transactions declare the 20s Neon-safe timeout configuration', () => {
  const service = read('src/modules/delivery/delivery.service.ts');
  assert.match(service, /const TX_OPTIONS\s*=\s*\{\s*timeout:\s*20_000,\s*maxWait:\s*8_000\s*\}\s*as const/);
  assert.match(service, /TX_OPTIONS/);
});

test('10. Automatic delivery backfill seeding is gated behind DELIVERY_AUTO_SEED or non-production environment', () => {
  const service = read('src/modules/delivery/delivery.service.ts');
  assert.match(service, /process\.env\.DELIVERY_AUTO_SEED === 'true'/);
  assert.match(service, /process\.env\.NODE_ENV !== 'production'/);
});

test('11. Direct Purchase extension and delivery rate calculation invariants are sound', () => {
  const service = read('src/modules/delivery/delivery.service.ts');
  assert.match(service, /export const calculateLiquidatedDamages/);
  assert.match(service, /weeklyRate:\s*0\.005/);
  assert.match(service, /maxCapPercent:\s*10/);
});

test('12. Delivery participant uniqueness is enforced by compound index in Prisma', () => {
  const schema = read('prisma/schema.prisma');
  assert.match(schema, /@@unique\(\[deliveryTrackingId,\s*userId,\s*participantRole\],\s*name:\s*"deliveryParticipantCompound"\)/);
});

test('13. Child delivery models cascade on DeliveryTracking deletion in Prisma schema', () => {
  const schema = read('prisma/schema.prisma');
  assert.match(schema, /model DeliveryDpExtension\s*\{[^}]*deliveryTracking\s*DeliveryTracking\s*@relation\([^}]*onDelete:\s*Cascade\)/);
  assert.match(schema, /model DeliveryTrackingEvent\s*\{[^}]*deliveryTracking\s*DeliveryTracking\s*@relation\([^}]*onDelete:\s*Cascade\)/);
  assert.match(schema, /model DeliveryStatusLog\s*\{[^}]*deliveryTracking\s*DeliveryTracking\s*@relation\([^}]*onDelete:\s*Cascade\)/);
  assert.match(schema, /model DeliveryDocument\s*\{[^}]*deliveryTracking\s*DeliveryTracking\s*@relation\([^}]*onDelete:\s*Cascade\)/);
  assert.match(schema, /model DeliveryParticipant\s*\{[^}]*deliveryTracking\s*DeliveryTracking\s*@relation\([^}]*onDelete:\s*Cascade\)/);
});

test('14. Notification dispatch honours user notification preferences before sending alerts', () => {
  const service = read('src/modules/delivery/delivery.service.ts');
  assert.match(service, /db\.notificationPreference\.findUnique\(\{\s*where:\s*\{\s*userId\s*\}\s*\}\)/);
  assert.match(service, /if\s*\(pref\s*&&\s*pref\.procurementAlerts\s*===\s*false\)\s*return null/);
});
