const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const p = await prisma.procurementBidParticipation.findUnique({ where: { id: 18 } });
    console.log(JSON.stringify(p, null, 2));
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
