import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const readBackend = relativePath => readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
const readFrontend = relativePath => readFileSync(new URL(`../../frontend/${relativePath}`, import.meta.url), 'utf8');

test('1. canAccessFileAsset allows image branding assets across counterparties', () => {
  const storageService = readBackend('src/services/storage/storage.service.ts');
  
  // Whitelist contains stamp, signature, and invoice-branding
  assert.match(storageService, /'stamp',\s*'signature',\s*'invoice-branding'/);
  
  // Image mimeType check covers onboarding, registration, procurement_draft
  assert.match(storageService, /asset\.mimeType\.startsWith\('image\/'\)\s*&&\s*\['general',\s*'onboarding',\s*'registration',\s*'procurement_draft'/);
});

test('2. canAccessFileAsset validates offlinePaymentProof access for PO and invoice counterparties', () => {
  const storageService = readBackend('src/services/storage/storage.service.ts');
  
  assert.match(storageService, /offlinePaymentProof\.findFirst/);
  assert.match(storageService, /receiptFileId:\s*asset\.id/);
  assert.match(storageService, /receiptFileUrl:\s*\{\s*contains:\s*`\/files\/\$\{asset\.id\}\/`\s*\}/);
  assert.match(storageService, /po\s*&&\s*\(po\.buyerId === user\.id \|\| po\.sellerId === user\.id\)/);
  assert.match(storageService, /offlineProof\.uploadedByUserId === user\.id/);
});

test('3. getPublicFileActor resolves public actor for offlinePaymentProof and branding images', () => {
  const phase4Routes = readBackend('src/routes/phase4.routes.ts');
  
  assert.match(phase4Routes, /offlinePaymentProof\.findFirst/);
  assert.match(phase4Routes, /brandingAsset\s*=\s*await\s+db\.fileAsset\.findFirst/);
  assert.match(phase4Routes, /entityType:\s*\{\s*in:\s*\['general',\s*'onboarding',\s*'registration',\s*'procurement_draft'/);
});

test('4. Payment routes associate uploaded FileAsset with offlinePaymentProof entity', () => {
  const paymentRoutes = readBackend('src/modules/payments/payment.routes.ts');
  
  assert.match(paymentRoutes, /effectiveFileId/);
  assert.match(paymentRoutes, /entityType:\s*'offline_payment_proof',\s*entityId:\s*proof\.id/);
});

test('5. Frontend files.ts routes private storage URLs through resolveMediaUrl proxy with auth headers', () => {
  const filesTs = readFrontend('src/lib/files.ts');
  
  assert.match(filesTs, /import\s*\{[^}]*resolveMediaUrl[^}]*\}\s*from\s*'\.\/api'/);
  assert.match(filesTs, /const\s+resolved\s*=\s*resolveMediaUrl\(endpoint\)\s*\|\|\s*endpoint/);
  assert.match(filesTs, /authHeaders\['Authorization'\]\s*=\s*`Bearer \$\{token\}`/);
});

test('6. Frontend PaymentReceiptViewModal uses openFileAsset instead of unauthenticated raw anchor', () => {
  const modalTsx = readFrontend('src/features/payments/components/PaymentReceiptViewModal.tsx');
  
  assert.match(modalTsx, /import\s*\{[^}]*openFileAsset[^}]*\}\s*from\s*'\.\.\/\.\.\/\.\.\/lib\/files'/);
  assert.match(modalTsx, /openFileAsset\(\s*\{\s*id:\s*proof\.receiptFileId,\s*fileUrl:\s*proof\.receiptFileUrl/);
  // Ensure unauthenticated plain anchor tag is not used for opening the proof
  assert.doesNotMatch(modalTsx, /<a\s+href=\{proof\.receiptFileUrl\}/);
});

test('7. Frontend pdfEngine injects auth token into fetch and canvas fallback for authenticated file loads', () => {
  const pdfEngine = readFrontend('src/lib/pdfEngine.ts');
  
  assert.match(pdfEngine, /token\s*=\s*typeof window !== 'undefined' \? localStorage\.getItem\('token'\) : null/);
  assert.match(pdfEngine, /Authorization.*Bearer/);
  assert.match(pdfEngine, /credentials:\s*'include'/);
});

test('8. PurchaseOrders.tsx and PurchaseOrderReceiptModal provide branding fallbacks and modal view', () => {
  const poView = readFrontend('src/views/PurchaseOrders.tsx');
  const receiptModal = readFrontend('src/features/purchaseOrders/components/PurchaseOrderReceiptModal.tsx');
  
  assert.match(poView, /PurchaseOrderReceiptModal/);
  assert.match(poView, /effectiveSellerSignature/);
  assert.match(poView, /effectiveSellerStamp/);
  assert.match(poView, /effectiveBuyerSignature/);
  assert.match(poView, /effectiveBuyerStamp/);
  assert.match(poView, /View Official PO/);
  
  assert.match(receiptModal, /effectiveSellerSignature/);
  assert.match(receiptModal, /effectiveSellerStamp/);
  assert.match(receiptModal, /effectiveBuyerSignature/);
  assert.match(receiptModal, /effectiveBuyerStamp/);
});
