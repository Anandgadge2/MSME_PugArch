import prisma from '../lib/prisma.js';
import * as bidService from '../modules/procurementBid/procurement-bid.service.js';
import * as orderService from '../modules/procurementBid/procurement-order.service.js';

const db = prisma as any;

async function runLifecycleTest() {
  console.log('🚀 [TEST] Starting End-to-End Procurement Lifecycle Automated Verification');

  // 1. Setup buyer and two sellers
  let buyer = await db.user.findFirst({ where: { role: 'buyer', accountStatus: 'ACTIVE' } });
  if (!buyer) {
    buyer = await db.user.findFirst({ where: { accountStatus: 'ACTIVE' } });
  }
  let seller1 = await db.user.findFirst({ where: { role: 'seller', id: { not: buyer.id }, accountStatus: 'ACTIVE' } });
  let seller2 = await db.user.findFirst({ where: { role: 'seller', id: { notIn: [buyer.id, seller1?.id || 0] }, accountStatus: 'ACTIVE' } });

  if (!seller1 || !seller2) {
    console.log('⚠️ Need at least two distinct sellers for testing. Creating test seller records if needed...');
    const now = Date.now();
    if (!seller1) {
      seller1 = await db.user.create({
        data: {
          name: `Test Seller 1 ${now}`,
          email: `seller1_${now}@msmetest.in`,
          password: 'Password@123',
          role: 'seller',
          accountStatus: 'ACTIVE',
          accountTypeId: 2
        }
      });
    }
    if (!seller2) {
      seller2 = await db.user.create({
        data: {
          name: `Test Seller 2 ${now}`,
          email: `seller2_${now}@msmetest.in`,
          password: 'Password@123',
          role: 'seller',
          accountStatus: 'ACTIVE',
          accountTypeId: 2
        }
      });
    }
  }

  console.log(`✅ Test users: Buyer (#${buyer.id}), Seller 1 (#${seller1.id}), Seller 2 (#${seller2.id})`);

  // 2. Create a test ProcurementBid
  const bidNum = `BID-TEST-${Date.now()}`;
  const bid = await db.procurementBid.create({
    data: {
      bidNumber: bidNum,
      title: `Lifecycle Test Bid ${bidNum}`,
      description: 'End-to-End Lifecycle verification from award to settlement',
      buyerId: buyer.id,
      buyerOrganizationName: 'MSME Test Department',
      buyerType: 'PSU',
      category: 'IT Equipment',
      bidType: 'Product',
      quantity: 10,
      unit: 'Units',
      estimatedValue: 500000,
      deliveryLocation: 'New Delhi HQ',
      startDate: new Date(Date.now() - 86400000),
      endDate: new Date(Date.now() + 86400000),
      status: 'UNDER_EVALUATION',
      approvalStatus: 'APPROVED'
    }
  });
  console.log(`✅ Created test bid: #${bid.id} (${bid.bidNumber})`);

  // 3. Create participations for Seller 1 and Seller 2
  const part1 = await db.procurementBidParticipation.create({
    data: {
      bidId: bid.id,
      sellerId: seller1.id,
      participationNumber: `PRT-S1-${bid.id}`,
      submissionStatus: 'SUBMITTED',
      technicalStatus: 'QUALIFIED',
      financialStatus: 'EVALUATED',
      finalStatus: 'PENDING',
      quotedAmount: 48000,
      gstPercentage: 18,
      totalAmount: 56640,
      submittedAt: new Date()
    }
  });

  const part2 = await db.procurementBidParticipation.create({
    data: {
      bidId: bid.id,
      sellerId: seller2.id,
      participationNumber: `PRT-S2-${bid.id}`,
      submissionStatus: 'SUBMITTED',
      technicalStatus: 'QUALIFIED',
      financialStatus: 'EVALUATED',
      finalStatus: 'PENDING',
      quotedAmount: 49000,
      gstPercentage: 18,
      totalAmount: 57820,
      submittedAt: new Date()
    }
  });
  console.log(`✅ Created participations: Part 1 (#${part1.id}), Part 2 (#${part2.id})`);

  const mockBuyerReq: any = { user: buyer, ip: '127.0.0.1', headers: {} };
  const mockSeller1Req: any = { user: seller1, ip: '127.0.0.1', headers: {} };
  const mockSeller2Req: any = { user: seller2, ip: '127.0.0.1', headers: {} };

  // Step 1: Buyer offers award to Seller 1
  console.log('👉 [STEP 1] Buyer offers award to Seller 1...');
  await bidService.recommendAward(mockBuyerReq, String(bid.id), {
    participationId: part1.id,
    remarks: 'Offering contract award to Seller 1'
  });

  const checkPart1 = await db.procurementBidParticipation.findUnique({ where: { id: part1.id } });
  const checkPart2 = await db.procurementBidParticipation.findUnique({ where: { id: part2.id } });
  const checkBid1 = await db.procurementBid.findUnique({ where: { id: bid.id } });

  console.log(`- Seller 1 finalStatus: ${checkPart1.finalStatus} (Expected: AWARD_OFFERED)`);
  console.log(`- Seller 2 finalStatus: ${checkPart2.finalStatus} (Expected: PENDING - NO PREMATURE REJECTION)`);
  console.log(`- Bid status: ${checkBid1.status} (Expected: AWARD_OFFERED)`);

  if (checkPart1.finalStatus !== 'AWARD_OFFERED' || checkPart2.finalStatus !== 'PENDING') {
    throw new Error('FAILED RULE 1: Premature rejection detected or Seller 1 not offered award!');
  }

  // Step 2: Seller 1 Declines Award
  console.log('👉 [STEP 2] Seller 1 declines award offer...');
  await bidService.declineAward(mockSeller1Req, String(bid.id), {
    reason: 'Cannot fulfill delivery within the specified schedule due to supply shortages.'
  });

  const checkPart1Declined = await db.procurementBidParticipation.findUnique({ where: { id: part1.id } });
  const checkBidReset = await db.procurementBid.findUnique({ where: { id: bid.id } });
  console.log(`- Seller 1 finalStatus: ${checkPart1Declined.finalStatus} (Expected: AWARD_DECLINED)`);
  console.log(`- Bid status: ${checkBidReset.status} (Expected: UNDER_EVALUATION)`);

  if (checkPart1Declined.finalStatus !== 'AWARD_DECLINED' || checkBidReset.status !== 'UNDER_EVALUATION') {
    throw new Error('FAILED RULE 2: Seller 1 decline transition did not reset bid for re-evaluation!');
  }

  // Step 3: Buyer offers award to Seller 2
  console.log('👉 [STEP 3] Buyer offers award to Seller 2...');
  await bidService.recommendAward(mockBuyerReq, String(bid.id), {
    participationId: part2.id,
    remarks: 'Offering contract award to Seller 2'
  });

  const checkPart2Offered = await db.procurementBidParticipation.findUnique({ where: { id: part2.id } });
  console.log(`- Seller 2 finalStatus: ${checkPart2Offered.finalStatus} (Expected: AWARD_OFFERED)`);
  if (checkPart2Offered.finalStatus !== 'AWARD_OFFERED') {
    throw new Error('FAILED: Seller 2 could not be offered award after Seller 1 declined!');
  }

  // Step 4: Seller 2 Accepts Award
  console.log('👉 [STEP 4] Seller 2 accepts award offer...');
  await bidService.acceptAward(mockSeller2Req, String(bid.id));

  const checkPart2Accepted = await db.procurementBidParticipation.findUnique({ where: { id: part2.id } });
  const checkBidAccepted = await db.procurementBid.findUnique({ where: { id: bid.id } });
  console.log(`- Seller 2 finalStatus: ${checkPart2Accepted.finalStatus} (Expected: AWARD_ACCEPTED)`);
  console.log(`- Bid status: ${checkBidAccepted.status} (Expected: AWARD_ACCEPTED)`);

  if (checkPart2Accepted.finalStatus !== 'AWARD_ACCEPTED' || checkBidAccepted.status !== 'AWARD_ACCEPTED') {
    throw new Error('FAILED: Seller 2 accept award transition failed!');
  }

  // Step 5: Buyer generates Purchase Order (PO)
  console.log('👉 [STEP 5] Buyer generates formal Purchase Order...');
  const poResult = await bidService.generatePOForBid(mockBuyerReq, String(bid.id));
  const createdPO = poResult.purchaseOrder;
  console.log(`- PO Number: ${createdPO.poNumber}, Status: ${createdPO.status}, poStatus: ${createdPO.poStatus}`);

  if (createdPO.status !== 'issued' || createdPO.poStatus !== 'ISSUED') {
    throw new Error('FAILED: Purchase Order was not issued with status ISSUED!');
  }

  // Step 6: Seller 2 accepts PO (This triggers rejection of Seller 1 / others!)
  console.log('👉 [STEP 6] Seller 2 accepts Purchase Order...');
  await orderService.acceptPO(mockSeller2Req, createdPO.id, {
    remarks: 'Committed to deliver in 14 days'
  });

  const checkPOAccepted = await db.purchaseOrder.findUnique({ where: { id: createdPO.id } });
  const checkPart1Final = await db.procurementBidParticipation.findUnique({ where: { id: part1.id } });
  const checkPart2Final = await db.procurementBidParticipation.findUnique({ where: { id: part2.id } });
  const checkBidInProg = await db.procurementBid.findUnique({ where: { id: bid.id } });

  console.log(`- PO Status: ${checkPOAccepted.status} (Expected: accepted), poStatus: ${checkPOAccepted.poStatus} (Expected: ACCEPTED)`);
  console.log(`- Seller 1 finalStatus: ${checkPart1Final.finalStatus} (Expected: NOT_SELECTED / REJECTED)`);
  console.log(`- Seller 2 finalStatus: ${checkPart2Final.finalStatus} (Expected: ORDERED)`);
  console.log(`- Bid status: ${checkBidInProg.status} (Expected: IN_PROGRESS)`);

  if (checkPOAccepted.status !== 'accepted' || checkPart2Final.finalStatus !== 'ORDERED') {
    throw new Error('FAILED: PO acceptance failed to commit seller or update status!');
  }

  // Step 7: GRN Invoicing Gate Check
  console.log('👉 [STEP 7] Testing PO-to-Invoice Gate (attempting invoice BEFORE GRN approval)...');
  let gateBlocked = false;
  try {
    await orderService.createOrderInvoice(mockSeller2Req, createdPO.id, {
      invoiceNumber: `INV-TEST-PRE-${Date.now()}`
    });
  } catch (err: any) {
    gateBlocked = true;
    console.log(`- Gate blocked as expected! Code: ${err?.code}, Message: ${err?.message}`);
  }

  if (!gateBlocked) {
    throw new Error('FAILED RULE: Invoice creation was allowed BEFORE GRN was approved!');
  }

  // Step 8: Buyer creates and approves GRN
  console.log('👉 [STEP 8] Buyer inspects consignment and approves GRN...');
  const grn = await orderService.createOrderGrn(mockBuyerReq, createdPO.id, {
    receivedQuantity: 10,
    acceptedQuantity: 10,
    rejectedQuantity: 0,
    remarks: 'Full quantity inspected and accepted in good order'
  });

  await orderService.approveOrderGrn(mockBuyerReq, createdPO.id, grn.id, {
    remarks: 'Inspection verified by store manager'
  });

  const checkGrnApproved = await db.goodsReceiptNote.findUnique({ where: { id: grn.id } });
  console.log(`- GRN status: ${checkGrnApproved.status} (Expected: APPROVED)`);
  if (checkGrnApproved.status !== 'APPROVED') {
    throw new Error('FAILED: GRN was not approved!');
  }

  // Step 9: Seller Converts PO to Invoice (now unlocked!)
  console.log('👉 [STEP 9] Seller converts PO to Invoice after verified GRN...');
  const invoice = await orderService.createOrderInvoice(mockSeller2Req, createdPO.id, {
    invoiceNumber: `INV-TEST-POST-${Date.now()}`,
    gstPercentage: 18
  });

  console.log(`- Invoice #${invoice.id} (${invoice.invoiceNumber}) created! Status: ${invoice.invoiceStatus}, grnId: ${invoice.grnId}`);
  if (invoice.invoiceStatus !== 'SUBMITTED' || invoice.grnId !== grn.id) {
    throw new Error('FAILED: Invoice creation after GRN failed or did not link grnId!');
  }

  // Step 10: Buyer records payment & bank UTR
  console.log('👉 [STEP 10] Buyer records payment transaction with UTR & slip...');
  const utr = `UTR-NEFT-${Date.now()}`;
  const paidInvoice = await orderService.recordOrderPayment(mockBuyerReq, invoice.id, {
    transactionReference: utr,
    bankName: 'State Bank of India',
    paymentMode: 'NEFT',
    paymentDate: new Date()
  });

  const checkPOPaid = await db.purchaseOrder.findUnique({ where: { id: createdPO.id } });
  console.log(`- Invoice Status: ${paidInvoice.invoiceStatus} (Expected: PAYMENT_SUBMITTED)`);
  console.log(`- PO Status: ${checkPOPaid.status} (Expected: paid), poStatus: ${checkPOPaid.poStatus} (Expected: PAID)`);

  if (paidInvoice.invoiceStatus !== 'PAYMENT_SUBMITTED' || checkPOPaid.poStatus !== 'PAID') {
    throw new Error('FAILED: Payment recording did not update invoice/PO status!');
  }

  // Step 11: Seller confirms funds & settles order
  console.log('👉 [STEP 11] Seller confirms funds in bank and settles order...');
  const settledInvoice = await orderService.confirmOrderSettlement(mockSeller2Req, invoice.id, {
    remarks: 'Funds verified in SBI account. Order settled.'
  });

  const checkPOCompleted = await db.purchaseOrder.findUnique({ where: { id: createdPO.id } });
  const checkBidCompleted = await db.procurementBid.findUnique({ where: { id: bid.id } });

  console.log(`- Invoice Status: ${settledInvoice.invoiceStatus} (Expected: SETTLED)`);
  console.log(`- PO Status: ${checkPOCompleted.status} (Expected: completed), poStatus: ${checkPOCompleted.poStatus} (Expected: COMPLETED)`);
  console.log(`- Bid status: ${checkBidCompleted.status} (Expected: COMPLETED)`);

  if (settledInvoice.invoiceStatus !== 'SETTLED' || checkPOCompleted.poStatus !== 'COMPLETED' || checkBidCompleted.status !== 'COMPLETED') {
    throw new Error('FAILED: Settlement did not complete and close the contract!');
  }

  console.log('🎉 [SUCCESS] All 11 phases of End-to-End Procurement Lifecycle successfully validated!');
  process.exit(0);
}

runLifecycleTest().catch(err => {
  console.error('❌ [TEST_ERROR]', err);
  process.exit(1);
});
