import prisma from '../lib/prisma.js';

interface MonthBucket {
  key: string;
  label: string;
  start: Date;
  end: Date;
}

function getLast6Months(): MonthBucket[] {
  const months: MonthBucket[] = [];
  const now = new Date();

  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const start = new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
    const monthName = start.toLocaleString('en-US', { month: 'short' });
    const yearShort = String(start.getFullYear()).slice(2);
    
    months.push({
      key: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`,
      label: `${monthName} '${yearShort}`,
      start,
      end
    });
  }
  return months;
}

export class DashboardAnalyticsService {
  /**
   * Authentic Buyer Analytics: Real MSME quota compliance, 6-month spend trends, procurement funnel, and method mix.
   */
  async getBuyerAnalytics(userIdNum: number, orgId: number | null) {
    const buyerRecordWhere = orgId
      ? { OR: [{ buyerId: userIdNum }, { buyer: { organizationId: orgId } }] }
      : { buyerId: userIdNum };

    // 1. Fetch all purchase orders for buyer with seller demographics
    const purchaseOrders = await prisma.purchaseOrder.findMany({
      where: {
        ...buyerRecordWhere,
        status: { notIn: ['cancelled', 'CANCELLED', 'DRAFT'] }
      },
      select: {
        id: true,
        poNumber: true,
        amount: true,
        totalValue: true,
        createdAt: true,
        status: true,
        sourceType: true,
        tenderId: true,
        bidId: true,
        seller: {
          select: {
            id: true,
            registrationDetails: true,
            organization: {
              select: {
                id: true,
                organizationName: true,
                organizationType: true,
                udyamNumber: true
              }
            },
            sellerProfile: {
              select: {
                msmeCategory: true,
                msmeCategoryEnum: true,
                isUdyamCertified: true,
                organizationType: true,
                isStartup: true
              }
            }
          }
        }
      }
    }).catch(() => [] as any[]);

    // 2. Compute authentic compliance & spend statistics
    let totalSpend = 0;
    let msmeSpend = 0;
    let scStSpend = 0;
    let womenSpend = 0;
    let generalMsmeSpend = 0;

    for (const po of purchaseOrders) {
      const amount = Number(po.amount || po.totalValue || 0);
      totalSpend += amount;

      const seller = po.seller;
      const profile = seller?.sellerProfile;
      const org = seller?.organization;
      const reg = (seller?.registrationDetails as Record<string, any>) || {};

      const isUdyam = Boolean(
        profile?.isUdyamCertified ||
        org?.udyamNumber ||
        ['MICRO', 'SMALL'].includes(String(profile?.msmeCategoryEnum || profile?.msmeCategory || '').toUpperCase()) ||
        String(org?.organizationType || '').toUpperCase() === 'SHG'
      );

      if (isUdyam) {
        msmeSpend += amount;

        const socialCat = String(reg.socialCategory || reg.casteCategory || (profile as any)?.socialCategory || '').toUpperCase();
        const isSC_ST = ['SC', 'ST'].includes(socialCat);

        const isWomen = Boolean(
          reg.isWomenOwned ||
          reg.isWomenEnterprise ||
          String(reg.gender || '').toLowerCase() === 'female' ||
          String(org?.organizationType || '').toUpperCase() === 'SHG'
        );

        if (isSC_ST) {
          scStSpend += amount;
        } else if (isWomen) {
          womenSpend += amount;
        } else {
          generalMsmeSpend += amount;
        }
      }
    }

    const msmeSharePercent = totalSpend > 0 ? Number(((msmeSpend / totalSpend) * 100).toFixed(1)) : 0;
    const scStPercent = totalSpend > 0 ? Number(((scStSpend / totalSpend) * 100).toFixed(1)) : 0;
    const womenPercent = totalSpend > 0 ? Number(((womenSpend / totalSpend) * 100).toFixed(1)) : 0;
    const generalPercent = totalSpend > 0 ? Number(((generalMsmeSpend / totalSpend) * 100).toFixed(1)) : 0;

    // 3. 6-Month Spend Trend
    const months = getLast6Months();
    const spendTrend = months.map(m => {
      const monthOrders = purchaseOrders.filter((po: any) => {
        const d = new Date(po.createdAt);
        return d >= m.start && d <= m.end;
      });

      let mTotal = 0;
      let mMSE = 0;

      for (const po of monthOrders) {
        const val = Number(po.amount || po.totalValue || 0);
        mTotal += val;

        const profile = po.seller?.sellerProfile;
        const org = po.seller?.organization;
        const isMSE = Boolean(
          profile?.isUdyamCertified ||
          org?.udyamNumber ||
          ['MICRO', 'SMALL'].includes(String(profile?.msmeCategoryEnum || profile?.msmeCategory || '').toUpperCase()) ||
          String(org?.organizationType || '').toUpperCase() === 'SHG'
        );

        if (isMSE) mMSE += val;
      }

      return {
        key: m.key,
        month: m.label,
        totalSpend: Math.round(mTotal),
        msmeSpend: Math.round(mMSE),
        ordersCount: monthOrders.length
      };
    });

    // 4. Procurement Methods Breakdown from DB
    const [tendersCount, bidsCount, auctionsCount, directCount] = await Promise.all([
      prisma.tender.count({
        where: orgId ? { OR: [{ buyerId: userIdNum }, { organizationId: orgId }] } : { buyerId: userIdNum }
      }).catch(() => 0),
      (prisma as any).procurementBid.count({
        where: orgId ? { buyerOrgId: orgId } : { buyerUserId: userIdNum }
      }).catch(() => 0),
      (prisma as any).reverseAuction.count({
        where: orgId ? { organizationId: orgId } : { createdById: userIdNum }
      }).catch(() => 0),
      prisma.purchaseOrder.count({
        where: { ...buyerRecordWhere, sourceType: 'direct_purchase' }
      }).catch(() => 0)
    ]);

    const methodDistribution = [
      { name: 'Open Tenders', count: tendersCount, color: '#12335f' },
      { name: 'RFQs / Bids', count: bidsCount, color: '#0ea5e9' },
      { name: 'Reverse Auctions', count: auctionsCount, color: '#8b5cf6' },
      { name: 'Direct Purchases', count: directCount, color: '#10b981' }
    ];

    // 5. Procurement Pipeline Funnel (Status progression)
    const [openTenders, openBids, activeAuctions, evalProcurements, awardedOrders] = await Promise.all([
      prisma.tender.count({ 
        where: { 
          ...(orgId ? { OR: [{ buyerId: userIdNum }, { organizationId: orgId }] } : { buyerId: userIdNum }), 
          status: { in: ['published', 'active', 'open'] as any } 
        } 
      }).catch(() => 0),
      (prisma as any).procurementBid.count({ 
        where: { 
          ...(orgId ? { buyerOrgId: orgId } : { buyerUserId: userIdNum }), 
          status: { in: ['OPEN', 'OPEN_FOR_BIDDING', 'PUBLISHED'] } 
        } 
      }).catch(() => 0),
      (prisma as any).reverseAuction.count({ 
        where: { 
          ...(orgId ? { organizationId: orgId } : { createdById: userIdNum }), 
          status: { in: ['LIVE', 'ACTIVE', 'SCHEDULED'] } 
        } 
      }).catch(() => 0),
      (prisma as any).procurementBid.count({ 
        where: { 
          ...(orgId ? { buyerOrgId: orgId } : { buyerUserId: userIdNum }), 
          status: { in: ['TECHNICAL_EVALUATION', 'FINANCIAL_EVALUATION', 'UNDER_EVALUATION', 'EVALUATION'] } 
        } 
      }).catch(() => 0),
      prisma.purchaseOrder.count({ 
        where: { 
          ...buyerRecordWhere, 
          status: { in: ['generated', 'accepted', 'approved', 'issued'] } 
        } 
      }).catch(() => 0)
    ]);

    const closedOrdersCount = purchaseOrders.filter((p: any) => 
      ['completed', 'delivered', 'closed'].includes(String(p.status).toLowerCase())
    ).length;

    const procurementFunnel = [
      { stage: 'Live Bidding', count: openTenders + openBids + activeAuctions, color: '#0ea5e9', description: 'Active supplier competition' },
      { stage: 'Technical & Financial Eval', count: evalProcurements, color: '#6366f1', description: 'Commercial opening & evaluation' },
      { stage: 'Awarded & In-Progress', count: awardedOrders, color: '#10b981', description: 'Purchase orders issued' },
      { stage: 'Fulfilled & Settled', count: closedOrdersCount, color: '#12335f', description: 'Delivered and accepted' }
    ];

    return {
      compliance: {
        totalSpend,
        msmeSpend,
        scStSpend,
        womenSpend,
        generalMsmeSpend,
        msmeSharePercent,
        scStPercent,
        womenPercent,
        generalPercent,
        isMandateMet: msmeSharePercent >= 25.0,
        activeOrdersCount: purchaseOrders.length
      },
      spendTrend,
      methodDistribution,
      procurementFunnel
    };
  }

