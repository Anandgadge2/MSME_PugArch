const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const product = await prisma.product.findUnique({
    where: { id: 27 },
    include: {
      category: true,
      seller: { include: { sellerProfile: true } },
      organization: { include: { profile: true } },
      images: { include: { fileAsset: true } },
      specifications: true,
      certifications: { include: { fileAsset: true } },
      catalogueFiles: { include: { fileAsset: true } }
    }
  });
  console.log(JSON.stringify(product, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
