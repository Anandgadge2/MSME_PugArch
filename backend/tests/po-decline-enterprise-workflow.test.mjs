import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (relativePath) => readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');

test('1. po-decline.constants defines standard reasons and classification', () => {
  const constants = read('src/modules/procurementBid/po-decline.constants.ts');

  assert.match(constants, /BUYER_TERMS_DISCREPANCY/);
  assert.match(constants, /FORCE_MAJEURE/);
  assert.match(constants, /CAPACITY_CONSTRAINTS/);
  assert.match(constants, /RAW_MATERIAL_SHORTAGE/);
  assert.match(constants, /isExcused:\s*true/);
  assert.match(constants, /isExcused:\s*false/);
});

test('2. Backend routes validate structured reasonCode, evidenceFileId, and category', () => {
  const routes = read('src/modules/procurementBid/procurement-bid.routes.ts');

  assert.match(routes, /reasonCode:\s*z\.string\(\)/);
  assert.match(routes, /evidenceFileId:\s*z\.union/);
  assert.match(routes, /category:\s*z\.enum\(\['EXCUSED',\s*'UNEXCUSED'\]\)/);
});

test('3. Backend rejectPO handles PBG auto-release under GFR 171', () => {
  const service = read('src/modules/procurementBid/procurement-order.service.ts');

  assert.match(service, /existingPbg/);
  assert.match(service, /tx\.performanceGuarantee\.update/);
  assert.match(service, /status:\s*['"]RELEASED_COMPLETED['"]/);
  assert.match(service, /GFR 171/);
});

test('4. Backend rejectPO logs Incident in Dispute module and tracks Vendor Discipline strikes', () => {
  const service = read('src/modules/procurementBid/procurement-order.service.ts');

  assert.match(service, /tx\.dispute\.create/);
  assert.match(service, /category:\s*['"]PO_DECLINED['"]/);
  assert.match(service, /tx\.supplierRating\.create/);
  assert.match(service, /Vendor Discipline/);
  assert.match(service, /ninetyDaysAgo/);
});

test('5. Frontend SellerAwardPoAlertPopup renders structured reason dropdown and evidence upload', () => {
  const alertPopup = read('../frontend/src/features/notifications/SellerAwardPoAlertPopup.tsx');

  assert.match(alertPopup, /PO_DECLINE_REASONS/);
  assert.match(alertPopup, /declineReasonCode/);
  assert.match(alertPopup, /handleUploadEvidence/);
  assert.match(alertPopup, /Excused Contractual Reason/);
  assert.match(alertPopup, /Commercial Default Notice/);
});

test('6. Frontend ProcurementDetailUnifiedView modal includes structured reasons and evidence support', () => {
  const unifiedView = read('../frontend/src/features/rfq/components/ProcurementDetailUnifiedView.tsx');

  assert.match(unifiedView, /PO_DECLINE_REASONS/);
  assert.match(unifiedView, /handleDeclineEvidenceUpload/);
  assert.match(unifiedView, /declineModal\.reasonCode/);
});

test('7. ProcurementDetailUnifiedView guards Accept PO & Commit Delivery and Decline PO buttons against isPODeclined', () => {
  const unifiedView = read('../frontend/src/features/rfq/components/ProcurementDetailUnifiedView.tsx');

  assert.match(unifiedView, /const isPODeclined = Boolean\(/);
  assert.match(unifiedView, /!isPODeclined/);
  assert.match(unifiedView, /!isAwardDeclined/);
  assert.match(unifiedView, /Purchase Order Declined/);
  assert.match(unifiedView, /poDeclineMetadata/);
});

test('8. SellerAwardPoAlertPopup immediately purges declined PO from local state', () => {
  const alertPopup = read('../frontend/src/features/notifications/SellerAwardPoAlertPopup.tsx');

  assert.match(alertPopup, /setPOs\(\(prev\)\s*=>\s*prev\.filter\(\(p\)\s*=>\s*p\.id !== poId\)\)/);
  assert.match(alertPopup, /setAwards\(\(prev\)\s*=>/);
});

test('9. Backend listPendingAwardsAndPOs excludes cancelled and declined POs from award associations', () => {
  const service = read('src/modules/procurementBid/procurement-order.service.ts');

  assert.match(service, /status:\s*\{\s*notIn:\s*\[['"]cancelled['"],\s*['"]rejected['"],\s*['"]declined['"]\]\s*\}/);
  assert.match(service, /poStatus:\s*\{\s*notIn:\s*\[['"]CANCELLED['"],\s*['"]DECLINED['"],\s*['"]REJECTED['"]\]\s*\}/);
});
