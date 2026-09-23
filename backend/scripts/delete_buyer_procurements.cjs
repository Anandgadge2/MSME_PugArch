/**
 * Final Procurement Deletion Script for snehalkolhe2628@gmail.com (User ID: 4)
 * Deletes ALL remaining procurements as requested by user.
 *
 * The 18 remaining ProcurementBid records:
 * REQ-99751, REQ-39620, REQ-17970, REQ-98107, REQ-60496, REQ-12876,
 * REQ-86638, REQ-98205, REQ-46334, REQ-14320, REQ-80796, REQ-42971,
 * REQ-87670, REQ-22045, REQ-24560, REQ-25082, REQ-37208, REQ-19391
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const BUYER_USER_ID = 4; // snehalkolhe2628@gmail.com

async function run() {
  console.log('=== FINAL PROCUREMENT DELETION SCRIPT ===');
  console.log('Target buyer user ID:', BUYER_USER_ID);
  console.log('');

  // Step 1: Fetch ALL remaining ProcurementBid records for this buyer
  const bids = await prisma.procurementBid.findMany({
    where: { buyerId: BUYER_USER_ID },
    select: { id: true, bidNumber: true, title: true, status: true },
    orderBy: { id: 'asc' },
  });

  console.log(`Found ${bids.length} ProcurementBid records:`);
  bids.forEach(b => console.log(`  id=${b.id} [${b.bidNumber}] "${b.title}" (${b.status})`));
  console.log('');

  if (bids.length === 0) {
    console.log('No procurements found. Nothing to delete.');
    await prisma.$disconnect();
    return;
  }

  const bidIds = bids.map(b => b.id);

  // Step 2: Find PurchaseOrders linked via sourceType='procurementBid'
  const linkedPOs = await prisma.purchaseOrder.findMany({
    where: {
      OR: [
        { sourceType: 'procurementBid', sourceId: { in: bidIds } },
        { buyerId: BUYER_USER_ID }, // catch any POs directly for this buyer
      ],
    },
    select: { id: true, poNumber: true, sourceType: true, sourceId: true, buyerId: true },
  });

  // Only include POs that are truly linked to the target bids or directly owned
  const poIds = linkedPOs.map(po => po.id);
  console.log(`Found ${linkedPOs.length} PurchaseOrder records linked to buyer:`);
  linkedPOs.forEach(po => console.log(`  PO id=${po.id} [${po.poNumber}] sourceType=${po.sourceType} sourceId=${po.sourceId}`));
  console.log('');

  // Step 3: Fetch Requirement records for this buyer
  const requirements = await prisma.requirement.findMany({
    where: { buyerId: BUYER_USER_ID },
    select: { id: true, requirementNumber: true, title: true },
  });
  const reqIds = requirements.map(r => r.id);
  console.log(`Found ${requirements.length} Requirement records`);

  // Step 4: Fetch BuyerRequirement records for this buyer
  const buyerReqs = await prisma.buyerRequirement.findMany({
    where: { buyerId: BUYER_USER_ID },
    select: { id: true, title: true, status: true },
  });
  const buyerReqIds = buyerReqs.map(br => br.id);
  console.log(`Found ${buyerReqs.length} BuyerRequirement records`);
  console.log('');

  console.log('=== STARTING DELETION ===');

  // ===== PURCHASE ORDER DEPENDENTS =====
  if (poIds.length > 0) {
    console.log('\n--- Deleting PurchaseOrder dependents ---');

    // Handle EscrowAccount chain (has Restrict on PO)
    const escrows = await prisma.escrowAccount.findMany({
      where: { purchaseOrderId: { in: poIds } },
      select: { id: true },
    });
    const escrowIds = escrows.map(e => e.id);

    if (escrowIds.length > 0) {
      const milestones = await prisma.milestone.findMany({
        where: { escrowAccountId: { in: escrowIds } },
        select: { id: true },
      });
      const milestoneIds = milestones.map(m => m.id);

      if (milestoneIds.length > 0) {
        const dMA = await prisma.milestoneApproval.deleteMany({ where: { milestoneId: { in: milestoneIds } } });
        console.log(`  Deleted MilestoneApproval: ${dMA.count}`);
        const dMP = await prisma.milestonePayment.deleteMany({ where: { milestoneId: { in: milestoneIds } } });
        console.log(`  Deleted MilestonePayment: ${dMP.count}`);
        // EscrowTransaction with milestoneId (Restrict) must go before Milestone
        const dETM = await prisma.escrowTransaction.deleteMany({ where: { milestoneId: { in: milestoneIds } } });
        console.log(`  Deleted EscrowTransaction (milestone-linked): ${dETM.count}`);
        const dMil = await prisma.milestone.deleteMany({ where: { id: { in: milestoneIds } } });
        console.log(`  Deleted Milestone: ${dMil.count}`);
      }

      // Remaining EscrowTransactions
      const dET = await prisma.escrowTransaction.deleteMany({ where: { escrowAccountId: { in: escrowIds } } });
      console.log(`  Deleted EscrowTransaction: ${dET.count}`);

      // Null purchaseOrderId in EscrowAccount (Restrict) before deleting PO
      await prisma.escrowAccount.updateMany({ where: { id: { in: escrowIds } }, data: { purchaseOrderId: null } });
      console.log(`  Nulled EscrowAccount.purchaseOrderId for ${escrowIds.length} records`);
    }

    // ConsigneeReceiptAcceptanceCertificate
    const dCRAC = await prisma.consigneeReceiptAcceptanceCertificate.deleteMany({ where: { purchaseOrderId: { in: poIds } } });
    console.log(`  Deleted ConsigneeReceiptAcceptanceCertificate: ${dCRAC.count}`);

    // GoodsReceiptNote + GrnItems/GrnDocuments
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

    // ProvisionalReceiptCertificate
    const dPRC = await prisma.provisionalReceiptCertificate.deleteMany({ where: { purchaseOrderId: { in: poIds } } });
    console.log(`  Deleted ProvisionalReceiptCertificate: ${dPRC.count}`);

    // InvoiceFactoring
    const dIF = await prisma.invoiceFactoring.deleteMany({ where: { purchaseOrderId: { in: poIds } } });
    console.log(`  Deleted InvoiceFactoring: ${dIF.count}`);

    // Invoice + InvoiceItems
    const invoices = await prisma.invoice.findMany({ where: { purchaseOrderId: { in: poIds } }, select: { id: true } });
    if (invoices.length > 0) {
      const dII = await prisma.invoiceItem.deleteMany({ where: { invoiceId: { in: invoices.map(i => i.id) } } });
      console.log(`  Deleted InvoiceItem: ${dII.count}`);
    }
    const dInv = await prisma.invoice.deleteMany({ where: { purchaseOrderId: { in: poIds } } });
    console.log(`  Deleted Invoice: ${dInv.count}`);

    // Now delete EscrowAccount (safe since PO ref was nulled)
    if (escrowIds.length > 0) {
      const dEsc = await prisma.escrowAccount.deleteMany({ where: { id: { in: escrowIds } } });
      console.log(`  Deleted EscrowAccount: ${dEsc.count}`);
    }

    // PaymentTransaction + OfflinePaymentProof
    const payTxns = await prisma.paymentTransaction.findMany({ where: { purchaseOrderId: { in: poIds } }, select: { id: true } });
    if (payTxns.length > 0) {
      const dOPP = await prisma.offlinePaymentProof.deleteMany({ where: { purchaseOrderId: { in: poIds } } });
      console.log(`  Deleted OfflinePaymentProof: ${dOPP.count}`);
      const dFLE = await prisma.financialLedgerEntry.deleteMany({ where: { purchaseOrderId: { in: poIds } } });
      console.log(`  Deleted FinancialLedgerEntry: ${dFLE.count}`);
    }
    const dPayTx = await prisma.paymentTransaction.deleteMany({ where: { purchaseOrderId: { in: poIds } } });
    console.log(`  Deleted PaymentTransaction: ${dPayTx.count}`);

    // DeliveryTracking (events, status logs, documents, participants cascade)
    const dDT = await prisma.deliveryTracking.deleteMany({ where: { purchaseOrderId: { in: poIds } } });
    console.log(`  Deleted DeliveryTracking: ${dDT.count}`);

    // DeliveryWorkflow
    const dDW = await prisma.deliveryWorkflow.deleteMany({ where: { purchaseOrderId: { in: poIds } } });
    console.log(`  Deleted DeliveryWorkflow: ${dDW.count}`);

    // PurchaseOrderItem
    const dPOI = await prisma.purchaseOrderItem.deleteMany({ where: { purchaseOrderId: { in: poIds } } });
    console.log(`  Deleted PurchaseOrderItem: ${dPOI.count}`);

    // BuyerAcceptance
    const dBA = await prisma.buyerAcceptance.deleteMany({ where: { purchaseOrderId: { in: poIds } } });
    console.log(`  Deleted BuyerAcceptance: ${dBA.count}`);

    // PaymentSettlement
    const dPS = await prisma.paymentSettlement.deleteMany({ where: { purchaseOrderId: { in: poIds } } });
    console.log(`  Deleted PaymentSettlement: ${dPS.count}`);

    // InspectionRecord + InspectionReport
    const inspRecs = await prisma.inspectionRecord.findMany({ where: { purchaseOrderId: { in: poIds } }, select: { id: true } });
    if (inspRecs.length > 0) {
      const dIRpt = await prisma.inspectionReport.deleteMany({ where: { inspectionRecordId: { in: inspRecs.map(i => i.id) } } });
      console.log(`  Deleted InspectionReport: ${dIRpt.count}`);
    }
    const dIR = await prisma.inspectionRecord.deleteMany({ where: { purchaseOrderId: { in: poIds } } });
    console.log(`  Deleted InspectionRecord: ${dIR.count}`);

    // Dispute (DisputeMessage, DisputeEvidence, DisputeAttachment cascade from Dispute)
    const disputes = await prisma.dispute.findMany({ where: { purchaseOrderId: { in: poIds } }, select: { id: true } });
    if (disputes.length > 0) {
      const disputeIds = disputes.map(d => d.id);
      await prisma.disputeMessage.deleteMany({ where: { disputeId: { in: disputeIds } } });
      await prisma.disputeEvidence.deleteMany({ where: { disputeId: { in: disputeIds } } });
    }
    const dDisp = await prisma.dispute.deleteMany({ where: { purchaseOrderId: { in: poIds } } });
    console.log(`  Deleted Dispute: ${dDisp.count}`);

    // PurchaseOrder
    const dPO = await prisma.purchaseOrder.deleteMany({ where: { id: { in: poIds } } });
    console.log(`  Deleted PurchaseOrder: ${dPO.count}`);
  }

  // ===== PROCUREMENT BID DEPENDENTS =====
  if (bidIds.length > 0) {
    console.log('\n--- Deleting ProcurementBid dependents ---');

    // ProcurementAuditLog
    const dAL = await prisma.procurementAuditLog.deleteMany({
      where: { entityType: 'BID', entityId: { in: bidIds.map(String) } },
    });
    console.log(`  Deleted ProcurementAuditLog: ${dAL.count}`);

    // ProcurementApproval
    const dPA = await prisma.procurementApproval.deleteMany({
      where: { entityType: 'BID', entityId: { in: bidIds.map(String) } },
    });
    console.log(`  Deleted ProcurementApproval: ${dPA.count}`);

    // EmdPayment
    const dEmd = await prisma.emdPayment.deleteMany({ where: { bidId: { in: bidIds } } });
    console.log(`  Deleted EmdPayment: ${dEmd.count}`);

    // L1Comparison
    const dL1 = await prisma.l1Comparison.deleteMany({ where: { bidId: { in: bidIds } } });
    console.log(`  Deleted L1Comparison: ${dL1.count}`);

    // ProcurementBidClarificationFile + Clarification
    const clarifications = await prisma.procurementBidClarification.findMany({
      where: { bidId: { in: bidIds } },
      select: { id: true },
    });
    if (clarifications.length > 0) {
      const dCF = await prisma.procurementBidClarificationFile.deleteMany({
        where: { clarificationId: { in: clarifications.map(c => c.id) } },
      });
      console.log(`  Deleted ProcurementBidClarificationFile: ${dCF.count}`);
    }
    const dClar = await prisma.procurementBidClarification.deleteMany({ where: { bidId: { in: bidIds } } });
    console.log(`  Deleted ProcurementBidClarification: ${dClar.count}`);

    // ProcurementBidParticipationDocument + Participation
    const participations = await prisma.procurementBidParticipation.findMany({
      where: { bidId: { in: bidIds } },
      select: { id: true },
    });
    if (participations.length > 0) {
      const dPD = await prisma.procurementBidParticipationDocument.deleteMany({
        where: { participationId: { in: participations.map(p => p.id) } },
      });
      console.log(`  Deleted ProcurementBidParticipationDocument: ${dPD.count}`);
      // ProcurementBidAward references participationId (Cascade from bid) -- already handled
    }
    const dPart = await prisma.procurementBidParticipation.deleteMany({ where: { bidId: { in: bidIds } } });
    console.log(`  Deleted ProcurementBidParticipation: ${dPart.count}`);

    // ProcurementBidEvaluation
    const dEval = await prisma.procurementBidEvaluation.deleteMany({ where: { bidId: { in: bidIds } } });
    console.log(`  Deleted ProcurementBidEvaluation: ${dEval.count}`);

    // ProcurementBidAward
    const dAward = await prisma.procurementBidAward.deleteMany({ where: { bidId: { in: bidIds } } });
    console.log(`  Deleted ProcurementBidAward: ${dAward.count}`);

    // ProcurementBidDocument
    const dBidDoc = await prisma.procurementBidDocument.deleteMany({ where: { bidId: { in: bidIds } } });
    console.log(`  Deleted ProcurementBidDocument: ${dBidDoc.count}`);

    // ProcurementBidInvitation
    const dBidInv = await prisma.procurementBidInvitation.deleteMany({ where: { bidId: { in: bidIds } } });
    console.log(`  Deleted ProcurementBidInvitation: ${dBidInv.count}`);

    // ProcurementBid
    const dBid = await prisma.procurementBid.deleteMany({ where: { id: { in: bidIds } } });
    console.log(`  Deleted ProcurementBid: ${dBid.count}`);
  }

  // ===== REQUIREMENT RECORDS =====
  if (reqIds.length > 0) {
    console.log('\n--- Deleting Requirement records ---');

    // ProcurementAuditLog (requirements)
    const dALR = await prisma.procurementAuditLog.deleteMany({
      where: { entityType: 'REQUIREMENT', entityId: { in: reqIds.map(String) } },
    });
    console.log(`  Deleted ProcurementAuditLog (requirements): ${dALR.count}`);

    // ProcurementApproval (requirements)
    const dPAR = await prisma.procurementApproval.deleteMany({
      where: { entityType: 'REQUIREMENT', entityId: { in: reqIds.map(String) } },
    });
    console.log(`  Deleted ProcurementApproval (requirements): ${dPAR.count}`);

    // RequirementClarification
    const dRC = await prisma.requirementClarification.deleteMany({ where: { requirementId: { in: reqIds } } });
    console.log(`  Deleted RequirementClarification: ${dRC.count}`);

    // RequirementItem
    const dRI = await prisma.requirementItem.deleteMany({ where: { requirementId: { in: reqIds } } });
    console.log(`  Deleted RequirementItem: ${dRI.count}`);

    // Requirement
    const dReq = await prisma.requirement.deleteMany({ where: { id: { in: reqIds } } });
    console.log(`  Deleted Requirement: ${dReq.count}`);
  }

  // ===== BUYER REQUIREMENT RECORDS =====
  if (buyerReqIds.length > 0) {
    console.log('\n--- Deleting BuyerRequirement records ---');

    // RequirementResponse
    const dRR = await prisma.requirementResponse.deleteMany({ where: { requirementId: { in: buyerReqIds } } });
    console.log(`  Deleted RequirementResponse: ${dRR.count}`);

    // BuyerRequirement
    const dBR = await prisma.buyerRequirement.deleteMany({ where: { id: { in: buyerReqIds } } });
    console.log(`  Deleted BuyerRequirement: ${dBR.count}`);
  }

  // ===== VERIFICATION =====
  console.log('\n=== POST-DELETION VERIFICATION ===');
  const remainingBids = await prisma.procurementBid.count({ where: { buyerId: BUYER_USER_ID } });
  const remainingReqs = await prisma.requirement.count({ where: { buyerId: BUYER_USER_ID } });
  const remainingBuyerReqs = await prisma.buyerRequirement.count({ where: { buyerId: BUYER_USER_ID } });
  const remainingPOs = poIds.length > 0 ? await prisma.purchaseOrder.count({ where: { id: { in: poIds } } }) : 0;

  console.log(`Remaining ProcurementBid    : ${remainingBids} (expected: 0)`);
  console.log(`Remaining Requirement       : ${remainingReqs} (expected: 0)`);
  console.log(`Remaining BuyerRequirement  : ${remainingBuyerReqs} (expected: 0)`);
  console.log(`Remaining PurchaseOrder     : ${remainingPOs} (expected: 0)`);

  if (remainingBids === 0 && remainingReqs === 0 && remainingBuyerReqs === 0 && remainingPOs === 0) {
    console.log('\n✅ ALL RECORDS SUCCESSFULLY DELETED');
  } else {
    console.error('\n❌ VERIFICATION FAILED — Some records still exist!');
    process.exit(1);
  }

  await prisma.$disconnect();
}

run().catch(async (e) => {
  console.error('❌ ERROR:', e.message);
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
