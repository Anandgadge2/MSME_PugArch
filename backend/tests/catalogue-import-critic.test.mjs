import assert from 'node:assert/strict';
import test from 'node:test';
import * as XLSX from 'xlsx';
import { catalogueImportService } from '../dist/src/services/workflow/catalogue-import.service.js';
import { db } from '../dist/src/services/workflow/workflow-common.js';
import { ApiError } from '../dist/src/utils/ApiError.js';

test('1. Product Template Generation & Structure Critic Test', async () => {
  const buffer = await catalogueImportService.generateProductTemplate();
  assert.ok(buffer && buffer.length > 0, 'Buffer must not be empty');

  const wb = XLSX.read(buffer, { type: 'buffer' });
  const sheetNames = wb.SheetNames;

  assert.ok(sheetNames.includes('Products'), 'Must include "Products" sheet');
  assert.ok(sheetNames.includes('Product Specifications'), 'Must include "Product Specifications" sheet');
  assert.ok(sheetNames.includes('Instructions'), 'Must include "Instructions" sheet');
  assert.ok(sheetNames.includes('Dropdown Values'), 'Must include "Dropdown Values" sheet');

  // Verify Products sheet headers
  const productsSheet = wb.Sheets['Products'];
  const productsData = XLSX.utils.sheet_to_json(productsSheet, { header: 1, defval: '' });
  assert.ok(productsData.length >= 2, 'Products sheet must have at least headers and 1 sample row');
  
  const headers = productsData[0];
  const mandatoryHeaders = ['Product Name *', 'Category *', 'Price *', 'Unit Of Measure *'];
  for (const h of mandatoryHeaders) {
    assert.ok(headers.includes(h), `Products header missing mandatory column: ${h}`);
  }

  // Verify Specs sheet headers
  const specsSheet = wb.Sheets['Product Specifications'];
  const specsData = XLSX.utils.sheet_to_json(specsSheet, { header: 1, defval: '' });
  assert.ok(specsData.length >= 2, 'Product Specifications sheet must have headers and sample rows');
  const specHeaders = specsData[0];
  assert.ok(specHeaders.includes('Specification Name *'), 'Specs must have Specification Name *');
  assert.ok(specHeaders.includes('Specification Value *'), 'Specs must have Specification Value *');

  // Verify Dropdown Values sheet
  const dropdownSheet = wb.Sheets['Dropdown Values'];
  const dropdownData = XLSX.utils.sheet_to_json(dropdownSheet, { header: 1, defval: '' });
  assert.ok(dropdownData.length > 1, 'Dropdown sheet must contain valid reference values');
});

test('2. Service Template Generation & Structure Critic Test', async () => {
  const buffer = await catalogueImportService.generateServiceTemplate();
  assert.ok(buffer && buffer.length > 0, 'Buffer must not be empty');

  const wb = XLSX.read(buffer, { type: 'buffer' });
  const sheetNames = wb.SheetNames;

  assert.ok(sheetNames.includes('Services'), 'Must include "Services" sheet');
  assert.ok(sheetNames.includes('Service Specifications'), 'Must include "Service Specifications" sheet');
  assert.ok(sheetNames.includes('Instructions'), 'Must include "Instructions" sheet');
  assert.ok(sheetNames.includes('Dropdown Values'), 'Must include "Dropdown Values" sheet');

  // Verify Services sheet headers
  const servicesSheet = wb.Sheets['Services'];
  const servicesData = XLSX.utils.sheet_to_json(servicesSheet, { header: 1, defval: '' });
  assert.ok(servicesData.length >= 2, 'Services sheet must have at least headers and 1 sample row');
  
  const headers = servicesData[0];
  const mandatoryHeaders = ['Service Name *', 'Category *', 'Pricing Model *', 'Base Price *', 'Service Area *'];
  for (const h of mandatoryHeaders) {
    assert.ok(headers.includes(h), `Services header missing mandatory column: ${h}`);
  }

  // Verify Service Specs sheet headers
  const specsSheet = wb.Sheets['Service Specifications'];
  const specsData = XLSX.utils.sheet_to_json(specsSheet, { header: 1, defval: '' });
  assert.ok(specsData.length >= 2, 'Service Specifications sheet must have headers and sample rows');
  const specHeaders = specsData[0];
  assert.ok(specHeaders.includes('Specification Name *'), 'Specs must have Specification Name *');
  assert.ok(specHeaders.includes('Specification Value *'), 'Specs must have Specification Value *');
});

