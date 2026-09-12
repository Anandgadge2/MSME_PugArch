import prisma from '../src/lib/prisma.js';
import { seedBannersIfEmpty as seedBannersService, DEFAULT_PORTAL_BANNERS } from '../src/services/banner-seed.service.js';

export { DEFAULT_PORTAL_BANNERS };

export async function seedBannersIfEmpty(syncAll = false) {
  console.log('🔍 Checking existing MarketplaceBanner records...');
  const count = await (prisma as any).marketplaceBanner.count();
  console.log(`📊 Found ${count} existing banner records.`);
  await seedBannersService(syncAll);
  const finalCount = await (prisma as any).marketplaceBanner.count();
  console.log(`🎉 Banner check/seed complete. Total banners: ${finalCount}`);
}

// If run directly from CLI
if (process.argv[1]?.includes('seed-banners-if-empty')) {
  seedBannersIfEmpty(true)
    .catch((err) => {
      console.error('❌ Failed to seed banners:', err);
      process.exit(1);
    })
    .finally(async () => {
      await (prisma as any).$disconnect();
    });
}
