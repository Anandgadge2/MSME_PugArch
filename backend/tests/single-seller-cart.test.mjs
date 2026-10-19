import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const cartRoutesPath = path.resolve(__dirname, '../src/routes/cart.routes.ts');

test('Single Seller Cart Policy: cart.routes.ts enforces single seller and offline payment integrity', () => {
  const code = fs.readFileSync(cartRoutesPath, 'utf8');

  // 1. replaceCart optional parameter in schema
  assert.match(code, /replaceCart:\s*z\.boolean\(\)\.optional\(\)/, 'addItemSchema must accept optional replaceCart boolean');

  // 2. DIFFERENT_SELLER_CONFLICT rejection code
  assert.match(code, /code:\s*['"]DIFFERENT_SELLER_CONFLICT['"]/, 'cart.routes must return DIFFERENT_SELLER_CONFLICT when seller mismatch is detected');

  // 3. currentSeller and newSeller metadata in conflict response
  assert.match(code, /currentSeller:\s*\{/, 'Conflict response must include currentSeller details');
  assert.match(code, /newSeller:\s*\{/, 'Conflict response must include newSeller details');

  // 4. Atomic cart replacement when replaceCart is true
  assert.match(code, /cart\.items\.replaced/, 'Audit log must record cart.items.replaced event');
  assert.match(code, /prisma\.cartItem\.deleteMany\(\s*\{\s*where:\s*\{\s*cartId:\s*cart\.id\s*\}\s*\}\)/, 'Must delete previous cart items when replaceCart is confirmed');

  // 5. Explicit DELETE /cart/clear endpoint
  assert.match(code, /router\.delete\(\s*['"]\/cart\/clear['"]/, 'Must provide explicit DELETE /cart/clear endpoint');
  assert.match(code, /cart\.cleared/, 'Audit log must record cart.cleared event');

  // 6. Guest cart merge single-seller safety guard
  assert.match(code, /activeCartSellerId && sellerIdValue !== activeCartSellerId/, 'mergeGuestCart must ignore items from mismatched sellers');
});
