import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getGCSBucket, getGCSBucketName } from '../src/config/gcs.js';
import prisma from '../src/lib/prisma.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BUNDLED_VERSION = '1787987232675';

const BUNDLED_SLUG_SET = new Set([
  'agriculture-and-nursery',
  'automation-and-robotics',
  'automobile-parts-and-services',
  'bearings-and-mechanical-components',
  'cement-and-concrete-products',
  'construction-and-building-materials',
  'construction-and-civil-work-services',
  'conveyor-and-material-handling-equipment',
  'electrical-and-electronics',
  'electrical-cables-and-power-equipment',
  'engineering-consultancy-services',
  'environmental-and-waste-management',
  'fabrication-and-welding-services',
  'fmcg-and-daily-utility-supply',
  'fuel-oil-and-gas',
  'furniture-and-interior-supplies',
  'gas-equipment-and-cylinders',
  'general-industrial-supplier',
  'hydraulics-and-pneumatics',
  'industrial-chemicals',
  'industrial-consumables',
  'industrial-fasteners-and-components',
  'industrial-machinery-and-spare-parts',
  'industrial-maintenance-services',
  'industrial-seals-and-gaskets',
  'it-and-computer-equipment',
  'laboratory-equipment-and-chemicals',
  'logistics-and-supply-services',
  'mechanical-and-engineering',
  'medical-and-healthcare-supplies',
  'mining-and-coal-equipment',
  'multi-category-industrial-vendor',
  'oem-manufacturing-vendor',
  'office-equipment-and-stationery',
  'packaging-and-printing',
  'pipes-tiles-and-hardware',
  'polymer-and-plastic-products',
  'power-and-energy-equipment',
  'pumps-motors-and-hydraulics',
  'refractories',
  'repair-and-service-provider',
  'retail-and-commercial-supply',
  'safety-equipment-and-industrial-safety',
  'steel-and-metal-products',
  'telecom-and-communication-equipment',
  'test',
  'textile-and-garments-supply',
  'tools-and-industrial-hardware',
  'trading-and-distribution',
  'tyres-and-rubber-products',
  'welding-and-cutting-equipment',
]);

const SLUG_ALIASES: Record<string, string> = {
  'electrical-and-appliances': 'electrical-and-electronics',
  'fuel-oil-gas': 'fuel-oil-and-gas',
  'mining-coal-equipment': 'mining-and-coal-equipment',
  'power-energy-equipment': 'power-and-energy-equipment',
};

function resolveSlug(name?: string, slug?: string): string {
  const cleanSlug = (slug || '').toLowerCase().trim().replace(/&/g, 'and').replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  if (cleanSlug && BUNDLED_SLUG_SET.has(cleanSlug)) return cleanSlug;
  if (cleanSlug && SLUG_ALIASES[cleanSlug]) return SLUG_ALIASES[cleanSlug];
  const cleanName = (name || '').toLowerCase().trim().replace(/&/g, 'and').replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  if (cleanName && BUNDLED_SLUG_SET.has(cleanName)) return cleanName;
  if (cleanName && SLUG_ALIASES[cleanName]) return SLUG_ALIASES[cleanName];
  return 'general-industrial-supplier';
}

async function main() {
  console.log('🚀 Starting Category Photo Upload to GCP Bucket & Database Update...');
  
  let bucket: any = null;
  let bucketName = '';
  try {
    bucket = getGCSBucket();
    bucketName = getGCSBucketName();
    console.log(`📦 GCP Bucket: ${bucketName}`);
  } catch (err: any) {
    console.warn(`⚠️ GCP Bucket not configured (${err.message}). Using local static paths.`);
  }

  const photosDir = path.resolve(__dirname, `../../frontend/public/category-photos/${BUNDLED_VERSION}`);
  const files = fs.existsSync(photosDir) ? fs.readdirSync(photosDir).filter(f => f.endsWith('.webp')) : [];
  console.log(`📁 Found ${files.length} WebP category photos in ${photosDir}`);

  // 1. Upload all WebP files to GCP Bucket under categories/photos/ folder if bucket is configured
  if (bucket && files.length > 0) {
    for (const file of files) {
      const filePath = path.join(photosDir, file);
      const content = fs.readFileSync(filePath);
      const gcsKey = `categories/photos/${file}`;
      const gcsFile = bucket.file(gcsKey);

      await gcsFile.save(content, {
        contentType: 'image/webp',
        metadata: {
          cacheControl: 'public, max-age=31536000, immutable',
          contentType: 'image/webp'
        },
        resumable: false
      });
      console.log(`  ✓ Uploaded to GCP: gs://${bucketName}/${gcsKey}`);
    }
  }

  // 2. Fetch all categories and update their imageUrl with realistic photo paths
  const categories = await prisma.category.findMany();
  console.log(`\n📊 Updating ${categories.length} categories in Database...`);

  let updated = 0;
  for (const cat of categories) {
    // Preserve custom admin uploads
    const existing = (cat.imageUrl || '').trim();
    if (existing && !existing.endsWith('.svg') && !existing.includes('.svg?') && existing.includes('/photos/')) {
      console.log(`  - Skipping custom admin photo [${cat.id}] "${cat.name}"`);
      continue;
    }

    const matchedSlug = resolveSlug(cat.name, cat.slug);
    const photoUrl = `/category-photos/${BUNDLED_VERSION}/${matchedSlug}.webp`;

    await prisma.category.update({
      where: { id: cat.id },
      data: { imageUrl: photoUrl } as any
    });
    console.log(`  ✓ Category [${cat.id}] "${cat.name}" -> ${photoUrl}`);
    updated++;
  }

  console.log(`\n🎉 Successfully updated ${updated} / ${categories.length} categories with realistic industrial photos!`);
}

main()
  .catch(err => {
    console.error('❌ Error during category photo migration:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
