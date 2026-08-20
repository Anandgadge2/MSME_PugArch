import '../src/config/env.js';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verify() {
  console.log('=== Verifying Jharsuguda Ecosystem Data ===');

  const buyers = await prisma.organization.findMany({
    where: {
      profile: {
        isLargeIndustry: true
      }
    },
    include: {
      profile: true,
      buyerRequirements: true
    }
  });

  console.log(`Found ${buyers.length} Large Industry Buyers:`);
  for (const b of buyers) {
    console.log(`  ✓ Buyer: ${b.organizationName} | Logo: ${b.profile?.logoUrl} | Banner: ${b.profile?.bannerUrl} | Requirements: ${b.buyerRequirements.length}`);
  }

  const sellers = await prisma.organization.findMany({
    where: {
      profile: {
        isBigMsme: true
      }
    },
    include: {
      profile: true,
      products: {
        include: {
          images: {
            include: {
              fileAsset: true
            }
          }
        }
      }
    }
  });

  console.log(`\nFound ${sellers.length} MSME Sellers:`);
  for (const s of sellers) {
    const prodCount = s.products.length;
    const imgUrls = s.products.map(p => p.images[0]?.fileAsset?.url).filter(Boolean);
    console.log(`  ✓ Seller: ${s.organizationName} | Logo: ${s.profile?.logoUrl} | Banner: ${s.profile?.bannerUrl} | Products: ${prodCount} | Product Imgs: ${imgUrls.length}`);
  }

  const totalRequirements = await prisma.buyerRequirement.count();
  const totalProducts = await prisma.product.count();
  console.log(`\nTotals in Database: ${totalRequirements} Buyer Requirements, ${totalProducts} Products across ${buyers.length} Buyers and ${sellers.length} Sellers.`);
}

verify()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
