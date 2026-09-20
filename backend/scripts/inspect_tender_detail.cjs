const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const pbs = await prisma.procurementBid.findMany({
    select: {
      id: true,
      bidNumber: true,
      title: true,
      status: true,
      endDate: true,
      startDate: true,
      canonicalMethod: true,
      participations: {
        select: {
          id: true,
          sellerId: true,
          submissionStatus: true,
          seller: { select: { id: true, organizationId: true, name: true } }
        }
      }
    }
  });
  console.log('PROCUREMENT BIDS:', JSON.stringify(pbs, null, 2));
}

run()
  .then(() => process.exit(0))
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
