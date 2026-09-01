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
      const openDateFilter = { OR: [{ endDate: null }, { endDate: { gt: now } }] };

      const [
        unreadNotifications,
        rfqsCount,
        rfpsCount,
        openTendersCount,
        invitationsCount,
        auctionsCount,
        rateContractsCount
      ] = await Promise.all([
        db.notification.count({
          where: { userId: user.id, isRead: false }
        }).catch(() => 0),

        Promise.all([
          db.procurementBid.count({
            where: {
              AND: [
                { OR: [{ procurementType: 'RFQ' }, { bidType: 'RFQ' }] },
                isSeller ? { status: { in: ['OPEN', 'APPROVED', 'PUBLISHED'] }, ...openDateFilter } : {}
              ],
              ...(isBuyer ? { buyerId: user.id } : {})
            }
          }).catch(() => 0),
          isSeller ? db.requirement.count({
            where: {
              procurementMethod: 'RFQ' as any,
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
                { OR: [{ procurementType: 'RFP' }, { bidType: 'RFP' }] },
                isSeller ? { status: { in: ['OPEN', 'APPROVED', 'PUBLISHED'] as any }, ...openDateFilter } : {}
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
                isSeller ? { status: { in: ['OPEN', 'APPROVED', 'PUBLISHED'] as any }, ...openDateFilter } : {}
              ],
              ...(isBuyer ? { buyerId: user.id } : {})
            }
          }).catch(() => 0),
          isSeller ? db.tender.count({
            where: {
              status: { in: ['published', 'active', 'open'] as any },
              OR: [{ closesAt: null }, { closesAt: { gt: now } }]
            }
          }).catch(() => 0) : Promise.resolve(0),
          isSeller ? db.requirement.count({
            where: {
              procurementMethod: 'TENDER' as any,
              status: { in: ['APPROVED', 'SOURCING'] as any },
              AND: [{ OR: [{ requiredBy: null }, { requiredBy: { gte: now } }] }]
            }
          }).catch(() => 0) : Promise.resolve(0)
        ]).then(([b, t, r]) => b + t + r).catch(() => 0),

        db.procurementBid.count({
          where: {
            AND: [
              { OR: [{ procurementType: 'LIMITED_TENDER' }, { bidType: 'LIMITED_TENDER' }] },
              isSeller ? { status: { in: ['OPEN', 'APPROVED', 'PUBLISHED'] as any }, ...openDateFilter } : {}
            ],
            ...(isBuyer ? { buyerId: user.id } : {})
          }
        }).catch(() => 0),

        ((db as any).reverseAuction ? (db as any).reverseAuction.count({
          where: {
            status: { in: ['ACTIVE', 'PUBLISHED', 'OPEN', 'SCHEDULED', 'LIVE', 'active', 'live', 'open', 'scheduled'] },
            ...(isBuyer ? { buyerId: user.id } : {})
          }
        }) : (db as any).auction ? (db as any).auction.count({
          where: {
            status: { in: ['ACTIVE', 'PUBLISHED', 'OPEN', 'SCHEDULED', 'LIVE', 'active', 'live', 'open', 'scheduled'] },
            ...(isBuyer ? { buyerId: user.id } : {})
          }
        }) : Promise.resolve(0)).catch(() => 0),

        Promise.all([
          db.procurementBid.count({
            where: {
              AND: [
                { OR: [{ procurementType: 'RATE_CONTRACT' }, { bidType: 'RATE_CONTRACT' }] },
                isSeller ? { status: { in: ['OPEN', 'APPROVED', 'PUBLISHED'] as any }, ...openDateFilter } : {}
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
        ]).then(([b, r]) => b + r).catch(() => 0)
      ]);

      return {
        unreadNotifications,
        rfqsCount,
        rfpsCount,
        openTendersCount,
        invitationsCount,
        auctionsCount,
        rateContractsCount
      };
    }, 30);

    return res.json({ success: true, data: summary });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error?.message || 'Failed to load navigation summary' });
  }
});

export default router;
