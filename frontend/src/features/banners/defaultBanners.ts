export const DEFAULT_MARKETPLACE_BANNERS = [
  // --- Clean hero banners hosted on GCP Cloud Storage ---
  {
    id: -9001,
    title: 'Steel & Metal Fabrication\nPowering Jharsuguda Industry',
    subtitle: 'Source verified steel, TMT bars, industrial castings, and metal components from local manufacturers across the district.',
    ctaText: 'Browse Steel & Metal',
    ctaLink: '#products',
    imageUrl: 'https://storage.googleapis.com/jsgsmile1/banners/jharsuguda-steel-industry.jpg',
    displayOrder: 1,
    displayLocation: 'HOME_HERO',
    status: 'DEFAULT'
  },
  {
    id: -9002,
    title: 'Simplified \ne-Procurement for Smart Buyers',
    subtitle: 'Compare quotations, track orders, and manage your procurement from verified district suppliers — all in one dashboard.',
    ctaText: 'Start Buying',
    ctaLink: '/buyer/register',
    imageUrl: 'https://storage.googleapis.com/jsgsmile1/banners/digital-procurement.jpg',
    displayOrder: 2,
    displayLocation: 'HOME_HERO',
    status: 'DEFAULT'
  },
  {
    id: -9003,
    title: 'Odisha Handicrafts & SHG Products\nNow Online',
    subtitle: 'Sambalpuri textiles, Dhokra brass, terracotta, tribal jewelry — discover authentic Odisha craftsmanship from self-help groups.',
    ctaText: 'Explore SHG Products',
    ctaLink: '#categories',
    imageUrl: 'https://storage.googleapis.com/jsgsmile1/banners/odisha-handicraft-shg.jpg',
    displayOrder: 3,
    displayLocation: 'HOME_HERO',
    status: 'DEFAULT'
  },
  {
    id: -9004,
    title: 'Industrial Powerhouse\nof Western Odisha',
    subtitle: 'Thermal power, aluminum smelting, coal logistics — connecting the industrial backbone of Jharsuguda with verified digital procurement.',
    ctaText: 'Explore Ecosystem',
    ctaLink: '#categories',
    imageUrl: 'https://storage.googleapis.com/jsgsmile1/banners/thermal-power-plant.jpg',
    displayOrder: 4,
    displayLocation: 'HOME_HERO',
    status: 'DEFAULT'
  },
  {
    id: -9005,
    title: 'Grow Your Business\nReach Enterprise Buyers',
    subtitle: 'List your products, get GST & Udyam verified, receive orders directly from government agencies and industrial conglomerates.',
    ctaText: 'Register as Seller',
    ctaLink: '/seller/register',
    imageUrl: 'https://storage.googleapis.com/jsgsmile1/banners/seller-mobile-orders.jpg',
    displayOrder: 5,
    displayLocation: 'HOME_HERO',
    status: 'DEFAULT'
  },
  {
    id: -9006,
    title: 'Aluminum & Heavy Industry\nSupply Chain Hub',
    subtitle: 'Refractories, chemicals, electrical components, hydraulics — everything major industries need, sourced from verified local suppliers.',
    ctaText: 'Find Suppliers',
    ctaLink: '#products',
    imageUrl: 'https://storage.googleapis.com/jsgsmile1/banners/vedanta-industrial-hub.jpg',
    displayOrder: 6,
    displayLocation: 'HOME_HERO',
    status: 'DEFAULT'
  },
  // --- Curated fallback banners ---
  {
    id: -9007,
    title: 'Discover Verified MSME\nProducts & Services',
    subtitle: 'Browse quality products from verified local manufacturers and service providers in Jharsuguda District.',
    ctaText: 'Explore Marketplace',
    ctaLink: '#products',
    imageUrl: 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=1920&q=90&auto=format&fit=crop',
    displayOrder: 7,
    displayLocation: 'HOME_HERO',
    status: 'DEFAULT'
  },
  {
    id: -9008,
    title: 'Register as Seller &\nGrow Your Business',
    subtitle: 'List your products and services. Reach government, institutional, and enterprise buyers across the district.',
    ctaText: 'Register as Seller',
    ctaLink: '/seller/register',
    imageUrl: 'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=1920&q=90&auto=format&fit=crop',
    displayOrder: 8,
    displayLocation: 'HOME_HERO',
    status: 'DEFAULT'
  },
  {
    id: -9009,
    title: 'Transparent Procurement\nfor All Buyers',
    subtitle: 'Access verified suppliers, compare products, request quotations, and manage your procurement needs in one place.',
    ctaText: 'Register as Buyer',
    ctaLink: '/buyer/register',
    imageUrl: 'https://images.unsplash.com/photo-1553877522-43269d4ea984?w=1920&q=90&auto=format&fit=crop',
    displayOrder: 9,
    displayLocation: 'HOME_HERO',
    status: 'DEFAULT'
  },
  {
    id: -9010,
    title: 'Empowering Jharsuguda\nMSMEs Digitally',
    subtitle: 'A government-grade marketplace connecting local industries, suppliers, and buyers through transparent digital procurement.',
    ctaText: 'Learn More',
    ctaLink: '#how-it-works',
    imageUrl: 'https://images.unsplash.com/photo-1565043666747-69f6646db940?w=1920&q=90&auto=format&fit=crop',
    displayOrder: 10,
    displayLocation: 'HOME_HERO',
    status: 'DEFAULT'
  }
] as const;
