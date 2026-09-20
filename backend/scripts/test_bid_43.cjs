const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const bid = await prisma.procurementBid.findUnique({
    where: { id: 43 },
    include: {
      participations: {
        include: {
          seller: { include: { organization: true, sellerProfile: true } }
        }
      }
    }
  });
  console.log('BID 43 participations count:', bid?.participations?.length);
  bid?.participations?.forEach(p => {
    console.log(`Part ID: ${p.id}, sellerId: ${p.sellerId}, subStatus: ${p.submissionStatus}, seller:`, p.seller ? { id: p.seller.id, name: p.seller.name, orgId: p.seller.organizationId } : null);
  });
}

run()
  .then(() => process.exit(0))
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
