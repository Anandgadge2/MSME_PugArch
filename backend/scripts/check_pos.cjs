const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function check() {
  const awards = await prisma.procurementBidAward.findMany({
    where: { id: { in: [1, 8, 9] } },
    select: { id: true, bidId: true, awardStatus: true }
  });
  console.log('Awards:', awards);
  const targetBids = await prisma.procurementBid.findMany({
    where: { id: { in: awards.map(a => a.bidId) } },
    select: { id: true, bidNumber: true, title: true }
  });
  console.log('Target Bids for these awards:', targetBids);
}
check()
  .then(() => process.exit(0))
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
