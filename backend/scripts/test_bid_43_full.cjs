const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const bid = await prisma.procurementBid.findUnique({
    where: { id: 43 }
  });
  console.log('BID 43:');
  console.log('title:', bid.title);
  console.log('startDate:', bid.startDate);
  console.log('endDate:', bid.endDate);
  console.log('technicalPacket:', JSON.stringify(bid.technicalPacket, null, 2));

  // Also check buyerRequirement #43 or requirement with id 43
  const br = await prisma.buyerRequirement.findUnique({
    where: { id: 43 }
  }).catch(() => null);
  console.log('buyerRequirement 43:', br);
}

run()
  .then(() => process.exit(0))
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
