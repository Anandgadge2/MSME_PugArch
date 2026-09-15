import prisma from '../src/lib/prisma.js';

async function main() {
  const req = await prisma.requirement.findFirst({
    where: { requirementNumber: 'RFQ-2026-52898' }
  });
  console.log('Requirement 15:');
  console.log('createdAt:', req?.createdAt);
  console.log('updatedAt:', req?.updatedAt);
  console.log('approvedAt:', req?.approvedAt);
  console.log('publishedAt:', (req as any)?.publishedAt);
  console.log('payload.schedule:', JSON.stringify((req?.payload as any)?.schedule, null, 2));

  const bid = await prisma.procurementBid.findFirst({
    where: { bidNumber: 'RFQ-2026-52898' }
  });
  console.log('ProcurementBid 16:');
  console.log('createdAt:', bid?.createdAt);
  console.log('updatedAt:', bid?.updatedAt);
  console.log('startDate:', bid?.startDate);
  console.log('endDate:', bid?.endDate);
  console.log('technicalPacket.schedule:', JSON.stringify((bid?.technicalPacket as any)?.schedule, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
