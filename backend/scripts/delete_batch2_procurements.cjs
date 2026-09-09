/**
 * Permanent Deletion Script for Batch 2 Procurements
 * Target Buyer: snehalkolhe2628@gmail.com (User ID: 4)
 *
 * Removes from BOTH buyer and seller side:
 * 1. canteen service (Contract #2: RC-1786182629575)
 * 2. water bottles (Bid #8: REQ-98205, Reqs #14, #12)
 * 3. COLLEGE BAGS (Bid #1: REQ-99751, Reqs #1, #2, BuyerReqs #6, #11)
 * 4. Annual Rate Contract for Office Stationery (Contract #1: RC-1786170101620, Bid #5: REQ-60496, Req #8, BuyerReq #5)
 * 5. Supply of Laptops for Corporate Employees (Bid #3: REQ-17970, Req #6, BuyerReq #7, Award #1, PO #1: PO-PB-97887)
 * 6. title 1 (Bid #6: REQ-12876, Reqs #11, #9)
 * 7. Supply of Multifunction Laser Printers (Bid #4: REQ-98107, Req #7)
 * 8. school stationary customize (Auction #1: RA-2026-JVREMU / REQ-2026-00005, Reqs #5, #4)
 * 9. Design, Supply, Installation & Commissioning of 500 kW Solar Power Plant (Bid #2: REQ-39620, Req #3)
 * 10. Cupidatat mollitia n (Bid #7: REQ-86638, Req #13)
 * 11. bags (Bid #11: REQ-46334, Req #19)
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const BUYER_USER_ID = 4;

const TARGET_BID_IDS = [1, 2, 3, 4, 5, 6, 7, 8, 11];
const TARGET_REQ_IDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 12, 13, 14, 19];
const TARGET_CONTRACT_IDS = [1, 2];
const TARGET_AUCTION_IDS = [1];
const TARGET_BUYER_REQ_IDS = [5, 6, 7, 11];

const TARGET_TITLES = [
  'canteen service',
  'water bottles',
  'COLLEGE BAGS',
  'Annual Rate Contract for Office Stationery',
  'Supply of Laptops for Corporate Employees',
  'title 1',
  'Supply of Multifunction Laser Printers',
  'school stationary customize',
  'Design, Supply, Installation & Commissioning of 500 kW Solar Power Plant',
  'Cupidatat mollitia n',
  'bags'
];

const REF_NUMBERS = [
  'REQ-98107',
  'REQ-12876',
  'REQ-17970',
  'REQ-86638',
  'REQ-98205',
  'REQ-39620',
  'REQ-60496',
  'REQ-99751',
  'REQ-46334',
  'REQ-64868',
  'REQ-87913',
  'REQ-19872',
  'REQ-75684',
  'REQ-86588',
  'RC-1786170101620',
  'RC-1786182629575',
  'REQ-2026-00005',
  'RA-2026-JVREMU',
  'PO-PB-97887'
];

async function run() {
  console.log('====================================================');
  console.log('PERMANENT DELETION: 11 TARGET PROCUREMENTS');
  console.log('Ensuring removal from Buyer, Seller & Portal views');
  console.log('====================================================\n');

  // Step 1: Identify linked PurchaseOrders
  const linkedAwards = await prisma.procurementBidAward.findMany({
    where: { bidId: { in: TARGET_BID_IDS } },
    select: { id: true }
  });
  const awardIds = linkedAwards.map(a => a.id);

  const linkedPOs = await prisma.purchaseOrder.findMany({
    where: {
      OR: [
        { sourceType: 'procurementBid', sourceId: { in: TARGET_BID_IDS } },
        { sourceType: 'procurement_bid_award', sourceId: { in: awardIds } },
        { contractId: { in: TARGET_CONTRACT_IDS } },
        { id: 1 },
        { poNumber: { in: REF_NUMBERS } }
      ]
    },
    select: { id: true, poNumber: true, sourceType: true, sourceId: true }
  });

  const poIds = linkedPOs.map(po => po.id);
  console.log(`Linked PurchaseOrders found (${poIds.length}):`, linkedPOs.map(p => `PO #${p.id} [${p.poNumber}]`));

  // ===== 1. PURCHASE ORDER DEPENDENTS =====
  if (poIds.length > 0) {
    console.log('\n--- 1. Deleting PurchaseOrder Dependents ---');

    const escrows = await prisma.escrowAccount.findMany({
      where: { purchaseOrderId: { in: poIds } },
      select: { id: true }
    });
    const escrowIds = escrows.map(e => e.id);

    if (escrowIds.length > 0) {
      const milestones = await prisma.milestone.findMany({
        where: { escrowAccountId: { in: escrowIds } },
        select: { id: true }
      });
      const milestoneIds = milestones.map(m => m.id);

      if (milestoneIds.length > 0) {
        const dMA = await prisma.milestoneApproval.deleteMany({ where: { milestoneId: { in: milestoneIds } } });
        console.log(`  Deleted MilestoneApproval: ${dMA.count}`);
        const dMP = await prisma.milestonePayment.deleteMany({ where: { milestoneId: { in: milestoneIds } } });
        console.log(`  Deleted MilestonePayment: ${dMP.count}`);
        const dETM = await prisma.escrowTransaction.deleteMany({ where: { milestoneId: { in: milestoneIds } } });
        console.log(`  Deleted EscrowTransaction (milestone-linked): ${dETM.count}`);
        const dMil = await prisma.milestone.deleteMany({ where: { id: { in: milestoneIds } } });
        console.log(`  Deleted Milestone: ${dMil.count}`);
      }

      const dET = await prisma.escrowTransaction.deleteMany({ where: { escrowAccountId: { in: escrowIds } } });
      console.log(`  Deleted EscrowTransaction: ${dET.count}`);

      await prisma.escrowAccount.updateMany({ where: { id: { in: escrowIds } }, data: { purchaseOrderId: null } });
      console.log(`  Nulled EscrowAccount.purchaseOrderId`);
    }

    const dCRAC = await prisma.consigneeReceiptAcceptanceCertificate.deleteMany({ where: { purchaseOrderId: { in: poIds } } });
    console.log(`  Deleted CRAC: ${dCRAC.count}`);

    const grns = await prisma.goodsReceiptNote.findMany({ where: { purchaseOrderId: { in: poIds } }, select: { id: true } });
    if (grns.length > 0) {
      const grnIds = grns.map(g => g.id);
      const dGI = await prisma.grnItem.deleteMany({ where: { grnId: { in: grnIds } } });
      console.log(`  Deleted GrnItem: ${dGI.count}`);
      const dGD = await prisma.grnDocument.deleteMany({ where: { grnId: { in: grnIds } } });
      console.log(`  Deleted GrnDocument: ${dGD.count}`);
    }
    const dGRN = await prisma.goodsReceiptNote.deleteMany({ where: { purchaseOrderId: { in: poIds } } });
    console.log(`  Deleted GoodsReceiptNote: ${dGRN.count}`);

    const dPRC = await prisma.provisionalReceiptCertificate.deleteMany({ where: { purchaseOrderId: { in: poIds } } });
    console.log(`  Deleted ProvisionalReceiptCertificate: ${dPRC.count}`);

    const invoices = await prisma.invoice.findMany({ where: { purchaseOrderId: { in: poIds } }, select: { id: true } });
    if (invoices.length > 0) {
      const invoiceIds = invoices.map(i => i.id);
      const dIF = await prisma.invoiceFactoring.deleteMany({ where: { invoiceId: { in: invoiceIds } } });
      console.log(`  Deleted InvoiceFactoring: ${dIF.count}`);
      const dII = await prisma.invoiceItem.deleteMany({ where: { invoiceId: { in: invoiceIds } } });
      console.log(`  Deleted InvoiceItem: ${dII.count}`);
    }
    const dInv = await prisma.invoice.deleteMany({ where: { purchaseOrderId: { in: poIds } } });
    console.log(`  Deleted Invoice: ${dInv.count}`);

    if (escrowIds.length > 0) {
      const dEsc = await prisma.escrowAccount.deleteMany({ where: { id: { in: escrowIds } } });
      console.log(`  Deleted EscrowAccount: ${dEsc.count}`);
    }

    const payTxns = await prisma.paymentTransaction.findMany({ where: { purchaseOrderId: { in: poIds } }, select: { id: true } });
    if (payTxns.length > 0) {
      const dOPP = await prisma.offlinePaymentProof.deleteMany({ where: { purchaseOrderId: { in: poIds } } });
      console.log(`  Deleted OfflinePaymentProof: ${dOPP.count}`);
      const dFLE = await prisma.financialLedgerEntry.deleteMany({ where: { purchaseOrderId: { in: poIds } } });
      console.log(`  Deleted FinancialLedgerEntry: ${dFLE.count}`);
    }
    const dPayTx = await prisma.paymentTransaction.deleteMany({ where: { purchaseOrderId: { in: poIds } } });
    console.log(`  Deleted PaymentTransaction: ${dPayTx.count}`);

    const dDT = await prisma.deliveryTracking.deleteMany({ where: { purchaseOrderId: { in: poIds } } });
    console.log(`  Deleted DeliveryTracking: ${dDT.count}`);

    const dDW = await prisma.deliveryWorkflow.deleteMany({ where: { purchaseOrderId: { in: poIds } } });
    console.log(`  Deleted DeliveryWorkflow: ${dDW.count}`);

    const dPOI = await prisma.purchaseOrderItem.deleteMany({ where: { purchaseOrderId: { in: poIds } } });
    console.log(`  Deleted PurchaseOrderItem: ${dPOI.count}`);



    const inspRecs = await prisma.inspectionRecord.findMany({ where: { purchaseOrderId: { in: poIds } }, select: { id: true } });
    if (inspRecs.length > 0) {
      const dIRpt = await prisma.inspectionReport.deleteMany({ where: { inspectionRecordId: { in: inspRecs.map(i => i.id) } } });
      console.log(`  Deleted InspectionReport: ${dIRpt.count}`);
    }
    const dIR = await prisma.inspectionRecord.deleteMany({ where: { purchaseOrderId: { in: poIds } } });
    console.log(`  Deleted InspectionRecord: ${dIR.count}`);

    const disputes = await prisma.dispute.findMany({
      where: {
        OR: [
          { purchaseOrderId: { in: poIds } },
          { auctionId: { in: TARGET_AUCTION_IDS } }
        ]
      },
      select: { id: true }
    });
    if (disputes.length > 0) {
      const disputeIds = disputes.map(d => d.id);
      await prisma.disputeAttachment.deleteMany({ where: { disputeId: { in: disputeIds } } });
      await prisma.disputeMessage.deleteMany({ where: { disputeId: { in: disputeIds } } });
      await prisma.disputeEvidence.deleteMany({ where: { disputeId: { in: disputeIds } } });
      const dDisp = await prisma.dispute.deleteMany({ where: { id: { in: disputeIds } } });
      console.log(`  Deleted Dispute: ${dDisp.count}`);
    }

    const dPO = await prisma.purchaseOrder.deleteMany({ where: { id: { in: poIds } } });
    console.log(`  Deleted PurchaseOrder: ${dPO.count}`);
  }

  // ===== 2. AUCTION DEPENDENTS =====
  console.log('\n--- 2. Deleting Auction Dependents (Auction #1) ---');
  const dAQD = await prisma.auctionQualificationDocument.deleteMany({ where: { auctionId: { in: TARGET_AUCTION_IDS } } });
  console.log(`  Deleted AuctionQualificationDocument: ${dAQD.count}`);

  const dAP = await prisma.auctionParticipant.deleteMany({ where: { auctionId: { in: TARGET_AUCTION_IDS } } });
  console.log(`  Deleted AuctionParticipant: ${dAP.count}`);

  const dAEL = await prisma.auctionEventLog.deleteMany({ where: { auctionId: { in: TARGET_AUCTION_IDS } } });
  console.log(`  Deleted AuctionEventLog: ${dAEL.count}`);

  const dAB = await prisma.auctionBid.deleteMany({ where: { auctionId: { in: TARGET_AUCTION_IDS } } });
  console.log(`  Deleted AuctionBid: ${dAB.count}`);

  const dRA = await prisma.auction.deleteMany({ where: { id: { in: TARGET_AUCTION_IDS } } });
  console.log(`  Deleted Auction: ${dRA.count}`);

  // ===== 3. CONTRACTS (RATE CONTRACTS) =====
  console.log('\n--- 3. Deleting Contracts (Contracts #1, #2) ---');
  const dCont = await prisma.contract.deleteMany({ where: { id: { in: TARGET_CONTRACT_IDS } } });
  console.log(`  Deleted Contract: ${dCont.count}`);

  // ===== 4. PROCUREMENT BID DEPENDENTS =====
  console.log('\n--- 4. Deleting ProcurementBid Dependents ---');
  const dAL = await prisma.procurementAuditLog.deleteMany({
    where: { entityType: 'BID', entityId: { in: TARGET_BID_IDS.map(String) } }
  });
  console.log(`  Deleted ProcurementAuditLog (BID): ${dAL.count}`);

  const dPA = await prisma.procurementApproval.deleteMany({
    where: { entityType: 'BID', entityId: { in: TARGET_BID_IDS } }
  });
  console.log(`  Deleted ProcurementApproval (BID): ${dPA.count}`);

  const dEmd = await prisma.emdPayment.deleteMany({ where: { bidId: { in: TARGET_BID_IDS } } });
  console.log(`  Deleted EmdPayment: ${dEmd.count}`);



  const clarifications = await prisma.procurementBidClarification.findMany({
    where: { bidId: { in: TARGET_BID_IDS } },
    select: { id: true }
  });
  if (clarifications.length > 0) {
    const dCF = await prisma.procurementBidClarificationFile.deleteMany({
      where: { clarificationId: { in: clarifications.map(c => c.id) } }
    });
    console.log(`  Deleted ProcurementBidClarificationFile: ${dCF.count}`);
  }
  const dClar = await prisma.procurementBidClarification.deleteMany({ where: { bidId: { in: TARGET_BID_IDS } } });
  console.log(`  Deleted ProcurementBidClarification: ${dClar.count}`);

  const participations = await prisma.procurementBidParticipation.findMany({
    where: { bidId: { in: TARGET_BID_IDS } },
    select: { id: true }
  });
  if (participations.length > 0) {
    const dPD = await prisma.procurementBidParticipationDocument.deleteMany({
      where: { participationId: { in: participations.map(p => p.id) } }
    });
    console.log(`  Deleted ProcurementBidParticipationDocument: ${dPD.count}`);
  }

  const dEval = await prisma.procurementBidEvaluation.deleteMany({ where: { bidId: { in: TARGET_BID_IDS } } });
  console.log(`  Deleted ProcurementBidEvaluation: ${dEval.count}`);

  const dAward = await prisma.procurementBidAward.deleteMany({ where: { bidId: { in: TARGET_BID_IDS } } });
  console.log(`  Deleted ProcurementBidAward: ${dAward.count}`);

  const dPart = await prisma.procurementBidParticipation.deleteMany({ where: { bidId: { in: TARGET_BID_IDS } } });
  console.log(`  Deleted ProcurementBidParticipation: ${dPart.count}`);

  const dBidDoc = await prisma.procurementBidDocument.deleteMany({ where: { bidId: { in: TARGET_BID_IDS } } });
  console.log(`  Deleted ProcurementBidDocument: ${dBidDoc.count}`);

  const dBidInv = await prisma.procurementBidInvitation.deleteMany({ where: { bidId: { in: TARGET_BID_IDS } } });
  console.log(`  Deleted ProcurementBidInvitation: ${dBidInv.count}`);

  const dBid = await prisma.procurementBid.deleteMany({ where: { id: { in: TARGET_BID_IDS } } });
  console.log(`  Deleted ProcurementBid: ${dBid.count}`);

  // ===== 5. REQUIREMENT DEPENDENTS =====
  console.log('\n--- 5. Deleting Requirement Dependents ---');
  const dALR = await prisma.procurementAuditLog.deleteMany({
    where: { entityType: 'REQUIREMENT', entityId: { in: TARGET_REQ_IDS.map(String) } }
  });
  console.log(`  Deleted ProcurementAuditLog (REQUIREMENT): ${dALR.count}`);

  const dPAR = await prisma.procurementApproval.deleteMany({
    where: { entityType: 'REQUIREMENT', entityId: { in: TARGET_REQ_IDS } }
  });
  console.log(`  Deleted ProcurementApproval (REQUIREMENT): ${dPAR.count}`);

  const dRC = await prisma.requirementClarification.deleteMany({
    where: { entityType: 'REQUIREMENT', entityId: { in: TARGET_REQ_IDS } }
  });
  console.log(`  Deleted RequirementClarification: ${dRC.count}`);

  const dRI = await prisma.requirementItem.deleteMany({ where: { requirementId: { in: TARGET_REQ_IDS } } });
  console.log(`  Deleted RequirementItem: ${dRI.count}`);

  const dReq = await prisma.requirement.deleteMany({ where: { id: { in: TARGET_REQ_IDS } } });
  console.log(`  Deleted Requirement: ${dReq.count}`);

  // ===== 6. BUYER REQUIREMENT DEPENDENTS =====
  console.log('\n--- 6. Deleting BuyerRequirement Dependents ---');
  const dRR = await prisma.requirementResponse.deleteMany({ where: { requirementId: { in: TARGET_BUYER_REQ_IDS } } });
  console.log(`  Deleted RequirementResponse: ${dRR.count}`);

  const dBR = await prisma.buyerRequirement.deleteMany({ where: { id: { in: TARGET_BUYER_REQ_IDS } } });
  console.log(`  Deleted BuyerRequirement: ${dBR.count}`);

  // ===== 7. NOTIFICATIONS CLEANUP =====
  console.log('\n--- 7. Cleaning up Stale Portal Notifications ---');
  const notifConditions = REF_NUMBERS.map(ref => ({ title: { contains: ref } }))
    .concat(REF_NUMBERS.map(ref => ({ message: { contains: ref } })))
    .concat(REF_NUMBERS.map(ref => ({ redirectUrl: { contains: ref } })));

  const notifLogs = await prisma.notificationLog.deleteMany({
    where: {
      notification: {
        OR: notifConditions
      }
    }
  });
  console.log(`  Deleted NotificationLog: ${notifLogs.count}`);

  const dNotif = await prisma.notification.deleteMany({
    where: {
      OR: notifConditions
    }
  });
  console.log(`  Deleted Notification: ${dNotif.count}`);

  // ===== 8. VERIFICATION =====
  console.log('\n====================================================');
  console.log('POST-DELETION VERIFICATION');
  console.log('====================================================');

  const remainingBids = await prisma.procurementBid.count({
    where: { id: { in: TARGET_BID_IDS } }
  });
  const remainingReqs = await prisma.requirement.count({
    where: { id: { in: TARGET_REQ_IDS } }
  });
  const remainingContracts = await prisma.contract.count({
    where: { id: { in: TARGET_CONTRACT_IDS } }
  });
  const remainingAuctions = await prisma.auction.count({
    where: { id: { in: TARGET_AUCTION_IDS } }
  });
  const remainingBuyerReqs = await prisma.buyerRequirement.count({
    where: { id: { in: TARGET_BUYER_REQ_IDS } }
  });
  const remainingPOs = await prisma.purchaseOrder.count({
    where: { id: { in: poIds } }
  });

  // Check by titles as well
  const remainingByTitle = await prisma.procurementBid.count({
    where: { buyerId: BUYER_USER_ID, title: { in: TARGET_TITLES } }
  });

  console.log(`Target ProcurementBids remaining    : ${remainingBids} (expected: 0)`);
  console.log(`Target Requirements remaining       : ${remainingReqs} (expected: 0)`);
  console.log(`Target Contracts remaining          : ${remainingContracts} (expected: 0)`);
  console.log(`Target Auctions remaining           : ${remainingAuctions} (expected: 0)`);
  console.log(`Target BuyerRequirements remaining : ${remainingBuyerReqs} (expected: 0)`);
  console.log(`Target PurchaseOrders remaining     : ${remainingPOs} (expected: 0)`);
  console.log(`Remaining by exact title match      : ${remainingByTitle} (expected: 0)`);

  if (
    remainingBids === 0 &&
    remainingReqs === 0 &&
    remainingContracts === 0 &&
    remainingAuctions === 0 &&
    remainingBuyerReqs === 0 &&
    remainingPOs === 0 &&
    remainingByTitle === 0
  ) {
    console.log('\n✅ SUCCESS: ALL TARGET RECORDS PERMANENTLY REMOVED ACROSS BUYER & SELLER PORTAL!');
  } else {
    console.error('\n❌ FAILURE: Some records could not be deleted.');
    process.exit(1);
  }
}

run()
  .then(() => process.exit(0))
  .catch(async (err) => {
    console.error('\n❌ SCRIPT ERROR:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