  /**
   * Authentic Seller Analytics: Real proposal conversion, 6-month revenue trends, cashflow lifecycle, and delivery SLA.
   */
  async getSellerAnalytics(userIdNum: number, orgId: number | null) {
    const sellerRecordWhere = orgId
      ? { OR: [{ sellerId: userIdNum }, { seller: { organizationId: orgId } }] }
      : { sellerId: userIdNum };

    // 1. Fetch proposals / participations across all procurement modules
    const [procBids, reqResponses, tenderBids] = await Promise.all([
      (prisma as any).procurementBidParticipation.findMany({
        where: orgId
          ? { OR: [{ sellerId: userIdNum }, { seller: { organizationId: orgId } }] }
          : { sellerId: userIdNum },
        select: {
          id: true,
          status: true,
          financialOffer: true,
          totalPrice: true,
          createdAt: true
        }
      }).catch(() => []),
      (prisma as any).requirementResponse.findMany({
        where: orgId
          ? { OR: [{ sellerUserId: userIdNum }, { sellerOrganizationId: orgId }] }
          : { sellerUserId: userIdNum },
        select: {
          id: true,
          status: true,
          quotedPrice: true,
          createdAt: true
        }
      }).catch(() => []),
      prisma.bid.findMany({
        where: sellerRecordWhere,
        select: {
          id: true,
          status: true,
          totalAmount: true,
          createdAt: true
        }
      }).catch(() => [])
    ]);

    // Aggregate counts
    let totalSubmitted = 0;
    let wonCount = 0;
    let underEvalCount = 0;
    let rejectedCount = 0;
    let pipelineValue = 0;

    const wonStatuses = new Set(['AWARDED', 'ACCEPTED', 'WON', 'awarded', 'accepted', 'approved']);
    const evalStatuses = new Set([
      'SUBMITTED', 'TECHNICAL_DOCUMENTS_UPLOADED', 'FINANCIAL_QUOTE_UPLOADED',
      'QUALIFIED', 'UNDER_REVIEW', 'SHORTLISTED', 'OPEN', 'PENDING', 'submitted', 'pending'
    ]);
    const rejectStatuses = new Set(['REJECTED', 'DISQUALIFIED', 'LOST', 'rejected', 'disqualified', 'cancelled']);

    for (const p of procBids) {
      totalSubmitted++;
      const st = String(p.status || '').toUpperCase();
      if (wonStatuses.has(st)) wonCount++;
      else if (evalStatuses.has(st)) {
        underEvalCount++;
        pipelineValue += Number(p.financialOffer || p.totalPrice || 0);
      } else if (rejectStatuses.has(st)) rejectedCount++;
    }

    for (const r of reqResponses) {
      totalSubmitted++;
      const st = String(r.status || '').toUpperCase();
      if (wonStatuses.has(st)) wonCount++;
      else if (evalStatuses.has(st)) {
        underEvalCount++;
        pipelineValue += Number(r.quotedPrice || 0);
      } else if (rejectStatuses.has(st)) rejectedCount++;
    }

    for (const b of tenderBids) {
      totalSubmitted++;
      const st = String(b.status || '').toUpperCase();
      if (wonStatuses.has(st)) wonCount++;
      else if (evalStatuses.has(st)) {
        underEvalCount++;
        pipelineValue += Number(b.totalAmount || 0);
      } else if (rejectStatuses.has(st)) rejectedCount++;
    }

    const winRate = totalSubmitted > 0 ? Number(((wonCount / totalSubmitted) * 100).toFixed(1)) : 0;

    // 2. Fetch fulfilled / active PurchaseOrders for revenue history
    const sellerOrders = await prisma.purchaseOrder.findMany({
      where: {
        ...sellerRecordWhere,
        status: { notIn: ['cancelled', 'CANCELLED', 'DRAFT'] }
      },
      select: {
        id: true,
        amount: true,
        totalValue: true,
        createdAt: true,
        status: true
      }
    }).catch(() => [] as any[]);

    const totalRevenue = (sellerOrders as any[]).reduce((sum: number, o: any) => sum + Number(o.amount || o.totalValue || 0), 0);

    // 3. 6-Month Revenue Trend
    const months = getLast6Months();
    const revenueTrend = months.map(m => {
      const monthOrders = (sellerOrders as any[]).filter((o: any) => {
        const d = new Date(o.createdAt);
        return d >= m.start && d <= m.end;
      });

      const mRevenue = monthOrders.reduce((sum: number, o: any) => sum + Number(o.amount || o.totalValue || 0), 0);
      return {
        key: m.key,
        month: m.label,
        revenue: Math.round(mRevenue),
        ordersCount: monthOrders.length
      };
    });

    // 4. On-time delivery rate from real DeliveryTracking
    const deliveries = await prisma.deliveryTracking.findMany({
      where: {
        purchaseOrder: sellerRecordWhere,
        status: 'DELIVERED'
      },
      select: {
        id: true,
        expectedDelivery: true,
        actualDelivery: true
      }
    }).catch(() => []);

    let onTimeDeliveries = 0;
    let trackedCount = 0;

    for (const d of deliveries) {
      if (d.expectedDelivery && d.actualDelivery) {
        trackedCount++;
        if (new Date(d.actualDelivery).getTime() <= new Date(d.expectedDelivery).getTime()) {
          onTimeDeliveries++;
        }
      }
    }

    const onTimeDeliveryRate = trackedCount > 0
      ? Number(((onTimeDeliveries / trackedCount) * 100).toFixed(1))
      : null;

    // 5. Cashflow & Invoice Receivables Lifecycle
    const sellerInvoices = await prisma.invoice.findMany({
      where: sellerRecordWhere,
      select: {
        id: true,
        amount: true,
        status: true,
        invoiceStatus: true
      }
    }).catch(() => [] as any[]);

    let settledAmount = 0;
    let settledCount = 0;
    let approvedAmount = 0;
    let approvedCount = 0;
    let underReviewAmount = 0;
    let underReviewCount = 0;
    let rejectedAmount = 0;
    let rejectedInvoicesCount = 0;

    for (const inv of sellerInvoices) {
      const amt = Number(inv.amount || 0);
      const st = String(inv.status || inv.invoiceStatus || '').toUpperCase();
      if (['PAID', 'SETTLED', 'paid', 'settled'].includes(st)) {
        settledAmount += amt;
        settledCount++;
      } else if (['APPROVED', 'PAYMENT_SUBMITTED', 'approved'].includes(st)) {
        approvedAmount += amt;
        approvedCount++;
      } else if (['SUBMITTED', 'UNDER_REVIEW', 'PENDING', 'submitted', 'pending'].includes(st)) {
        underReviewAmount += amt;
        underReviewCount++;
      } else if (['REJECTED', 'CANCELLED', 'rejected', 'cancelled'].includes(st)) {
        rejectedAmount += amt;
        rejectedInvoicesCount++;
      }
    }

    const cashflowLifecycle = [
      { name: 'Settled & Paid', amount: Math.round(settledAmount), count: settledCount, color: '#10b981' },
      { name: 'Approved Payout', amount: Math.round(approvedAmount), count: approvedCount, color: '#3b82f6' },
      { name: 'Under Review', amount: Math.round(underReviewAmount), count: underReviewCount, color: '#f59e0b' },
      { name: 'Disputed', amount: Math.round(rejectedAmount), count: rejectedInvoicesCount, color: '#ef4444' }
    ];

    return {
      conversion: {
        submitted: totalSubmitted,
        won: wonCount,
        underEval: underEvalCount,
        rejected: rejectedCount,
        winRate,
        pipelineValue: Math.round(pipelineValue),
        onTimeDeliveryRate,
        hasDeliveries: trackedCount > 0,
        totalRevenue: Math.round(totalRevenue),
        totalOrders: sellerOrders.length
      },
      revenueTrend,
      cashflowLifecycle
    };
  }
}

export const dashboardAnalyticsService = new DashboardAnalyticsService();
