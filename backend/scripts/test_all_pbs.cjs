const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const bids = await prisma.procurementBid.findMany({
    select: {
      id: true,
      bidNumber: true,
      title: true,
      canonicalMethod: true,
      status: true,
      startDate: true,
      endDate: true,
      participations: {
        select: {
          id: true,
          sellerId: true,
          submissionStatus: true
        }
      }
    }
  });
  console.log('ALL PROCUREMENT BIDS:');
  bids.forEach(b => {
    console.log(`ID: ${b.id} | Num: ${b.bidNumber} | Method: ${b.canonicalMethod} | Title: "${b.title}" | Status: ${b.status} | EndDate: ${b.endDate} | Parts: ${b.participations.length}`);
  });
}

run()
  .then(() => process.exit(0))
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
