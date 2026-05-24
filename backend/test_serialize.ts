import { PrismaClient } from '@prisma/client';
import { maskSensitive } from './src/utils/maskSensitive.js';

const prisma = new PrismaClient();

async function main() {
  try {
    const product = await prisma.product.findFirst({
      where: { name: 'Laptop' }
    });
    if (product) {
      console.log('ORIGINAL PRODUCT:', product);
      const masked = maskSensitive(product);
      console.log('MASKED PRODUCT:', masked);
      console.log('STRINGIFIED MASKED PRODUCT:', JSON.stringify(masked));
    } else {
      console.log('No laptop product found');
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
