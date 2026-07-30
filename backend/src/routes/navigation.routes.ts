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
      const isSeller = user.role === 'seller';
      const isBuyer = user.role === 'buyer';

      const [
        unreadNotifications,
        rfqsCount,
        rfpsCount,
        openTendersCount,
        invitationsCount,
        auctionsCount
      ] = await Promise.all([
        db.notification.count({
          where: { userId: user.id, isRead: false }
        }).catch(() => 0),

        db.procurementBid.count({
          where: {
            procurementType: 'RFQ',
            ...(isSeller ? { status: { in: ['OPEN', 'APPROVED'] } } : {}),
            ...(isBuyer ? { buyerId: user.id } : {})
          }
        }).catch(() => 0),

        db.procurementBid.count({
          where: {
            procurementType: 'RFP',
            ...(isSeller ? { status: { in: ['OPEN', 'APPROVED'] } } : {}),
            ...(isBuyer ? { buyerId: user.id } : {})
          }
        }).catch(() => 0),

        db.procurementBid.count({
          where: {
            procurementType: { in: ['OPEN_TENDER', 'TENDER'] },
            ...(isSeller ? { status: { in: ['OPEN', 'APPROVED'] } } : {}),
            ...(isBuyer ? { buyerId: user.id } : {})
          }
        }).catch(() => 0),

        db.procurementBid.count({
          where: {
            procurementType: 'LIMITED_TENDER',
            ...(isSeller ? { status: { in: ['OPEN', 'APPROVED'] } } : {}),
            ...(isBuyer ? { buyerId: user.id } : {})
          }
        }).catch(() => 0),

        ((db as any).reverseAuction ? (db as any).reverseAuction.count({
          where: {
            status: { in: ['ACTIVE', 'PUBLISHED', 'OPEN'] },
            ...(isBuyer ? { buyerId: user.id } : {})
          }
        }) : (db as any).auction ? (db as any).auction.count({
          where: {
            status: { in: ['ACTIVE', 'PUBLISHED', 'OPEN'] },
            ...(isBuyer ? { buyerId: user.id } : {})
          }
        }) : Promise.resolve(0)).catch(() => 0)
      ]);

      return {
        unreadNotifications,
        rfqsCount,
        rfpsCount,
        openTendersCount,
        invitationsCount,
        auctionsCount
      };
    }, 30);

    return res.json({ success: true, data: summary });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error?.message || 'Failed to load navigation summary' });
  }
});

export default router;
