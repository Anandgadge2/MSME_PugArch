/**
 * Script: cleanup-procurement-records.ts
 *
 * Purpose:
 * Enforces strictly canonical procurement prefixes (RFQ, RFP, TND, LTND, RC, DP, RA),
 * purges records that previously used OT / OPEN_TENDER or legacy prefixes (REQ, BID, PRQ, PR, PB),
 * and removes extra prefixes for direct purchase (keeping DP only).
 *
 * Usage:
 *   Dry-run (safe inspection):
 *     npx tsx src/scripts/cleanup-procurement-records.ts --dry-run
 *
 *   Live execution (applies transaction):
 *     npx tsx src/scripts/cleanup-procurement-records.ts --commit
 */

import prisma from '../lib/prisma.js';
import { CANONICAL_METHOD_PREFIXES } from '../utils/refIdUtils.js';

const isCommit = process.argv.includes('--commit');
const isDryRun = !isCommit;

async function main() {
  console.log('================================================================');
  console.log('   PROCUREMENT PREFIX NORMALIZATION & OT CLEANUP SCRIPT         ');
  console.log(`   Mode: ${isCommit ? '>>> COMMIT (LIVE MODIFICATION) <<<' : '[DRY RUN - NO CHANGES]'}`);
  console.log(`   Canonical Allowed Prefixes: ${CANONICAL_METHOD_PREFIXES.join(', ')}`);
  console.log('================================================================\n');

  const stats = {
    procurementBidsScanned: 0,
    procurementBidsDeleted: 0,
    requirementsScanned: 0,
    requirementsDeleted: 0,
    tendersScanned: 0,
    tendersDeleted: 0,
    directPurchasesScanned: 0,
    directPurchasesDeleted: 0,
  };

  // -------------------------------------------------------------
  // LOOP 1: ProcurementBid
  // -------------------------------------------------------------
  console.log('--- Scanning ProcurementBid Table ---');
  const allBids = await prisma.procurementBid.findMany({
    select: {
      id: true,
      bidNumber: true,
      title: true,
      procurementType: true,
      canonicalMethod: true,
      _count: {
        select: {
          participations: true,
          awards: true,
          clarifications: true,
          documents: true,
          evaluations: true,
          invitations: true,
        }
      }
    }
  });
  stats.procurementBidsScanned = allBids.length;

  const bidsToDelete: typeof allBids = [];
  for (const bid of allBids) {
    const pfx = bid.bidNumber ? bid.bidNumber.split('-')[0].toUpperCase() : '';
    const hasInvalidPrefix = !CANONICAL_METHOD_PREFIXES.includes(pfx as any);
    const usedOt = (
      bid.procurementType === 'OPEN_TENDER' ||
      bid.procurementType === 'OT' ||
      bid.canonicalMethod === 'OPEN_TENDER' ||
      bid.canonicalMethod === 'OT' ||
      pfx === 'OT'
    );

    if (hasInvalidPrefix || usedOt) {
      bidsToDelete.push(bid);
      const reasons = [];
      if (hasInvalidPrefix) reasons.push(`Non-canonical prefix "${pfx}"`);
      if (usedOt) reasons.push(`Used OT/OPEN_TENDER (type: ${bid.procurementType}, canonical: ${bid.canonicalMethod})`);
      console.log(`[FLAGGED BID #${bid.id}] bidNumber: "${bid.bidNumber}", title: "${bid.title}" -> Reasons: ${reasons.join(', ')}`);
    }
  }

  // -------------------------------------------------------------
  // LOOP 2: Requirement
  // -------------------------------------------------------------
  console.log('\n--- Scanning Requirement Table ---');
  const allReqs = await prisma.requirement.findMany({
    select: {
      id: true,
      requirementNumber: true,
      title: true,
      procurementMethod: true,
      canonicalMethod: true,
      _count: {
        select: {
          items: true,
          directPurchases: true,
          tenders: true,
        }
      }
    }
  });
  stats.requirementsScanned = allReqs.length;

  const reqsToDelete: typeof allReqs = [];
  for (const req of allReqs) {
    const pfx = req.requirementNumber ? req.requirementNumber.split('-')[0].toUpperCase() : '';
    const hasInvalidPrefix = !CANONICAL_METHOD_PREFIXES.includes(pfx as any);
    const usedOt = (
      req.canonicalMethod === 'OPEN_TENDER' ||
      req.canonicalMethod === 'OT' ||
      pfx === 'OT'
    );

    if (hasInvalidPrefix || usedOt) {
      reqsToDelete.push(req);
      const reasons = [];
      if (hasInvalidPrefix) reasons.push(`Non-canonical prefix "${pfx}"`);
      if (usedOt) reasons.push(`Used OT/OPEN_TENDER (canonical: ${req.canonicalMethod})`);
      console.log(`[FLAGGED REQ #${req.id}] reqNumber: "${req.requirementNumber}", title: "${req.title}" -> Reasons: ${reasons.join(', ')}`);
    }
  }

  // -------------------------------------------------------------
  // LOOP 3: Tender
  // -------------------------------------------------------------
  console.log('\n--- Scanning Tender Table ---');
  const allTenders = await prisma.tender.findMany({
    select: {
      id: true,
      tenderId: true,
      title: true,
      _count: {
        select: {
          bids: true,
          contracts: true,
          purchaseOrders: true,
        }
      }
    }
  });
  stats.tendersScanned = allTenders.length;

  const tendersToDelete: typeof allTenders = [];
  for (const t of allTenders) {
    const pfx = t.tenderId ? t.tenderId.split('-')[0].toUpperCase() : '';
    const hasInvalidPrefix = !CANONICAL_METHOD_PREFIXES.includes(pfx as any);
    const usedOt = pfx === 'OT';

    if (hasInvalidPrefix || usedOt) {
      tendersToDelete.push(t);
      console.log(`[FLAGGED TENDER #${t.id}] tenderId: "${t.tenderId}", title: "${t.title}"`);
    }
  }

  // -------------------------------------------------------------
  // LOOP 4: DirectPurchase
  // -------------------------------------------------------------
  console.log('\n--- Scanning DirectPurchase Table ---');
  const allDps = await prisma.directPurchase.findMany({
    select: {
      id: true,
      purchaseNumber: true,
      status: true,
    }
  });
  stats.directPurchasesScanned = allDps.length;

  const dpsToDelete: typeof allDps = [];
  for (const dp of allDps) {
    const pfx = dp.purchaseNumber ? dp.purchaseNumber.split('-')[0].toUpperCase() : '';
    // Must be DP only (e.g. not PRQ, PR, CART, etc.)
    if (pfx !== 'DP') {
      dpsToDelete.push(dp);
      console.log(`[FLAGGED DIRECT PURCHASE #${dp.id}] purchaseNumber: "${dp.purchaseNumber}", status: "${dp.status}"`);
    }
  }

  // -------------------------------------------------------------
  // SUMMARY OF FLAGGED RECORDS
  // -------------------------------------------------------------
  console.log('\n================================================================');
  console.log('   FLAGGED RECORDS SUMMARY                                      ');
  console.log('================================================================');
  console.log(`ProcurementBids to delete: ${bidsToDelete.length} (out of ${stats.procurementBidsScanned})`);
  console.log(`Requirements to delete:    ${reqsToDelete.length} (out of ${stats.requirementsScanned})`);
  console.log(`Tenders to delete:         ${tendersToDelete.length} (out of ${stats.tendersScanned})`);
  console.log(`DirectPurchases to delete: ${dpsToDelete.length} (out of ${stats.directPurchasesScanned})`);

  if (isDryRun) {
    console.log('\n[DRY RUN COMPLETE] No records were modified. To execute deletions, run with --commit');
    return;
  }

  // -------------------------------------------------------------
  // EXECUTION LOOP IN PRISMA TRANSACTION
  // -------------------------------------------------------------
  console.log('\n>>> EXECUTING SAFE RELATIONAL DELETIONS IN TRANSACTION <<<');

  await prisma.$transaction(async (tx) => {
    // 1. Delete flagged ProcurementBids and relations
    for (const bid of bidsToDelete) {
      console.log(`Deleting ProcurementBid #${bid.id} ("${bid.bidNumber}")...`);
      await tx.procurementBidAward.deleteMany({ where: { bidId: bid.id } });
      await tx.procurementBidClarificationFile.deleteMany({ where: { clarification: { bidId: bid.id } } });
      await tx.procurementBidClarification.deleteMany({ where: { bidId: bid.id } });
      await tx.procurementBidParticipationDocument.deleteMany({ where: { participation: { bidId: bid.id } } });
      await tx.procurementBidParticipation.deleteMany({ where: { bidId: bid.id } });
      await tx.procurementBidEvaluation.deleteMany({ where: { bidId: bid.id } });
      await tx.procurementBidDocument.deleteMany({ where: { bidId: bid.id } });
      await tx.procurementBidInvitation.deleteMany({ where: { bidId: bid.id } });
      await tx.procurementBid.delete({ where: { id: bid.id } });
      stats.procurementBidsDeleted++;
    }

    // 2. Delete flagged Requirements and relations
    for (const req of reqsToDelete) {
      console.log(`Deleting Requirement #${req.id} ("${req.requirementNumber}")...`);
      await tx.requirementItem.deleteMany({ where: { requirementId: req.id } });
      await tx.tender.deleteMany({ where: { requirementId: req.id } });
      await tx.directPurchase.deleteMany({ where: { requirementId: req.id } });
      await tx.requirement.delete({ where: { id: req.id } });
      stats.requirementsDeleted++;
    }

    // 3. Delete flagged Tenders and relations
    for (const t of tendersToDelete) {
      console.log(`Deleting Tender #${t.id} ("${t.tenderId}")...`);
      await tx.bid.deleteMany({ where: { tenderId: t.id } });
      await tx.comparativeStatement.deleteMany({ where: { tenderId: t.id } });
      await tx.financialEvaluation.deleteMany({ where: { tenderId: t.id } });
      await tx.technicalEvaluationResult.deleteMany({ where: { tenderId: t.id } });
      await tx.technicalEvaluationCriteria.deleteMany({ where: { tenderId: t.id } });
      await tx.tender.delete({ where: { id: t.id } });
      stats.tendersDeleted++;
    }

    // 4. Delete flagged DirectPurchases
    for (const dp of dpsToDelete) {
      console.log(`Deleting DirectPurchase #${dp.id} ("${dp.purchaseNumber}")...`);
      await tx.directPurchase.delete({ where: { id: dp.id } });
      stats.directPurchasesDeleted++;
    }
  }, { timeout: 30000, maxWait: 15000 });

  console.log('\n================================================================');
  console.log('   TRANSACTION COMMITTED SUCCESSFULLY                           ');
  console.log('================================================================');
  console.log(`ProcurementBids deleted: ${stats.procurementBidsDeleted}`);
  console.log(`Requirements deleted:    ${stats.requirementsDeleted}`);
  console.log(`Tenders deleted:         ${stats.tendersDeleted}`);
  console.log(`DirectPurchases deleted: ${stats.directPurchasesDeleted}`);
  console.log('Database is now strictly normalized to canonical procurement prefixes!');
}

main()
  .catch((err) => {
    console.error('[CLEANUP SCRIPT ERROR]:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
