const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const reqs = await prisma.buyerRequirement.findMany({
    select: {
      id: true,
      title: true,
      requirementType: true,
      status: true,
      lastDate: true,
      createdAt: true,
      responses: {
        select: {
          id: true,
          sellerUserId: true,
          sellerOrganizationId: true,
          status: true,
        }
      }
    }
  });
  console.log('ALL BUYER REQUIREMENTS:');
  reqs.forEach(r => {
    console.log(`ID: ${r.id} | Type: ${r.requirementType} | Title: "${r.title}" | Status: ${r.status} | LastDate: ${r.lastDate} | Responses: ${r.responses.length}`);
  });
}

run()
  .then(() => process.exit(0))
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
