import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { getOrSetCache } from '../services/cache.service.js';
import db from '../lib/prisma.js';

const router = Router();

router.get('/navigation/summary', authenticate, async (req: AuthRequest, res) => {
  const user = req.user;
  if (!user) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  const cacheKey = `cache:navigation:summary:${user.id}:${user.organizationId || 'no-org'}:${user.role}`;

  try {
    const summary = await getOrSetCache(cacheKey, async () => {
      const isSeller = user.role === 'seller' || user.role === 'shg';
      const isBuyer = user.role === 'buyer';
      const now = new Date();
      const openDateFilter = { endDate: { gt: now } };

      const [
        unreadNotifications,
        rfqsCount,
        rfpsCount,
        openTendersCount,
        invitationsCount,
        auctionsCount,
        rateContractsCount,
        bidsCount
      ] = await Promise.all([
        db.notification.count({
          where: { userId: user.id, isRead: false }
        }).catch(() => 0),

        Promise.all([
          db.procurementBid.count({
            where: {
              AND: [
                { OR: [{ procurementType: { in: ['RFQ', 'DIRECT_RFQ', 'rfq'] } }, { bidType: { in: ['RFQ', 'DIRECT_RFQ', 'rfq', 'Product'] } }] },
                isSeller ? { status: { in: ['OPEN', 'APPROVED', 'PUBLISHED', 'OPEN_FOR_BIDDING'] as any }, ...openDateFilter } : {}
              ],
              ...(isBuyer ? { buyerId: user.id } : {})
            }
          }).catch(() => 0),
          isSeller ? db.requirement.count({
            where: {
              procurementMethod: { in: ['RFQ', 'DIRECT_RFQ'] as any },
              status: { in: ['APPROVED', 'SOURCING'] as any },
              AND: [{ OR: [{ requiredBy: null }, { requiredBy: { gte: now } }] }]
            }
          }).catch(() => 0) : Promise.resolve(0),
          isSeller ? db.quoteRequest.count({
            where: {
              status: { in: ['PENDING', 'OPEN', 'ACTIVE'] as any }
            }
          }).catch(() => 0) : Promise.resolve(0)
        ]).then(([b, r, q]) => b + r + q).catch(() => 0),

        Promise.all([
          db.procurementBid.count({
            where: {
              AND: [
                { OR: [{ procurementType: { in: ['RFP', 'rfp'] } }, { bidType: { in: ['RFP', 'rfp'] } }] },
                isSeller ? { status: { in: ['OPEN', 'APPROVED', 'PUBLISHED', 'OPEN_FOR_BIDDING'] as any }, ...openDateFilter } : {}
              ],
              ...(isBuyer ? { buyerId: user.id } : {})
            }
          }).catch(() => 0),
          isSeller ? db.requirement.count({
            where: {
              procurementMethod: 'RFP' as any,
              status: { in: ['APPROVED', 'SOURCING'] as any },
              AND: [{ OR: [{ requiredBy: null }, { requiredBy: { gte: now } }] }]
            }
          }).catch(() => 0) : Promise.resolve(0)
        ]).then(([b, r]) => b + r).catch(() => 0),

        Promise.all([
          db.procurementBid.count({
            where: {
              AND: [
                { OR: [{ procurementType: { in: ['OPEN_TENDER', 'TENDER'] } }, { bidType: { in: ['OPEN_TENDER', 'TENDER'] } }] },
                isSeller ? { status: { in: ['OPEN', 'APPROVED', 'PUBLISHED', 'OPEN_FOR_BIDDING'] as any }, ...openDateFilter } : {}
              ],
              ...(isBuyer ? { buyerId: user.id } : {})
            }
          }).catch(() => 0),
          isSeller ? db.tender.count({
            where: {
              status: { in: ['published', 'bid_submission'] as any },
              OR: [{ closesAt: null }, { closesAt: { gt: now } }]
            }
          }).catch(() => 0) : Promise.resolve(0),
          isSeller ? db.requirement.count({
            where: {
              procurementMethod: { in: ['TENDER', 'OPEN_TENDER'] as any },
              status: { in: ['APPROVED', 'SOURCING'] as any },
              AND: [{ OR: [{ requiredBy: null }, { requiredBy: { gte: now } }] }]
            }
          }).catch(() => 0) : Promise.resolve(0)
        ]).then(([b, t, r]) => b + t + r).catch(() => 0),

        db.procurementBid.count({
          where: {
            AND: [
              { OR: [{ procurementType: 'LIMITED_TENDER' }, { bidType: 'LIMITED_TENDER' }] },
              isSeller ? { status: { in: ['OPEN', 'APPROVED', 'PUBLISHED', 'OPEN_FOR_BIDDING'] as any }, ...openDateFilter } : {}
            ],
            ...(isBuyer ? { buyerId: user.id } : {})
          }
        }).catch(() => 0),

        isSeller ? Promise.all([
          (async () => {
            const orgId = user.organizationId;
            const participantAuctionIds = await (db as any).auctionParticipant.findMany({
              where: {
                OR: [
                  ...(orgId ? [{ sellerOrgId: orgId }] : []),
                  { sellerUserId: user.id }
                ]
              },
              select: { auctionId: true }
            }).then((rows: any[]) => rows.map(r => r.auctionId)).catch(() => []);

            return participantAuctionIds.length > 0 ? (db as any).auction.count({
              where: {
                id: { in: participantAuctionIds },
                status: { notIn: ['CLOSED', 'CANCELLED', 'closed', 'cancelled'] },
                endTime: { gt: now }
              }
            }).catch(() => 0) : 0;
          })(),
          db.requirement.count({
            where: {
              procurementMethod: 'REVERSE_AUCTION' as any,
              status: { in: ['APPROVED', 'SOURCING'] as any },
              AND: [{ OR: [{ requiredBy: null }, { requiredBy: { gte: now } }] }]
            }
          }).catch(() => 0),
          db.procurementBid.count({
            where: {
              AND: [
                { OR: [{ procurementType: 'REVERSE_AUCTION' }, { bidType: 'REVERSE_AUCTION' }] },
                { status: { in: ['OPEN', 'APPROVED', 'PUBLISHED', 'OPEN_FOR_BIDDING'] as any }, ...openDateFilter }
              ]
            }
          }).catch(() => 0)
        ]).then(([a, r, b]) => a + r + b).catch(() => 0) : (
          (db as any).auction.count({
            where: {
              status: { notIn: ['CLOSED', 'CANCELLED', 'closed', 'cancelled'] },
              endTime: { gt: now },
              OR: [{ createdByUserId: user.id }, { buyerOrgId: user.organizationId || -1 }]
            }
          }).catch(() => 0)
        ),

        Promise.all([
          db.procurementBid.count({
            where: {
              AND: [
                { OR: [{ procurementType: 'RATE_CONTRACT' }, { bidType: 'RATE_CONTRACT' }] },
                isSeller ? { status: { in: ['OPEN', 'APPROVED', 'PUBLISHED', 'OPEN_FOR_BIDDING'] as any }, ...openDateFilter } : {}
              ],
              ...(isBuyer ? { buyerId: user.id } : {})
            }
          }).catch(() => 0),
          isSeller ? db.requirement.count({
            where: {
              procurementMethod: 'RATE_CONTRACT' as any,
              status: { in: ['APPROVED', 'SOURCING'] as any },
              AND: [{ OR: [{ requiredBy: null }, { requiredBy: { gte: now } }] }]
            }
          }).catch(() => 0) : Promise.resolve(0)
        ]).then(([b, r]) => b + r).catch(() => 0),

        isSeller ? Promise.all([
          db.procurementBidParticipation.count({
            where: user.organizationId
              ? { OR: [{ sellerId: user.id }, { seller: { organizationId: user.organizationId } }] }
              : { sellerId: user.id }
          }).catch(() => 0),
          db.requirementResponse.count({
            where: user.organizationId
              ? { OR: [{ sellerUserId: user.id }, { sellerOrganizationId: user.organizationId }] }
              : { sellerUserId: user.id }
          }).catch(() => 0)
        ]).then(([b, r]) => b + r).catch(() => 0) : Promise.resolve(0)
      ]);

      return {
        unreadNotifications,
        rfqsCount,
        rfpsCount,
        openTendersCount,
        invitationsCount,
        auctionsCount,
        rateContractsCount,
        bidsCount
      };
    }, 30);

    return res.json({ success: true, data: summary });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error?.message || 'Failed to load navigation summary' });
  }
});

export default router;
