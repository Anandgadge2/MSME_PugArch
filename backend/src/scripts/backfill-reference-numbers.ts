import prisma from '../lib/prisma.js';
import { logger } from '../config/logger.js';
import { formatRefId, isValidCanonicalRef } from '../utils/refIdUtils.js';

async function backfillReferenceNumbers() {
  logger.info('[BACKFILL] Starting canonical reference numbers backfill...');
  const currentYear = new Date().getFullYear();

  // 1. Backfill BuyerRequirement records where referenceNumber is NULL or non-canonical
  const buyerReqs = await prisma.buyerRequirement.findMany({
    select: { id: true, referenceNumber: true, requirementType: true, createdAt: true },
    orderBy: { id: 'asc' },
  });

  logger.info(`[BACKFILL] Found ${buyerReqs.length} BuyerRequirement records to check`);
  let buyerReqUpdated = 0;

  for (const req of buyerReqs) {
    if (!req.referenceNumber || !isValidCanonicalRef(req.referenceNumber)) {
      const year = req.createdAt ? new Date(req.createdAt).getFullYear() : currentYear;
      const canonicalRef = formatRefId('RFQ', req.id, null, 'RFQ', year);

      await prisma.buyerRequirement.update({
        where: { id: req.id },
        data: { referenceNumber: canonicalRef },
      });
      buyerReqUpdated++;
    }
  }
  logger.info(`[BACKFILL] Updated ${buyerReqUpdated} BuyerRequirement records with canonical referenceNumbers`);

  // 2. Backfill ProcurementBid records where bidNumber is non-canonical or legacy
  const bids = await prisma.procurementBid.findMany({
    select: { id: true, bidNumber: true, procurementType: true, bidType: true, createdAt: true },
    orderBy: { id: 'asc' },
  });

  logger.info(`[BACKFILL] Found ${bids.length} ProcurementBid records to check`);
  let bidsUpdated = 0;

  for (const bid of bids) {
    if (!bid.bidNumber || !isValidCanonicalRef(bid.bidNumber)) {
      const year = bid.createdAt ? new Date(bid.createdAt).getFullYear() : currentYear;
      const canonicalRef = formatRefId(bid.procurementType || 'RFQ', bid.id, bid.bidNumber, bid.bidType, year);

      // Check for collision before updating
      const exists = await prisma.procurementBid.findUnique({ where: { bidNumber: canonicalRef } });
      if (!exists || exists.id === bid.id) {
        await prisma.procurementBid.update({
          where: { id: bid.id },
          data: { bidNumber: canonicalRef },
        });
        bidsUpdated++;
      }
    }
  }
  logger.info(`[BACKFILL] Updated ${bidsUpdated} ProcurementBid records with canonical bidNumbers`);

  // 3. Seed initial EntitySequence table with current maximums
  const maxBidId = bids.reduce((max, b) => Math.max(max, b.id), 0);
  const maxReqId = buyerReqs.reduce((max, r) => Math.max(max, r.id), 0);
  const initialMax = Math.max(maxBidId, maxReqId, 50);

  const prefixes = ['RFQ', 'RFP', 'TND', 'LTND', 'RC', 'DP', 'RA', 'PO'];
  for (const pfx of prefixes) {
    const seqId = `${pfx}-${currentYear}`;
    await prisma.entitySequence.upsert({
      where: { id: seqId },
      update: {},
      create: {
        id: seqId,
        prefix: pfx,
        year: currentYear,
        lastVal: initialMax,
      },
    });
  }

  logger.info('[BACKFILL] Completed reference number backfill and initialized EntitySequence table.');
}

backfillReferenceNumbers()
  .then(() => {
    console.log('Backfill completed successfully');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Backfill failed:', err);
    process.exit(1);
  });
