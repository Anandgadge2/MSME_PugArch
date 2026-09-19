/**
 * Comprehensive Database Purge Script for Procurement Data
 * Deletes ALL procurements, bids, requirements, auctions, rate contracts,
 * purchase orders, invoices, delivery trackings, GRNs, cart items, carts, etc.
 * 
 * Preserves user accounts, organizations, master catalog (products/services),
 * seller profiles, and RBAC permissions.
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function safeDeleteMany(modelName) {
  if (prisma[modelName] && typeof prisma[modelName].deleteMany === 'function') {
    const res = await prisma[modelName].deleteMany({});
    console.log(`  Deleted ${modelName}: ${res.count}`);
    return res.count;
  } else {
    console.log(`  Skipped ${modelName} (model not defined on Prisma client)`);
    return 0;
  }
}

async function run() {
  console.log('===================================================================');
  console.log('STARTING PURGE OF ALL PROCUREMENTS AND PROCUREMENT-RELATED DATA');
  console.log('===================================================================\n');

  try {
    // -------------------------------------------------------------------
    // PHASE 1: FINANCIAL & ESCROW DEPENDENTS
    // -------------------------------------------------------------------
    console.log('--- Phase 1: Financial & Escrow Dependents ---');
    await safeDeleteMany('milestoneApproval');
    await safeDeleteMany('milestonePayment');
    await safeDeleteMany('escrowTransaction');
    await safeDeleteMany('milestone');

    if (prisma.escrowAccount) {
      await prisma.escrowAccount.updateMany({ data: { purchaseOrderId: null } });
    }
    await safeDeleteMany('escrowAccount');

    await safeDeleteMany('offlinePaymentProof');
    await safeDeleteMany('financialLedgerEntry');
    await safeDeleteMany('paymentTransaction');
    await safeDeleteMany('paymentSettlement');
    await safeDeleteMany('invoiceFactoring');
    await safeDeleteMany('invoiceItem');
    await safeDeleteMany('invoice');

    // -------------------------------------------------------------------
    // PHASE 2: FULFILLMENT, GRN, DELIVERY, INSPECTION & DISPUTES
    // -------------------------------------------------------------------
    console.log('\n--- Phase 2: Fulfillment, GRN, Delivery & Disputes ---');
    await safeDeleteMany('consigneeReceiptAcceptanceCertificate');
    await safeDeleteMany('provisionalReceiptCertificate');
    await safeDeleteMany('grnItem');
    await safeDeleteMany('grnDocument');
    await safeDeleteMany('goodsReceiptNote');
    await safeDeleteMany('deliveryTrackingEvent');
    await safeDeleteMany('deliveryStatusLog');
    await safeDeleteMany('deliveryDocument');
    await safeDeleteMany('deliveryParticipant');
    await safeDeleteMany('deliveryDpExtension');
    await safeDeleteMany('deliveryTracking');
    await safeDeleteMany('deliveryWorkflow');
    await safeDeleteMany('buyerAcceptance');
    await safeDeleteMany('inspectionReport');
    await safeDeleteMany('inspectionRecord');
    await safeDeleteMany('disputeAttachment');
    await safeDeleteMany('disputeMessage');
    await safeDeleteMany('disputeEvidence');
    await safeDeleteMany('dispute');
    await safeDeleteMany('purchaseOrderItem');
    await safeDeleteMany('purchaseOrder');

    // -------------------------------------------------------------------
    // PHASE 3: BIDS, RFQS, REQUIREMENTS & PROCUREMENTS
    // -------------------------------------------------------------------
    console.log('\n--- Phase 3: Bids, Requirements & Procurement Bids ---');
    await safeDeleteMany('procurementAuditLog');
    await safeDeleteMany('procurementApproval');
    await safeDeleteMany('emdPayment');
    await safeDeleteMany('l1Comparison');
    await safeDeleteMany('procurementBidClarificationFile');
    await safeDeleteMany('procurementBidClarification');
    await safeDeleteMany('procurementBidParticipationDocument');
    await safeDeleteMany('procurementBidAward');
    await safeDeleteMany('procurementBidParticipation');
    await safeDeleteMany('procurementBidEvaluation');
    await safeDeleteMany('procurementBidDocument');
    await safeDeleteMany('procurementBidInvitation');
    await safeDeleteMany('procurementBid');
    await safeDeleteMany('quoteRequestClarification');
    await safeDeleteMany('quoteResponse');
    await safeDeleteMany('quoteRequest');
    await safeDeleteMany('requirementClarification');
    await safeDeleteMany('requirementItem');
    await safeDeleteMany('requirement');
    await safeDeleteMany('requirementResponse');
    await safeDeleteMany('buyerRequirement');
    await safeDeleteMany('bidWizardDraft');
    await safeDeleteMany('procurementDraft');
    await safeDeleteMany('bid');
    await safeDeleteMany('tenderParticipant');
    await safeDeleteMany('tender');

    // -------------------------------------------------------------------
    // PHASE 4: REVERSE AUCTIONS & CONTRACTS
    // -------------------------------------------------------------------
    console.log('\n--- Phase 4: Auctions & Contracts ---');
    await safeDeleteMany('auctionQualificationDocument');
    await safeDeleteMany('auctionParticipant');
    await safeDeleteMany('auctionEventLog');
    await safeDeleteMany('auctionBid');
    await safeDeleteMany('auction');
    await safeDeleteMany('rateContractConfig');
    await safeDeleteMany('contract');

    // -------------------------------------------------------------------
    // PHASE 5: CARTS & DIRECT PURCHASES
    // -------------------------------------------------------------------
    console.log('\n--- Phase 5: Cart Items & Direct Purchases ---');
    await safeDeleteMany('cartItem');
    await safeDeleteMany('cart');
    await safeDeleteMany('guestCartItem');
    await safeDeleteMany('guestCart');
    await safeDeleteMany('directPurchase');

    // -------------------------------------------------------------------
    // PHASE 6: COMMUNICATIONS, RATINGS & NOTIFICATIONS
    // -------------------------------------------------------------------
    console.log('\n--- Phase 6: Messages, Ratings & Notifications ---');
    await safeDeleteMany('message');
    await safeDeleteMany('conversation');
    await safeDeleteMany('supplierRating');
    await safeDeleteMany('buyerRating');
    await safeDeleteMany('notificationLog');
    await safeDeleteMany('notification');

    console.log('\n===================================================================');
    console.log('✅ ALL PROCUREMENTS AND RELATED DATA PURGED SUCCESSFULLY!');
    console.log('===================================================================');

  } catch (error) {
    console.error('❌ ERROR DURING PURGE:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

run();
