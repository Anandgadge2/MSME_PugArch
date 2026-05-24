import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  try {
    const buyer = await prisma.user.findFirst({
      where: { name: 'Iron Man' }
    });
    if (!buyer) {
      console.log('No user Iron Man found');
      return;
    }
    console.log('Iron Man user:', buyer);

    const directPurchases = await prisma.directPurchase.findMany({
      where: { buyerId: buyer.id },
      include: { requirement: { include: { items: true } } }
    });
    console.log('Iron Man Direct Purchases:', JSON.stringify(directPurchases, null, 2));

    const quoteRequests = await prisma.quoteRequest.findMany({
      where: { buyerId: buyer.id }
    });
    console.log('Iron Man Quote Requests:', JSON.stringify(quoteRequests, null, 2));

  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
