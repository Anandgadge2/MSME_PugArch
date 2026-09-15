const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkMoreLinks() {
  const pos = await prisma.purchaseOrder.findMany({
    where: {
      OR: [
        { contractId: { in: [1, 2] } },
        { poNumber: { contains: '17861' } },
        { poNumber: { contains: 'REQ-17970' } },
        { poNumber: { contains: 'REQ-98205' } },
        { poNumber: { contains: 'REQ-99751' } },
        { poNumber: { contains: 'REQ-60496' } },
        { poNumber: { contains: 'REQ-12876' } },
        { poNumber: { contains: 'REQ-98107' } },
        { poNumber: { contains: 'REQ-39620' } },
        { poNumber: { contains: 'REQ-86638' } },
        { poNumber: { contains: 'REQ-46334' } },
        { poNumber: { contains: '2026-00005' } }
      ]
    },
    select: { id: true, poNumber: true, sourceType: true, sourceId: true }
  });
  console.log('Linked POs by number/contract:', pos);
}

checkMoreLinks()
  .then(() => process.exit(0))
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
