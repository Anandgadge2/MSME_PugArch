import prisma from '../src/lib/prisma.js';

const BANNER_FIXES: Record<string, string> = {
  'https://storage.googleapis.com/jsgsmile1/banners/steel-fabrication-plant.jpg': 'https://storage.googleapis.com/jsgsmile1/banners/jharsuguda-steel-industry.jpg',
  'https://storage.googleapis.com/jsgsmile1/banners/smart-buyer-procurement.jpg': 'https://storage.googleapis.com/jsgsmile1/banners/digital-procurement.jpg'
};

async function fixBannerUrls() {
  console.log('🔧 Checking and updating banner image URLs in database...');
  
  const banners = await (prisma as any).marketplaceBanner.findMany();
  let updatedCount = 0;

  for (const b of banners) {
    if (b.imageUrl && BANNER_FIXES[b.imageUrl]) {
      const newUrl = BANNER_FIXES[b.imageUrl];
      await (prisma as any).marketplaceBanner.update({
        where: { id: b.id },
        data: { imageUrl: newUrl }
      });
      console.log(`  ✓ Updated Banner [${b.id}] "${b.title.split('\n')[0]}": ${b.imageUrl} -> ${newUrl}`);
      updatedCount++;
    }
  }

  console.log(`🎉 Banner URL fix complete! Updated ${updatedCount} banner(s).`);
}

fixBannerUrls()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
