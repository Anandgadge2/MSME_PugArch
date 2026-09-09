const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
async function run() {
  // Check all procurements for user 4
  const bids = await p.procurementBid.findMany({
    where: { buyerId: 4 },
    select: { id: true, bidNumber: true, title: true, status: true, createdAt: true },
    orderBy: { id: 'asc' },
  });
  console.log('=== Current ProcurementBid records for buyer (user id=4) ===');
  console.log('Total:', bids.length);
  bids.forEach(b => console.log(`  id=${b.id} [${b.bidNumber}] "${b.title}" status=${b.status}`));

  // Check PurchaseOrders linked via BidAward
  const bidIds = bids.map(b => b.id);
  if (bidIds.length > 0) {
    const awards = await p.procurementBidAward.findMany({
      where: { bidId: { in: bidIds } },
      select: { bidId: true, purchaseOrderId: true, purchaseOrderNumber: true },
    });
    console.log('\n=== PurchaseOrders linked to these bids ===');
    awards.forEach(a => console.log(`  bidId=${a.bidId} => PO id=${a.purchaseOrderId} number=${a.purchaseOrderNumber}`));
  }

  // Check BuyerRequirement records
  const buyerReqs = await p.buyerRequirement.findMany({
    where: { buyerId: 4 },
    select: { id: true, title: true, status: true },
    orderBy: { id: 'asc' },
  });
  console.log('\n=== BuyerRequirement records for buyer (user id=4) ===');
  console.log('Total:', buyerReqs.length);
  buyerReqs.slice(0, 20).forEach(r => console.log(`  id=${r.id} "${r.title}" status=${r.status}`));
  if (buyerReqs.length > 20) console.log(`  ... and ${buyerReqs.length - 20} more`);

  await p.$disconnect();
}
run().catch(async (e) => { console.error(e.message); await p.$disconnect(); process.exit(1); });
