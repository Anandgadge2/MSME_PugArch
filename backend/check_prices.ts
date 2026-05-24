import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    const products = await prisma.product.findMany({
      take: 10,
      select: {
        id: true,
        name: true,
        price: true,
        status: true,
      }
    });
    console.log('PRODUCTS IN DB:', JSON.stringify(products, null, 2));

    const services = await prisma.service.findMany({
      take: 10,
      select: {
        id: true,
        name: true,
        basePrice: true,
        status: true,
      }
    });
    console.log('SERVICES IN DB:', JSON.stringify(services, null, 2));
  } catch (error) {
    console.error('Error fetching prices:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
