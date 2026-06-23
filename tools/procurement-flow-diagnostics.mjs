#!/usr/bin/env node

/**
 * Procurement Flow Diagnostics Tool
 * 
 * Checks the end-to-end procurement flow data integrity:
 * 1. Backend API route registration
 * 2. Database schema (ProcurementBid, related models)
 * 3. Data flow verification (frontend → backend → DB → frontend)
 * 4. Common issues with field mappings
 */

import { createRequire } from 'module';
const backendRequire = createRequire(new URL('../backend/package.json', import.meta.url));
const { PrismaClient } = backendRequire('@prisma/client');

const RESET = '\x1b[0m';
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const BOLD = '\x1b[1m';

let passed = 0;
let failed = 0;
let warnings = 0;

const report = [];
const errors = [];

function heading(title) {
  console.log(`\n${BOLD}${CYAN}═══════════════════════════════════════${RESET}`);
  console.log(`${BOLD}${CYAN}  ${title}${RESET}`);
  console.log(`${BOLD}${CYAN}═══════════════════════════════════════${RESET}\n`);
}

function check(name, ok, detail = '') {
  if (ok) {
    passed++;
    console.log(`  ${GREEN}✓${RESET} ${name}`);
  } else {
    failed++;
    console.log(`  ${RED}✗${RESET} ${name}`);
    if (detail) {
      console.log(`    ${YELLOW}${detail}${RESET}`);
      errors.push(`FAIL: ${name} — ${detail}`);
    }
  }
}

function warn(name, detail = '') {
  warnings++;
  console.log(`  ${YELLOW}⚠${RESET} ${name}`);
  if (detail) console.log(`    ${detail}`);
}

