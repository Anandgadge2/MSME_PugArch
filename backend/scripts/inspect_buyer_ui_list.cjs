const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Let's import getBuyerProcurementsData from phase4.routes or reimplement the exact query logic
async function run() {
  // Let's check how many total records are shown in /api/buyer/my-procurements
  const BUYER_ID = 4;
  const BUYER_ORG_ID = 1;

  const [procurementBids, requirements, rateContracts, auctions] = await Promise.all([
    prisma.procurementBid.findMany({
      where: { buyerId: BUYER_ID },
      orderBy: { createdAt: 'desc' },
      select: { id: true, bidNumber: true, title: true, status: true, estimatedValue: true, category: true, createdAt: true }
    }),
    prisma.requirement.findMany({
      where: { buyerId: BUYER_ID },
      orderBy: { createdAt: 'desc' },
      select: { id: true, requirementNumber: true, title: true, status: true, estimatedValue: true, procurementMethod: true, categoryId: true, createdAt: true, payload: true }
    }),
    prisma.contract.findMany({
      where: { contractType: 'RATE_CONTRACT' },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, contractNumber: true, title: true, status: true, value: true, metadata: true, createdAt: true }
    }),
    prisma.auction.findMany({
      where: {
        OR: [
          { createdByUserId: BUYER_ID },
          { buyerOrgId: BUYER_ORG_ID }
        ]
      },
      select: { id: true, auctionCode: true, referenceNo: true, title: true, status: true, startPrice: true, linkedRequirementId: true, createdAt: true }
    })
  ]);

  console.log('=== PROCUREMENT BIDS ===');
  procurementBids.forEach(b => console.log(`PB #${b.id} | ${b.bidNumber} | "${b.title}" | ${b.status} | val: ${b.estimatedValue}`));

  console.log('\n=== CONTRACTS (RATE CONTRACTS) ===');
  rateContracts.forEach(c => console.log(`Contract #${c.id} | ${c.contractNumber} | "${c.title}" | ${c.status} | val: ${c.value} | meta buyerId: ${c.metadata?.buyerId}`));

  console.log('\n=== AUCTIONS ===');
  auctions.forEach(a => console.log(`Auction #${a.id} | ${a.auctionCode} | ref: ${a.referenceNo} | "${a.title}" | ${a.status} | linkedReqId: ${a.linkedRequirementId}`));

  console.log('\n=== REQUIREMENTS (non-draft) ===');
  requirements.filter(r => r.status !== 'DRAFT').forEach(r => console.log(`Req #${r.id} | ${r.requirementNumber} | "${r.title}" | ${r.status} | method: ${r.procurementMethod}`));
}

run()
  .then(() => process.exit(0))
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
