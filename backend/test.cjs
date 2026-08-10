const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const parts7 = await prisma.procurementBidParticipation.findMany({ where: { bidId: 7 } });
  console.log("BID 7 PARTS:");
  console.log(JSON.stringify(parts7.map(p => ({ lineItems: p.lineItems, ack: p.acknowledgement, rawAmount: p.quotedAmount })), null, 2));

  const parts9 = await prisma.procurementBidParticipation.findMany({ where: { bidId: 9 } });
  console.log("BID 9 PARTS:");
  console.log(JSON.stringify(parts9.map(p => ({ lineItems: p.lineItems, ack: p.acknowledgement, rawAmount: p.quotedAmount })), null, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect());
