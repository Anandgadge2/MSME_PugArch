import prisma from '../src/lib/prisma.js';

const DEFAULT_PORTAL_BANNERS = [
  {
    title: 'Steel & Metal Fabrication\nPowering Jharsuguda Industry',
    subtitle: 'Source verified steel, TMT bars, industrial castings, and metal components from local manufacturers across the district.',
    imageUrl: 'https://storage.googleapis.com/jsgsmile1/banners/jharsuguda-steel-industry.jpg',
    ctaText: 'Browse Steel & Metal',
    ctaLink: '#products',
    displayOrder: 1,
    priority: 100,
    bannerType: 'DEFAULT_ADMIN' as const,
    status: 'ACTIVE' as const,
    displayLocation: 'HOME_HERO' as const,
    isActive: true,
    durationDays: 30
  },
  {
    title: 'Simplified\ne-Procurement for Smart Buyers',
    subtitle: 'Compare quotations, track orders, and manage your procurement from verified district suppliers — all in one dashboard.',
    imageUrl: 'https://storage.googleapis.com/jsgsmile1/banners/digital-procurement.jpg',
    ctaText: 'Start Buying',
    ctaLink: '/buyer/register',
    displayOrder: 2,
    priority: 90,
    bannerType: 'DEFAULT_ADMIN' as const,
    status: 'ACTIVE' as const,
    displayLocation: 'HOME_HERO' as const,
    isActive: true,
    durationDays: 30
  },
  {
    title: 'Odisha Handicrafts & SHG Products\nNow Online',
    subtitle: 'Sambalpuri textiles, Dhokra brass, terracotta, tribal jewelry — discover authentic Odisha craftsmanship from self-help groups.',
    imageUrl: 'https://storage.googleapis.com/jsgsmile1/banners/odisha-handicraft-shg.jpg',
    ctaText: 'Explore SHG Products',
    ctaLink: '#categories',
    displayOrder: 3,
    priority: 80,
    bannerType: 'DEFAULT_ADMIN' as const,
    status: 'ACTIVE' as const,
    displayLocation: 'HOME_HERO' as const,
    isActive: true,
    durationDays: 30
  },
  {
    title: 'Industrial Powerhouse\nof Western Odisha',
    subtitle: 'Thermal power, aluminum smelting, coal logistics — connecting the industrial backbone of Jharsuguda with verified digital procurement.',
    imageUrl: 'https://storage.googleapis.com/jsgsmile1/banners/thermal-power-plant.jpg',
    ctaText: 'Explore Ecosystem',
    ctaLink: '#categories',
    displayOrder: 4,
    priority: 70,
    bannerType: 'DEFAULT_ADMIN' as const,
    status: 'ACTIVE' as const,
    displayLocation: 'HOME_HERO' as const,
    isActive: true,
    durationDays: 30
  },
  {
    title: 'Grow Your Business\nReach Enterprise Buyers',
    subtitle: 'List your products, get GST & Udyam verified, receive orders directly from government agencies and industrial conglomerates.',
    imageUrl: 'https://storage.googleapis.com/jsgsmile1/banners/seller-mobile-orders.jpg',
    ctaText: 'Register as Seller',
    ctaLink: '/seller/register',
    displayOrder: 5,
    priority: 60,
    bannerType: 'DEFAULT_ADMIN' as const,
    status: 'ACTIVE' as const,
    displayLocation: 'HOME_HERO' as const,
    isActive: true,
    durationDays: 30
  },
  {
    title: 'Aluminum & Heavy Industry\nSupply Chain Hub',
    subtitle: 'Refractories, chemicals, electrical components, hydraulics — everything major industries need, sourced from verified local suppliers.',
    imageUrl: 'https://storage.googleapis.com/jsgsmile1/banners/vedanta-industrial-hub.jpg',
    ctaText: 'Find Suppliers',
    ctaLink: '#products',
    displayOrder: 6,
    priority: 50,
    bannerType: 'DEFAULT_ADMIN' as const,
    status: 'ACTIVE' as const,
    displayLocation: 'HOME_HERO' as const,
    isActive: true,
    durationDays: 30
  },
  {
    title: 'Empowering Local MSMEs\nAcross Jharsuguda',
    subtitle: 'Connecting micro and small manufacturing units with large industrial buyers through transparent procurement contracts.',
    imageUrl: 'https://storage.googleapis.com/jsgsmile1/banners/empowering-local-msmes.jpg',
    ctaText: 'Explore Marketplace',
    ctaLink: '#products',
    displayOrder: 7,
    priority: 40,
    bannerType: 'DEFAULT_ADMIN' as const,
    status: 'ACTIVE' as const,
    displayLocation: 'HOME_HERO' as const,
    isActive: true,
    durationDays: 30
  },
  {
    title: 'Enterprise Procurement Made Transparent',
    subtitle: 'Quality assurance, verified seller credentials, GST checks, and automated price comparison in one place.',
    imageUrl: 'https://storage.googleapis.com/jsgsmile1/banners/buyer-benefits-banner.jpg',
    ctaText: 'Register as Buyer',
    ctaLink: '/buyer/register',
    displayOrder: 8,
    priority: 10,
    bannerType: 'DEFAULT_ADMIN' as const,
    status: 'ACTIVE' as const,
    displayLocation: 'HOME_HERO' as const,
    isActive: true,
    durationDays: 30
  }
];

async function seedBannersIfEmpty() {
  console.log('🔍 Checking existing MarketplaceBanner records...');
  
  const count = await (prisma as any).marketplaceBanner.count();
  console.log(`📊 Found ${count} existing banner records.`);

  if (count > 0) {
    console.log('✅ Banners already exist in the database. No action taken to avoid modifying live data.');
    return;
  }

  console.log('🌱 Database has 0 banners. Seeding default active admin banners...');

  for (const b of DEFAULT_PORTAL_BANNERS) {
    const created = await (prisma as any).marketplaceBanner.create({
      data: b
    });
    console.log(`  ✓ Created banner [${created.id}]: "${created.title.replace(/\n/g, ' ')}"`);
  }

  console.log(`🎉 Successfully seeded ${DEFAULT_PORTAL_BANNERS.length} active banners!`);
}

seedBannersIfEmpty()
  .catch((err) => {
    console.error('❌ Failed to seed banners:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