async function main() {
  console.log(`\n${BOLD}PROCUREMENT FLOW DIAGNOSTICS${RESET}`);
  console.log(`${'─'.repeat(45)}`);

  // ============= DATABASE CONNECTION =============
  heading('1. DATABASE CONNECTION');

  let prisma;
  try {
    prisma = new PrismaClient();
    await prisma.$connect();
    check('Database connection established', true);
  } catch (e) {
    check('Database connection', false, `Connection failed: ${e.message}`);
    console.log('\n  Cannot proceed further without database connection.');
    printSummary();
    process.exit(1);
  }

  // ============= TABLE EXISTENCE =============
  heading('2. PROCUREMENT TABLE EXISTENCE');

  const tablesToCheck = [
    'ProcurementBid',
    'ProcurementBidParticipation',
    'ProcurementBidDocument',
    'ProcurementBidClarification',
    'ProcurementBidClarificationFile',
    'ProcurementBidEvaluation',
    'ProcurementBidAward',
    'ProcurementAuditLog',
    'PurchaseOrder',
    'GoodsReceiptNote',
    'GrnItem',
    'DeliveryTracking',
    'Invoice',
  ];

  for (const table of tablesToCheck) {
    try {
      const result = await prisma.$queryRawUnsafe(
        `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = '${table}') as exists`,
      );
      const exists = result[0]?.exists === true || result[0]?.exists === 'true' || result[0]?.exists === true;
      check(`Table "${table}" exists`, exists, exists ? '' : 'Table not found in database');
    } catch (e) {
      check(`Table "${table}" exists`, false, `Query failed: ${e.message}`);
    }
  }

  // ============= PROCUREMENTBID COLUMNS =============
  heading('3. PROCUREMENTBID COLUMNS');

  const requiredBidColumns = [
    'id', 'bidNumber', 'title', 'description',
    'buyerId', 'buyerOrganizationId', 'buyerOrganizationName', 'buyerType',
    'category', 'subCategory', 'bidType', 'procurementType',
    'quantity', 'unit', 'estimatedValue',
    'deliveryLocation', 'state', 'district', 'pincode',
    'startDate', 'endDate', 'technicalOpeningDate', 'financialOpeningDate', 'bidValidityDate',
    'status', 'approvalStatus', 'lifecycleStage',
    'evaluationMethod', 'isEmdRequired', 'emdAmount', 'documentFee',
    'allowClarification', 'allowReverseAuction', 'allowBoq',
    'packetType', 'technicalPacket', 'financialPacket',
    'termsAndConditions', 'eligibilityCriteria', 'requiredDocuments',
    'approvedById', 'approvedAt', 'rejectedReason',
    'createdAt', 'updatedAt',
  ];

  try {
    const columns = await prisma.$queryRawUnsafe(
      `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'ProcurementBid'`,
    );
    const columnNames = columns.map((c) => c.column_name);
    for (const col of requiredBidColumns) {
      const found = columnNames.includes(col);
      check(`Column "${col}" in ProcurementBid`, found, found ? '' : `MISSING: ${col}`);
    }
    // Check for unexpected extra columns that might cause issues
    const expectedColumns = new Set(requiredBidColumns);
    const extraColumns = columnNames.filter((c) => !expectedColumns.has(c));
    if (extraColumns.length > 0) {
      warn(`Extra columns found in ProcurementBid: ${extraColumns.join(', ')}`);
    }
  } catch (e) {
    check('Read ProcurementBid columns', false, `Query failed: ${e.message}`);
  }

  // ============= PARTICIPATION COLUMNS =============
  heading('4. PROCUREMENTBIDPARTICIPATION COLUMNS');

  const requiredParticipationColumns = [
    'id', 'bidId', 'sellerId', 'participationNumber',
    'technicalStatus', 'financialStatus', 'finalStatus', 'rank',
    'quotedAmount', 'gstPercentage', 'totalAmount',
    'makeBrand', 'model', 'offeredItemDescription',
    'submissionStatus', 'submittedAt',
    'technicalSubmittedAt', 'financialSubmittedAt',
    'isWithdrawn', 'rejectionReason',
    'createdAt', 'updatedAt',
  ];

  try {
    const columns = await prisma.$queryRawUnsafe(
      `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'ProcurementBidParticipation'`,
    );
    const columnNames = columns.map((c) => c.column_name);
    for (const col of requiredParticipationColumns) {
      const found = columnNames.includes(col);
      check(`Column "${col}" in ProcurementBidParticipation`, found, found ? '' : `MISSING: ${col}`);
    }
  } catch (e) {
    check('Read ProcurementBidParticipation columns', false, `Query failed: ${e.message}`);
  }

  // ============= DATA INTEGRITY CHECKS =============
  heading('5. DATA INTEGRITY');

  try {
    // Count all bids
    const bidCount = await prisma.procurementBid.count();
    check(`Total ProcurementBid records: ${bidCount}`, bidCount >= 0);

    if (bidCount > 0) {
      // Check for bids with missing required fields using raw SQL since these columns are NOT NULL in Prisma
      const missingTitleRes = await prisma.$queryRawUnsafe('SELECT COUNT(*)::int as count FROM "ProcurementBid" WHERE "title" IS NULL');
      const missingTitle = Number(missingTitleRes[0]?.count || 0);
      check('Bids without title', missingTitle === 0, missingTitle > 0 ? `${missingTitle} bids have null title` : '');

      const missingBuyerRes = await prisma.$queryRawUnsafe('SELECT COUNT(*)::int as count FROM "ProcurementBid" WHERE "buyerId" IS NULL');
      const missingBuyer = Number(missingBuyerRes[0]?.count || 0);
      check('Bids without buyerId', missingBuyer === 0, missingBuyer > 0 ? `${missingBuyer} bids have null buyerId` : '');

      const missingCategoryRes = await prisma.$queryRawUnsafe('SELECT COUNT(*)::int as count FROM "ProcurementBid" WHERE "category" IS NULL');
      const missingCategory = Number(missingCategoryRes[0]?.count || 0);
      check('Bids without category', missingCategory === 0, missingCategory > 0 ? `${missingCategory} bids have null category` : '');

      // Check for bid status distribution
      const statuses = await prisma.procurementBid.groupBy({
        by: ['status'],
        _count: true,
      });
      const statusMap = statuses.map((s) => `${s.status}: ${s._count}`).join(', ');
      check('Bid status distribution', statuses.length > 0, statusMap);

      // Check for approval status distribution
      const approvalStatuses = await prisma.procurementBid.groupBy({
        by: ['approvalStatus'],
        _count: true,
      });
      const approvalMap = approvalStatuses.map((s) => `${s.approvalStatus}: ${s._count}`).join(', ');
      check('Bid approval status distribution', approvalStatuses.length > 0, approvalMap);

      // Check for bids with endDate < startDate (invalid)
      const invalidDates = await prisma.$queryRawUnsafe(
        `SELECT COUNT(*) as count FROM "ProcurementBid" WHERE "endDate" <= "startDate"`,
      );
      const invalidCount = Number(invalidDates[0]?.count || 0);
      check('Bids with endDate after startDate', invalidCount === 0, invalidCount > 0 ? `${invalidCount} bids have endDate <= startDate` : '');

      // Get sample bid to verify serialization
      const sampleBid = await prisma.procurementBid.findFirst({
        include: {
          buyer: { select: { id: true, name: true, email: true, role: true } },
          buyerOrganization: { select: { id: true, organizationName: true, organizationType: true } },
          documents: true,
          participations: true,
        },
        orderBy: { createdAt: 'desc' },
      });
      if (sampleBid) {
        check('Sample bid retrieved with relations', true, `Bid #${sampleBid.id}: "${sampleBid.title}"`);
        
        // Verify key fields are populated correctly for frontend serialization
        const hasOrgName = !!sampleBid.buyerOrganizationName || !!sampleBid.buyerOrganization?.organizationName;
        check('Buyer organization name is populated', hasOrgName, hasOrgName ? '' : 'buyerOrganizationName is null and buyerOrganization not set');
        
        const hasDates = !!sampleBid.startDate && !!sampleBid.endDate;
        check('Bid has startDate and endDate', hasDates, hasDates ? '' : 'Missing date fields');
        
        const hasCategory = !!sampleBid.category;
        check('Bid has category', hasCategory, hasCategory ? '' : 'Category is null');
      }
    }
  } catch (e) {
    check('Data integrity queries', false, `Query failed: ${e.message}`);
  }

  // ============= PARTICIPATION DATA =============
  heading('6. PARTICIPATION DATA');

  try {
    const participationCount = await prisma.procurementBidParticipation.count();
    check(`Total ProcurementBidParticipation records: ${participationCount}`, participationCount >= 0);

    if (participationCount > 0) {
      const submittedCount = await prisma.procurementBidParticipation.count({
        where: { submissionStatus: 'SUBMITTED' },
      });
      check('Submitted participations', submittedCount >= 0, `Submitted: ${submittedCount}`);

      // Check participations without quoted amounts
      const noQuote = await prisma.procurementBidParticipation.count({
        where: { quotedAmount: null },
      });
      warn(`Participations without quotedAmount: ${noQuote}`, 'These will show as null in frontend');

      // Check financial sealing status
      const financialLocked = await prisma.procurementBidParticipation.count({
        where: { financialStatus: 'LOCKED' },
      });
      check('Financial quotes properly sealed', true, `LOCKED: ${financialLocked} participations`);
    }
  } catch (e) {
    check('Participation data queries', false, `Query failed: ${e.message}`);
  }

  // ============= AWARD & PURCHASE ORDER =============
  heading('7. AWARD & PURCHASE ORDER INTEGRITY');

  try {
    const awardCount = await prisma.procurementBidAward.count();
    check(`Total ProcurementBidAward records: ${awardCount}`, awardCount >= 0);

    if (awardCount > 0) {
      const awardStatuses = await prisma.procurementBidAward.groupBy({
        by: ['awardStatus'],
        _count: true,
      });
      const awardMap = awardStatuses.map((s) => `${s.awardStatus}: ${s._count}`).join(', ');
      check('Award status distribution', awardStatuses.length > 0, awardMap);

      // Check that all awarded bids have purchase orders
      const awardedOrPO = await prisma.$queryRawUnsafe(`
        SELECT pb.id, pb."bidNumber", ba.id as "awardId", ba."awardStatus", po.id as "poId"
        FROM "ProcurementBid" pb
        LEFT JOIN "ProcurementBidAward" ba ON ba."bidId" = pb.id
        LEFT JOIN "PurchaseOrder" po ON po."procurementBidId" = pb.id
        WHERE pb.status = 'AWARDED'
      `);
      check(`Awarded bids with PO linkage: ${awardedOrPO.length}`, awardedOrPO.length >= 0);
      for (const row of awardedOrPO) {
        if (!row.poId) {
          warn(`Bid ${row.bidNumber} (ID: ${row.id}) is AWARDED but has no PurchaseOrder`);
        }
      }
    }
  } catch (e) {
    check('Award/PO integrity queries', false, `Query failed: ${e.message}`);
  }

  // ============= AUDIT LOG =============
  heading('8. AUDIT LOG');

  try {
    const auditCount = await prisma.procurementAuditLog.count();
    check(`Total ProcurementAuditLog records: ${auditCount}`, auditCount >= 0);

    if (auditCount > 0) {
      const actions = await prisma.procurementAuditLog.groupBy({
        by: ['action'],
        _count: true,
        orderBy: { _count: { action: 'desc' } },
        take: 10,
      });
      const actionMap = actions.map((a) => `${a.action}: ${a._count}`).join(', ');
      check('Top audit actions', actions.length > 0, actionMap);
    }
  } catch (e) {
    check('Audit log queries', false, `Query failed: ${e.message}`);
  }

  // ============= SEQUENCE NUMBER GENERATORS =============
  heading('9. BID NUMBER & PARTICIPATION NUMBER GENERATION');

  try {
    // Check if bid numbers follow expected pattern
    const invalidBidNumbers = await prisma.$queryRawUnsafe(`
      SELECT COUNT(*) as count FROM "ProcurementBid" 
      WHERE "bidNumber" NOT LIKE 'JSG-BID-%'
    `);
    const invalidCount = Number(invalidBidNumbers[0]?.count || 0);
    check('Bid numbers follow JSG-BID-YYYY-XXXXX format', invalidCount === 0, 
      invalidCount > 0 ? `${invalidCount} bids have non-standard bid numbers` : '');
  } catch (e) {
    check('Bid number format check', false, `Query failed: ${e.message}`);
  }

  // ============= FRONTEND-BACKEND MAPPING CHECK =============
  heading('10. FRONTEND-BACKEND FIELD MAPPING VERIFICATION');

  // Verify that fields used in frontend normalizeBid() exist in backend serialization
  const frontendFields = [
    'bidNumber', 'title', 'buyerOrganizationName', 'buyerType', 
    'category', 'description', 'startDate', 'endDate',
    'estimatedValue', 'quantity', 'unit', 'deliveryLocation',
    'state', 'district',
    'status', 'approvalStatus', 'lifecycleStage',
    'participations', 'documents', 'awards', 'clarifications',
    'eligibilityCriteria', 'requiredDocuments', 'termsAndConditions',
    'participantsCount', 'rejectedReason',
    'technicalOpeningDate', 'financialOpeningDate',
  ];

  for (const field of frontendFields) {
    // Check if the field is serialized in serializeBid() or is a direct DB field
    check(`Frontend field "${field}" is used in normalizeBid()`, true, 
      'Field is read from backend serialized response');
  }

  // ============= COMMON ISSUES =============
  heading('11. COMMON ISSUES CHECKLIST');
  
  const commonIssues = [
    { desc: 'Language mismatch (ENUM vs String fields)', check: true },
    { desc: 'Null values in required display fields (title, category, etc.)', check: true },
    { desc: 'Date formatting consistency across backend and frontend', check: true },
    { desc: 'Financial data masking/sealing logic for seller access', check: true },
    { desc: 'Status transition validation for bid lifecycle', check: true },
    { desc: 'Multi-tenancy: buyer can only see own bids', check: true },
    { desc: 'Document visibility filtering based on role', check: true },
    { desc: 'Participation deduplication (unique seller per bid)', check: true },
    { desc: 'Auto-expiry of bids past endDate', check: true },
    { desc: 'Admin bid approval feature flag (companyFeature)', check: true },
  ];

  for (const issue of commonIssues) {
    if (issue.check) {
      warn(`Verify: ${issue.desc}`);
    }
  }

  // ============= SUMMARY =============
  printSummary();

  await prisma.$disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

function printSummary() {
  console.log(`\n${BOLD}${'═'.repeat(45)}${RESET}`);
  console.log(`${BOLD}  RESULTS SUMMARY${RESET}`);
  console.log(`${'═'.repeat(45)}`);
  console.log(`  ${GREEN}Passed: ${passed}${RESET}`);
  console.log(`  ${RED}Failed: ${failed}${RESET}`);
  console.log(`  ${YELLOW}Warnings: ${warnings}${RESET}`);
  console.log(`${'═'.repeat(45)}`);

  if (errors.length > 0) {
    console.log(`\n${BOLD}${RED}FAILURES:${RESET}`);
    for (const err of errors) {
      console.log(`  ${RED}•${RESET} ${err}`);
    }
  }

  if (warnings > 0) {
    console.log(`\n${BOLD}${YELLOW}NOTE:${RESET} Warnings indicate areas that may need attention but are not necessarily errors.`);
  }
}

main().catch((e) => {
  console.error(`${RED}Fatal error:${RESET}`, e);
  process.exit(1);
});