test('3. Test Parsing & Validating The Generated Product & Service Templates', async () => {
  let seller = await db.user.findFirst({
    where: { role: 'seller', onboardingStatus: 'approved_for_procurement' },
    select: { id: true, role: true }
  });
  if (!seller) {
    seller = await db.user.findFirst({
      where: { role: 'seller' },
      select: { id: true, role: true }
    });
  }
  
  const actor = {
    id: seller?.id || 1,
    role: 'seller',
    ipAddress: '127.0.0.1'
  };

  // Test Product Template Preview
  const productBuffer = await catalogueImportService.generateProductTemplate();
  const productFile = {
    buffer: productBuffer,
    originalname: 'catalogue_products_template.xlsx',
    mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    size: productBuffer.length,
    fieldname: 'file',
    encoding: '7bit',
    destination: '',
    filename: '',
    path: '',
    stream: null
  };

  const productPreview = await catalogueImportService.previewImport(actor, productFile, 'PRODUCT');
  assert.equal(productPreview.totalRows, 2, 'Template has 2 sample product rows');
  assert.equal(productPreview.validRows, 2, 'Both sample products should be valid');
  assert.equal(productPreview.invalidRows, 0, 'No invalid rows in official template');
  assert.ok(productPreview.preview[0].specifications.length > 0, 'Row 1 specifications should be linked');

  // Test Service Template Preview
  const serviceBuffer = await catalogueImportService.generateServiceTemplate();
  const serviceFile = {
    buffer: serviceBuffer,
    originalname: 'catalogue_services_template.xlsx',
    mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    size: serviceBuffer.length,
    fieldname: 'file',
    encoding: '7bit',
    destination: '',
    filename: '',
    path: '',
    stream: null
  };

  const servicePreview = await catalogueImportService.previewImport(actor, serviceFile, 'SERVICE');
  assert.equal(servicePreview.totalRows, 1, 'Template has 1 sample service row');
  assert.equal(servicePreview.validRows, 1, 'Sample service should be valid');
  assert.equal(servicePreview.invalidRows, 0, 'No invalid rows in official service template');
  assert.ok(servicePreview.preview[0].specifications.length > 0, 'Service specifications should be linked');
});

test('4. Critic Test: Validation of Corrupted or Non-Excel Files', async () => {
  const actor = { id: 1, role: 'seller', ipAddress: '127.0.0.1' };
  
  // Non-xlsx extension
  await assert.rejects(async () => {
    await catalogueImportService.previewImport(actor, {
      buffer: Buffer.from('dummy'),
      originalname: 'test.csv',
      size: 5
    }, 'PRODUCT');
  }, (err) => err.statusCode === 400 && (err.code === 'INVALID_FILE_TYPE' || err.message.includes('.xlsx')));

  // Corrupted zip/xlsx file
  await assert.rejects(async () => {
    await catalogueImportService.previewImport(actor, {
      buffer: Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00]),
      originalname: 'corrupt.xlsx',
      size: 6
    }, 'PRODUCT');
  }, (err) => err.statusCode === 400 && (err.code === 'INVALID_EXCEL_FILE' || err.message.includes('Invalid or corrupted')));
});

test('5. Critic Test: Handling of Row Validation Failures & Error Report Export', async () => {
  const actor = { id: 1, role: 'seller', ipAddress: '127.0.0.1' };
  const wb = XLSX.utils.book_new();
  const rows = [
    ['Product Name *', 'Category *', 'Price *', 'Unit Of Measure *'],
    ['', 'NonExistentCategory', '-100', ''], // 4 distinct errors
    ['Valid Product Row', 'Safety Equipment & Industrial Safety', '250', 'Nos'] // 1 valid row
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Products');
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  const preview = await catalogueImportService.previewImport(actor, {
    buffer,
    originalname: 'test_errors.xlsx',
    size: buffer.length
  }, 'PRODUCT');

  assert.equal(preview.totalRows, 2);
  assert.equal(preview.validRows, 1);
  assert.ok(preview.invalidRows >= 1);
  assert.ok(preview.rowErrors.length >= 3);

  // Test exportErrorReport
  const errorReportBuf = await catalogueImportService.exportErrorReport(actor, preview.batchId);
  assert.ok(errorReportBuf && errorReportBuf.length > 0, 'Error report buffer should be valid');

  const errorWb = XLSX.read(errorReportBuf, { type: 'buffer' });
  assert.ok(errorWb.SheetNames.includes('Errors'), 'Error report must contain "Errors" sheet');
  const errorSheetData = XLSX.utils.sheet_to_json(errorWb.Sheets['Errors']);
  assert.ok(errorSheetData.length >= 3, 'Error report should detail each issue');
});
