import './src/config/env.js';
import prisma from './src/lib/prisma.js';

// Let's run the exact backend endpoint logic:
async function simulateDashboardSummary() {
  const user = await prisma.user.findUnique({
    where: { id: 6 }
  });

  if (!user) {
    console.error('User 6 not found');
    return;
  }

  const orgId = user.organizationId;
  const userIdNum = user.id;

  // Let's trace getOrSetCache body:
  try {
    const membership = orgId ? await prisma.orgMembership.findUnique({
        where: { userId_organizationId: { userId: userIdNum, organizationId: orgId } },
        select: { orgRole: true, isActive: true }
    }) : null;
    const orgRole = membership?.isActive ? membership.orgRole : null;

    // Determine which approval stages this role can decide
    const stages: string[] = [];
    if (orgRole === 'PROCUREMENT_OFFICER' || orgRole === 'ORG_ADMIN') stages.push('DEPARTMENT_HEAD');
    if (orgRole === 'FINANCE_OFFICER' || orgRole === 'ORG_ADMIN') stages.push('FINANCE_DEPT');
    if (orgRole === 'ORG_ADMIN') stages.push('PROCUREMENT_HEAD');

    const isBuyer = user.role === 'buyer';
    const isSeller = user.role === 'seller';
    const buyerRecordWhere = orgId
        ? { OR: [{ buyerId: userIdNum }, { buyer: { organizationId: orgId } }] }
        : { buyerId: userIdNum };
    const sellerRecordWhere = orgId
        ? { OR: [{ sellerId: userIdNum }, { seller: { organizationId: orgId } }] }
        : { sellerId: userIdNum };
    const buyerTenderWhere = orgId
        ? { OR: [{ buyerId: userIdNum }, { organizationId: orgId }] }
        : { buyerId: userIdNum };
    const sellerCatalogueWhere = orgId
        ? { OR: [{ sellerId: userIdNum }, { organizationId: orgId }] }
        : { sellerId: userIdNum };

    // Status lists from org.routes.ts
    const activePoStatuses = ['generated', 'issued', 'accepted', 'in_fulfillment', 'GENERATED', 'ISSUED', 'ACCEPTED', 'IN_FULFILLMENT'];
    const pendingInvoiceStatuses = ['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED'];
    const openTenderStatuses = ['published', 'bid_submission'];
    const activeDeliveryTerminalStatuses = ['DELIVERED', 'CANCELLED', 'CLOSED'];
    const activeQuotationStatuses = ['SUBMITTED', 'UNDER_TECHNICAL_EVALUATION', 'TECHNICALLY_QUALIFIED', 'UNDER_FINANCIAL_EVALUATION', 'ACCEPTED'];
    const activeQuoteRequestStatuses = ['SENT', 'RESPONDED'];
    const publicProcurementBidStatuses = ['PENDING_ADMIN_APPROVAL', 'OPEN', 'APPROVED', 'TECHNICAL_EVALUATION', 'FINANCIAL_EVALUATION', 'AWARDED'];

    console.log('Running Promise.all queries...');
    const result = await Promise.all([
            // cart item count
            orgId
                ? prisma.cart.findFirst({
                    where: { organizationId: orgId, status: 'ACTIVE' },
                    select: { _count: { select: { items: true } } }
                })
                : Promise.resolve(null),
            // pending approvals
            stages.length > 0
                ? prisma.procurementApproval.count({
                    where: {
                        organizationId: orgId as number,
                        stage: { in: stages as any },
                        decision: { in: ['PENDING', 'SENT_FOR_CLARIFICATION'] }
                    }
                })
                : Promise.resolve(0),
            // carts pending finance approval
            (orgRole === 'FINANCE_OFFICER' || orgRole === 'ORG_ADMIN')
                ? prisma.cart.count({
                    where: { organizationId: orgId as number, status: 'SUBMITTED_FOR_APPROVAL' }
                })
                : Promise.resolve(0),
            // tech review queue
            (orgRole === 'TECHNICAL_OFFICER' || orgRole === 'ORG_ADMIN')
                ? prisma.cartItem.count({
                    where: {
                        cart: { organizationId: orgId as number, status: 'SUBMITTED_FOR_APPROVAL' },
                        technicalApproved: null
                    }
                })
                : Promise.resolve(0),
            // GRNs awaiting approval
            orgId
                ? prisma.goodsReceiptNote.count({
                    where: { organizationId: orgId, status: 'SUBMITTED' }
                })
                : Promise.resolve(0),
            // active deliveries (only useful for sellers)
            isSeller
                ? prisma.deliveryTracking.count({
                    where: {
                        purchaseOrder: sellerRecordWhere,
                        status: { notIn: activeDeliveryTerminalStatuses as any }
                    }
                })
                : Promise.resolve(0),
            // ─── Buyer baseline counts ───
            isBuyer
                ? prisma.tender.count({ where: buyerTenderWhere }).catch(() => 0)
                : Promise.resolve(0),
            isBuyer
                ? prisma.purchaseOrder.count({
                    where: { ...buyerRecordWhere, status: { in: activePoStatuses } }
                }).catch(() => 0)
                : Promise.resolve(0),
            isBuyer
                ? prisma.invoice.count({
                    where: { ...buyerRecordWhere, status: { in: pendingInvoiceStatuses } }
                }).catch(() => 0)
                : Promise.resolve(0),
            isBuyer
                ? prisma.quoteRequest.count({ where: { ...buyerRecordWhere, status: { in: activeQuoteRequestStatuses } } }).catch(() => 0)
                : Promise.resolve(0),
            // ─── Seller baseline counts ───
            isSeller
                ? prisma.tender.count({
                    where: {
                        status: { in: openTenderStatuses as any },
                        OR: [{ closesAt: null }, { closesAt: { gt: new Date() } }]
                    }
                }).catch((err) => { console.error('Tender count error:', err); return 0; })
                : Promise.resolve(0),
            isSeller
                ? prisma.purchaseOrder.count({
                    where: { ...sellerRecordWhere, status: { in: activePoStatuses } }
                }).catch((err) => { console.error('PO count error:', err); return 0; })
                : Promise.resolve(0),
            isSeller
                ? prisma.product.count({ where: { ...sellerCatalogueWhere, status: 'ACTIVE' as any } })
                    .then(p => prisma.service.count({ where: { ...sellerCatalogueWhere, status: 'ACTIVE' as any } })
                        .then(s => p + s).catch(() => p))
                    .catch((err) => { console.error('Catalogue count error:', err); return 0; })
                : Promise.resolve(0),
            isSeller
                ? prisma.invoice.count({
                    where: { ...sellerRecordWhere, status: { in: pendingInvoiceStatuses } }
                }).catch((err) => { console.error('Invoice count error:', err); return 0; })
                : Promise.resolve(0),
            isSeller
                ? prisma.bid.count({
                    where: { ...sellerRecordWhere, status: { in: activeQuotationStatuses } }
                }).catch((err) => { console.error('Bid count error:', err); return 0; })
                : Promise.resolve(0),
            isSeller
                ? prisma.quoteRequest.count({ where: { ...sellerRecordWhere, status: { in: activeQuoteRequestStatuses } } }).catch((err) => { console.error('QuoteReq count error:', err); return 0; })
                : Promise.resolve(0),
            isSeller
                ? (prisma as any).procurementBid.count({
                    where: {
                        approvalStatus: { in: ['APPROVED', 'PENDING'] },
                        status: { in: publicProcurementBidStatuses },
                        OR: [{ endDate: null }, { endDate: { gt: new Date() } }]
                    }
                }).catch((err: any) => { console.error('procurementBid count error:', err); return 0; })
                : Promise.resolve(0),
            isSeller
                ? (prisma as any).procurementBidParticipation.count({
                    where: orgId
                        ? { OR: [{ sellerId: userIdNum }, { seller: { organizationId: orgId } }] }
                        : { sellerId: userIdNum }
                }).catch((err: any) => { console.error('procurementParticipation count error:', err); return 0; })
                : Promise.resolve(0)
    ]);

    const [
      activeCart,
      pendingApprovals,
      cartApprovals,
      techReview,
      grnsToApprove,
      activeDeliveries,
      myTenders,
      myActivePOs,
      myPendingInvoices,
      myRfqs,
      sellerOpenTenders,
      sellerActivePOs,
      sellerCatalogueItems,
      sellerPendingInvoices,
      sellerTenderQuotations,
      sellerReceivedRfqs,
      sellerLiveProcurementBids,
      sellerProcurementParticipations
    ] = result;

    const data = {
        cartItemCount: activeCart?._count?.items || 0,
        pendingApprovalsCount: pendingApprovals,
        cartApprovalsCount: cartApprovals,
        techReviewCount: techReview,
        grnsToApproveCount: grnsToApprove,
        activeDeliveriesCount: activeDeliveries,
        myTendersCount: myTenders,
        myActivePOsCount: myActivePOs,
        myPendingInvoicesCount: myPendingInvoices,
        myRfqsCount: myRfqs,
        sellerOpenTendersCount: sellerOpenTenders + sellerLiveProcurementBids,
        sellerActivePOsCount: sellerActivePOs,
        sellerCatalogueItemsCount: sellerCatalogueItems,
        sellerPendingInvoicesCount: sellerPendingInvoices,
        sellerQuotationsCount: sellerTenderQuotations + sellerReceivedRfqs + sellerProcurementParticipations,
        orgRole
    };

    console.log('SUCCESS! Summary Data:', data);
  } catch (error) {
    console.error('Simulate failed with error:', error);
  }
}

simulateDashboardSummary()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
