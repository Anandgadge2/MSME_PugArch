const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const pbs = await prisma.procurementBid.findMany({
    where: { buyerId: 4 },
    select: { id: true, bidNumber: true, title: true, status: true, estimatedValue: true }
  });
  console.log(`ProcurementBids for buyer 4 (${pbs.length}):`);
  pbs.forEach(p => console.log(`  ${p.id} | ${p.bidNumber} | ${p.title} | ${p.status} | ${p.estimatedValue}`));

  const reqs = await prisma.requirement.findMany({
    where: { buyerId: 4 },
    select: { id: true, requirementNumber: true, title: true, status: true }
  });
  console.log(`\nRequirements for buyer 4 (${reqs.length}):`);
  reqs.forEach(r => console.log(`  ${r.id} | ${r.requirementNumber} | ${r.title} | ${r.status}`));

  const contracts = await prisma.contract.findMany({
    select: { id: true, contractNumber: true, title: true, metadata: true }
  });
  console.log(`\nContracts (${contracts.length}):`);
  contracts.forEach(c => console.log(`  ${c.id} | ${c.contractNumber} | ${c.title} | buyerId: ${c.metadata?.buyerId}`));

  const auctions = await prisma.auction.findMany({
    select: { id: true, auctionCode: true, referenceNo: true, title: true, createdByUserId: true, buyerOrgId: true }
  });
  console.log(`\nAuctions (${auctions.length}):`);
  auctions.forEach(a => console.log(`  ${a.id} | ${a.auctionCode} | ${a.referenceNo} | ${a.title} | createdBy: ${a.createdByUserId} | buyerOrg: ${a.buyerOrgId}`));

  const buyerReqs = await prisma.buyerRequirement.findMany({
    where: { buyerId: 4 },
    select: { id: true, title: true, status: true }
  });
  console.log(`\nBuyerRequirements for buyer 4 (${buyerReqs.length}):`);
  buyerReqs.forEach(b => console.log(`  ${b.id} | ${b.title} | ${b.status}`));
}

check()
  .then(() => process.exit(0))
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
