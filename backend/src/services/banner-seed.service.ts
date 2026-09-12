import prisma from '../lib/prisma.js';

export const DEFAULT_PORTAL_BANNERS = [
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
    subtitle: 'Sambalpuri textiles, Dhokra brass metal crafts, terracotta, and tribal artistry — discover authentic Odisha craftsmanship from self-help groups.',
    imageUrl: 'https://storage.googleapis.com/jsgsmile1/banners/odisha-handicraft-shg.jpg',
    ctaText: 'Explore SHG Products',
    ctaLink: '#categories',
    displayOrder: 3,
    priority: 85,
    bannerType: 'DEFAULT_ADMIN' as const,
    status: 'ACTIVE' as const,
    displayLocation: 'HOME_HERO' as const,
    isActive: true,
    durationDays: 30
  },
  {
    title: 'Aluminum & Heavy Industry\nSupply Chain Hub',
    subtitle: 'Refractories, industrial chemicals, electrical components, hydraulics, and conveyor equipment — sourced from verified local suppliers.',
    imageUrl: 'https://storage.googleapis.com/jsgsmile1/banners/vedanta-industrial-hub.jpg',
    ctaText: 'Find Suppliers',
    ctaLink: '#products',
    displayOrder: 4,
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
    displayOrder: 5,
    priority: 75,
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
    displayOrder: 6,
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
    displayOrder: 7,
    priority: 65,
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
    priority: 60,
    bannerType: 'DEFAULT_ADMIN' as const,
    status: 'ACTIVE' as const,
    displayLocation: 'HOME_HERO' as const,
    isActive: true,
    durationDays: 30
  },
  {
    title: 'JSGSMILE Portal\nDistrict MSME Digital Gateway',
    subtitle: 'The official digital procurement gateway uniting MSMEs, large industries, and government departments under one transparent platform.',
    imageUrl: 'https://storage.googleapis.com/jsgsmile1/banners/jsgsmile-portal-overview.jpg',
    ctaText: 'Explore Portal',
    ctaLink: '#about',
    displayOrder: 9,
    priority: 55,
    bannerType: 'DEFAULT_ADMIN' as const,
    status: 'ACTIVE' as const,
    displayLocation: 'HOME_HERO' as const,
    isActive: true,
    durationDays: 30
  },
  {
    title: 'Integrated B2B Ecosystem\nFor Buyers & Sellers',
    subtitle: 'Real-time RFQ bidding, reverse auctions, purchase order generation, digital delivery notes, and verified invoice tracking in one place.',
    imageUrl: 'https://storage.googleapis.com/jsgsmile1/banners/portal-features-ecosystem.jpg',
    ctaText: 'View Categories',
    ctaLink: '#categories',
    displayOrder: 10,
    priority: 50,
    bannerType: 'DEFAULT_ADMIN' as const,
    status: 'ACTIVE' as const,
    displayLocation: 'HOME_HERO' as const,
    isActive: true,
    durationDays: 30
  },
  {
    title: 'Unlock Enterprise Growth\nDirect Access to Anchor Buyers',
    subtitle: 'Expand your market reach, win enterprise contracts, and accelerate business growth with prompt payments and escrow security.',
    imageUrl: 'https://storage.googleapis.com/jsgsmile1/banners/seller-benefits-banner.jpg',
    ctaText: 'Join as Supplier',
    ctaLink: '/seller/register',
    displayOrder: 11,
    priority: 45,
    bannerType: 'DEFAULT_ADMIN' as const,
    status: 'ACTIVE' as const,
    displayLocation: 'HOME_HERO' as const,
    isActive: true,
    durationDays: 30
  }
];

export async function seedBannersIfEmpty(syncAll = false) {
  const existingBanners = await (prisma as any).marketplaceBanner.findMany({
    where: { deletedAt: null }
  });

  if (existingBanners.length === 0) {
    for (const b of DEFAULT_PORTAL_BANNERS) {
      await (prisma as any).marketplaceBanner.create({
        data: b
      });
    }
    return;
  }

  if (syncAll) {
    const existingUrls = new Set(existingBanners.map((b: any) => b.imageUrl));
    for (const b of DEFAULT_PORTAL_BANNERS) {
      if (!existingUrls.has(b.imageUrl)) {
        await (prisma as any).marketplaceBanner.create({
          data: b
        });
      }
    }
  }
}
