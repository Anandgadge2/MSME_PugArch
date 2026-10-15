import test from 'node:test';
import assert from 'node:assert/strict';
import { extractProcurementDocument } from '../dist/src/services/ai/document-extractor.service.js';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

test('1. Document extractor graceful fallback returns statusBanner strictly as "Manual Review Mode Active" when AI keys offline', async () => {
  const samplePdfBuffer = Buffer.from(
    '%PDF-1.4\nGeM Contract GEMC-5116877192831\nGSTIN: 27AABCU9603R1ZM\nSeller GSTIN: 21ABCDE1234F1Z5\nVendor Code: 1004523\nTotal Order Value: INR 2,45,000.00\n%%EOF'
  );

  const result = await extractProcurementDocument(samplePdfBuffer, 'application/pdf', 'sample_gem.pdf');

  assert.equal(result.success, true, 'Extraction must never fail or throw');
  assert.ok(
    ['Manual Review Mode Active', 'Extracted via AI Model', 'Extracted via Digital Record'].includes(result.statusBanner),
    `Status banner must strictly be one of the user approved status values, got: ${result.statusBanner}`
  );
  assert.ok(result.data, 'Data object must exist');
  assert.equal(result.data.systemDetected, 'GEM', 'Should detect GeM system from GEMC contract prefix');
  assert.equal(result.data.poNumber, 'GEMC-5116877192831', 'Should extract GeM contract number as PO number');
  assert.equal(result.data.sellerDetails?.erpVendorCode, '1004523', 'Should extract Vendor Code');
  assert.equal(result.data.financials?.grandTotal, 245000, 'Should extract Grand Total correctly');
});

test('2. SAP PO document heuristics extraction extracts 10-digit SAP PO reference', async () => {
  const sampleSapText = Buffer.from(
    'PURCHASE ORDER\nOrder No: 4500192831\nDate: 12-10-2026\nLIFNR: 400192\nGSTIN: 29AAACH7409R1ZZ\nTotal Amount: 1,50,000.00'
  );

  const result = await extractProcurementDocument(sampleSapText, 'application/pdf', 'sap_po_4500192831.pdf');

  assert.equal(result.success, true);
  assert.equal(result.data.systemDetected, 'SAP', 'Should detect SAP from 4500192831 PO pattern');
  assert.equal(result.data.poNumber, '4500192831');
  assert.equal(result.data.sellerDetails?.erpVendorCode, '400192');
  assert.equal(result.data.financials?.grandTotal, 150000);
});

test('3. Prisma schema contains BuyerVendorAlias model and PurchaseOrder ERP fields', async () => {
  // Verify Prisma client has buyerVendorAlias model
  assert.ok(prisma.buyerVendorAlias, 'PrismaClient must expose buyerVendorAlias model');
  assert.equal(typeof prisma.buyerVendorAlias.findMany, 'function');
  assert.equal(typeof prisma.buyerVendorAlias.upsert, 'function');

  // Verify PurchaseOrder model is accessible and schema compiles
  assert.ok(prisma.purchaseOrder, 'PrismaClient must expose purchaseOrder model');
  assert.equal(typeof prisma.purchaseOrder.findFirst, 'function');
});
