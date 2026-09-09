const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const TITLES = [
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

async function findExactRecords() {
  console.log('=== EXACT MATCHING RECORDS ===');

  // 1. ProcurementBid
  const pbs = await prisma.procurementBid.findMany({
    where: {
      buyerId: 4,
      OR: [
        { id: { in: [1, 2, 3, 4, 5, 6, 7, 8, 11] } },
        ...TITLES.map(t => ({ title: { equals: t, mode: 'insensitive' } }))
      ]
    },
    select: { id: true, bidNumber: true, title: true }
  });
  console.log(`ProcurementBids (${pbs.length}):`, pbs);

  // 2. Requirement
  const reqs = await prisma.requirement.findMany({
    where: {
      buyerId: 4,
      OR: [
        { id: { in: [1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 12, 13, 14, 19] } },
        ...TITLES.map(t => ({ title: { equals: t, mode: 'insensitive' } }))
      ]
    },
    select: { id: true, requirementNumber: true, title: true, status: true }
  });
  console.log(`Requirements (${reqs.length}):`, reqs);

  // 3. Contract
  const contracts = await prisma.contract.findMany({
    where: {
      OR: [
        { id: { in: [1, 2] } },
        ...TITLES.map(t => ({ title: { equals: t, mode: 'insensitive' } }))
      ]
    },
    select: { id: true, contractNumber: true, title: true }
  });
  console.log(`Contracts (${contracts.length}):`, contracts);

  // 4. Auction
  const auctions = await prisma.auction.findMany({
    where: {
      OR: [
        { id: 1 },
        ...TITLES.map(t => ({ title: { equals: t, mode: 'insensitive' } }))
      ]
    },
    select: { id: true, auctionCode: true, referenceNo: true, title: true }
  });
  console.log(`Auctions (${auctions.length}):`, auctions);

  // 5. BuyerRequirement
  const buyerReqs = await prisma.buyerRequirement.findMany({
    where: {
      createdById: 4,
      OR: TITLES.map(t => ({ title: { equals: t, mode: 'insensitive' } }))
    },
    select: { id: true, title: true, status: true }
  });
  console.log(`BuyerRequirements (${buyerReqs.length}):`, buyerReqs);

  // 6. PurchaseOrders linked to these bids/awards
  const bidIds = pbs.map(b => b.id);
  const awards = await prisma.procurementBidAward.findMany({
    where: { bidId: { in: bidIds } },
    select: { id: true, bidId: true }
  });
  const awardIds = awards.map(a => a.id);

  const pos = await prisma.purchaseOrder.findMany({
    where: {
      OR: [
        { sourceType: 'procurementBid', sourceId: { in: bidIds } },
        { sourceType: 'procurement_bid_award', sourceId: { in: awardIds } },
        { contractId: { in: contracts.map(c => c.id) } }
      ]
    },
    select: { id: true, poNumber: true, sourceType: true, sourceId: true }
  });
  console.log(`PurchaseOrders (${pos.length}):`, pos);
}

findExactRecords()
  .then(() => process.exit(0))
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
