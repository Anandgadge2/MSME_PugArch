import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getGCSBucket, getGCSBucketName } from '../src/config/gcs.js';
import prisma from '../src/lib/prisma.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Category Background Image Upload Script
 * 
 * Reads generated .webp/.jpg/.png images from the specified input directory,
 * uploads each to gs://jsgsmile1/category-backgrounds/{slug}.webp,
 * and updates the category's imageUrl in the database.
 */

// ── Slug-to-image filename mapping (covers all 50 categories) ──
const CATEGORY_SLUG_MAP: Record<string, string> = {
  'electrical-and-electronics': 'electrical-electronics',
  'mechanical-and-engineering': 'mechanical-engineering',
  'construction-and-building-materials': 'construction-building-materials',
  'industrial-chemicals': 'industrial-chemicals',
  'refractories': 'refractories',
  'automobile-parts-and-services': 'automobile-parts',
  'tyres-and-rubber-products': 'tyres-rubber',
  'it-and-computer-equipment': 'it-computer',
  'office-equipment-and-stationery': 'office-equipment',
  'medical-and-healthcare-supplies': 'medical-healthcare',
  'agriculture-and-nursery': 'agriculture-nursery',
  'safety-equipment-and-industrial-safety': 'safety-equipment',
  'fuel-oil-and-gas': 'fuel-oil-gas',
  'hydraulics-and-pneumatics': 'hydraulics-pneumatics',
  'steel-and-metal-products': 'steel-metal',
  'cement-and-concrete-products': 'cement-concrete',
  'pipes-tiles-and-hardware': 'pipes-tiles',
  'industrial-machinery-and-spare-parts': 'industrial-machinery',
  'automation-and-robotics': 'automation-robotics',
  'fabrication-and-welding-services': 'fabrication-welding',
  'bearings-and-mechanical-components': 'bearings-mechanical',
  'electrical-cables-and-power-equipment': 'electrical-cables',
  'industrial-consumables': 'industrial-consumables',
  'packaging-and-printing': 'packaging-printing',
  'polymer-and-plastic-products': 'polymer-plastics',
  'trading-and-distribution': 'trading-distribution',
  'logistics-and-supply-services': 'logistics-supply',
  'tools-and-industrial-hardware': 'tools-hardware',
  'laboratory-equipment-and-chemicals': 'laboratory-equipment',
  'engineering-consultancy-services': 'engineering-consultancy',
  'industrial-maintenance-services': 'industrial-maintenance',
  'construction-and-civil-work-services': 'civil-construction',
  'environmental-and-waste-management': 'environmental-waste',
  'telecom-and-communication-equipment': 'telecom-communication',
  'furniture-and-interior-supplies': 'furniture-interior',
  'general-industrial-supplier': 'general-industrial',
  'mining-and-coal-equipment': 'mining-coal',
  'power-and-energy-equipment': 'power-energy',
  'gas-equipment-and-cylinders': 'gas-cylinders',
  'conveyor-and-material-handling-equipment': 'conveyor-handling',
  'pumps-motors-and-hydraulics': 'pumps-motors',
  'industrial-seals-and-gaskets': 'industrial-seals',
  'welding-and-cutting-equipment': 'welding-cutting',
  'industrial-fasteners-and-components': 'industrial-fasteners',
  'retail-and-commercial-supply': 'retail-commercial',
  'fmcg-and-daily-utility-supply': 'fmcg-daily-utility',
  'textile-and-garments-supply': 'textile-garments',
  'oem--manufacturing-vendor': 'oem-manufacturing',
  'repair-and-service-provider': 'repair-service',
  'multi-category-industrial-vendor': 'multi-category-vendor',
};

// Alternate name-based lookups for image files
const IMAGE_NAME_VARIANTS: Record<string, string[]> = {
  'electrical-electronics': ['electrical_electronics', 'electrical-electronics'],
  'mechanical-engineering': ['mechanical_engineering', 'mechanical-engineering'],
  'construction-building-materials': ['construction_building_materials', 'construction-building-materials'],
  'industrial-chemicals': ['industrial_chemicals', 'industrial-chemicals'],
  'refractories': ['refractories'],
  'automobile-parts': ['automobile_parts', 'automobile-parts'],
  'tyres-rubber': ['tyres_rubber', 'tyres-rubber'],
  'it-computer': ['it_computer', 'it-computer'],
  'office-equipment': ['office_equipment', 'office-equipment'],
  'medical-healthcare': ['medical_healthcare', 'medical-healthcare'],
  'agriculture-nursery': ['agriculture_nursery', 'agriculture-nursery'],
  'safety-equipment': ['safety_equipment', 'safety-equipment'],
  'fuel-oil-gas': ['fuel_oil_gas', 'fuel-oil-gas'],
  'hydraulics-pneumatics': ['hydraulics_pneumatics', 'hydraulics-pneumatics'],
  'steel-metal': ['steel_metal', 'steel-metal'],
  'cement-concrete': ['cement_concrete', 'cement-concrete'],
  'pipes-tiles': ['pipes_tiles', 'pipes-tiles'],
  'industrial-machinery': ['industrial_machinery', 'industrial-machinery'],
  'automation-robotics': ['automation_robotics', 'automation-robotics'],
  'fabrication-welding': ['fabrication_welding', 'fabrication-welding'],
  'bearings-mechanical': ['bearings_mechanical', 'bearings-mechanical'],
  'electrical-cables': ['electrical_cables', 'electrical-cables'],
  'industrial-consumables': ['industrial_consumables', 'industrial-consumables'],
  'packaging-printing': ['packaging_printing', 'packaging-printing'],
  'polymer-plastics': ['polymer_plastics', 'polymer-plastics'],
  'trading-distribution': ['trading_distribution', 'trading-distribution'],
  'logistics-supply': ['logistics_supply', 'logistics-supply'],
  'tools-hardware': ['tools_hardware', 'tools-hardware'],
  'laboratory-equipment': ['laboratory_equipment', 'laboratory-equipment'],
  'engineering-consultancy': ['engineering_consultancy', 'engineering-consultancy'],
  'industrial-maintenance': ['industrial_maintenance', 'industrial-maintenance'],
  'civil-construction': ['civil_construction', 'civil-construction'],
  'environmental-waste': ['environmental_waste', 'environmental-waste'],
  'telecom-communication': ['telecom_communication', 'telecom-communication'],
  'furniture-interior': ['furniture_interior', 'furniture-interior'],
  'general-industrial': ['general_industrial', 'general-industrial'],
  'mining-coal': ['mining_coal', 'mining-coal'],
  'power-energy': ['power_energy', 'power-energy'],
  'gas-cylinders': ['gas_cylinders', 'gas-cylinders'],
  'conveyor-handling': ['conveyor_handling', 'conveyor-handling'],
  'pumps-motors': ['pumps_motors', 'pumps-motors'],
  'industrial-seals': ['industrial_seals', 'industrial-seals'],
  'welding-cutting': ['welding_cutting', 'welding-cutting'],
  'industrial-fasteners': ['industrial_fasteners', 'industrial-fasteners'],
  'retail-commercial': ['retail_commercial', 'retail-commercial'],
  'fmcg-daily-utility': ['fmcg_daily_utility', 'fmcg-daily-utility'],
  'textile-garments': ['textile_garments', 'textile-garments'],
  'oem-manufacturing': ['oem_manufacturing', 'oem-manufacturing'],
  'repair-service': ['repair_service', 'repair-service'],
  'multi-category-vendor': ['multi_category_vendor', 'multi-category-vendor'],
};

function findImageFile(imageDir: string, baseName: string): string | null {
  const variants = IMAGE_NAME_VARIANTS[baseName] || [baseName];
  const extensions = ['.webp', '.jpg', '.jpeg', '.png'];
  
  for (const variant of variants) {
    for (const ext of extensions) {
      // Try exact match
      const exactPath = path.join(imageDir, `${variant}${ext}`);
      if (fs.existsSync(exactPath)) return exactPath;
    }
    // Try matching files that start with the variant name (for files with timestamps like electrical_electronics_123456.jpg)
    const files = fs.readdirSync(imageDir);
    for (const file of files) {
      if (file.startsWith(variant) && extensions.some(ext => file.endsWith(ext))) {
        return path.join(imageDir, file);
      }
    }
  }
  return null;
}

async function main() {
  const imageDir = process.argv[2] || path.resolve(__dirname, '../../category-backgrounds-generated');
  
  console.log('🚀 Category Background Image Upload to GCS & Database Update');
  console.log(`📁 Image source directory: ${imageDir}`);
  
  if (!fs.existsSync(imageDir)) {
    console.error(`❌ Image directory not found: ${imageDir}`);
    console.log('   Usage: npx tsx scripts/generate-category-backgrounds.ts <path-to-images>');
    process.exit(1);
  }

  const bucket = getGCSBucket();
  const bucketName = getGCSBucketName();
  console.log(`📦 GCS Bucket: ${bucketName}`);
  console.log(`📂 GCS Folder: category-backgrounds/`);

  // Fetch all categories from database
  const categories = await prisma.category.findMany({
    where: { isActive: true },
    orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }]
  });
  console.log(`\n📊 Found ${categories.length} active categories in database\n`);

  let uploaded = 0;
  let skipped = 0;
  let errors = 0;
  const results: { id: number; name: string; slug: string; status: string; imageUrl?: string }[] = [];

  for (const cat of categories) {
    const baseName = CATEGORY_SLUG_MAP[cat.slug] || cat.slug;
    const imageFile = findImageFile(imageDir, baseName);

    if (!imageFile) {
      console.log(`  ⚠ No image found for [${cat.id}] "${cat.name}" (slug: ${cat.slug}, looked for: ${baseName})`);
      skipped++;
      results.push({ id: cat.id, name: cat.name, slug: cat.slug, status: 'SKIPPED - no image file' });
      continue;
    }

    try {
      const buffer = fs.readFileSync(imageFile);
      const ext = path.extname(imageFile).toLowerCase();
      const mimeType = ext === '.webp' ? 'image/webp' : ext === '.png' ? 'image/png' : 'image/jpeg';
      
      // Upload as .webp to GCS (keep original format, rename to .webp key)
      const gcsKey = `category-backgrounds/${cat.slug}.webp`;
      const gcsFile = bucket.file(gcsKey);

      await gcsFile.save(buffer, {
        contentType: mimeType,
        resumable: false,
        metadata: {
          contentType: mimeType,
          cacheControl: 'public, max-age=86400',
          metadata: {
            categoryId: String(cat.id),
            categorySlug: cat.slug,
            originalFile: path.basename(imageFile),
            uploadedAt: new Date().toISOString(),
            source: 'generate-category-backgrounds-script'
          }
        }
      });

      // Update category in database with versioned URL for cache busting
      const timestamp = Date.now();
      const imageUrl = `https://storage.googleapis.com/${bucketName}/${gcsKey}?v=${timestamp}`;
      
      await prisma.category.update({
        where: { id: cat.id },
        data: { imageUrl }
      });

      console.log(`  ✓ [${cat.id}] "${cat.name}" → gs://${bucketName}/${gcsKey}`);
      uploaded++;
      results.push({ id: cat.id, name: cat.name, slug: cat.slug, status: 'UPLOADED', imageUrl });
    } catch (err: any) {
      console.error(`  ✗ [${cat.id}] "${cat.name}" → ERROR: ${err.message}`);
      errors++;
      results.push({ id: cat.id, name: cat.name, slug: cat.slug, status: `ERROR: ${err.message}` });
    }
  }

  // ── Summary ──
  console.log('\n' + '═'.repeat(60));
  console.log('📊 UPLOAD SUMMARY');
  console.log('═'.repeat(60));
  console.log(`  ✓ Uploaded:  ${uploaded} / ${categories.length}`);
  console.log(`  ⚠ Skipped:   ${skipped} / ${categories.length}`);
  console.log(`  ✗ Errors:    ${errors} / ${categories.length}`);
  console.log('═'.repeat(60));

  if (skipped > 0) {
    console.log('\n⚠ Skipped categories (no matching image file):');
    results.filter(r => r.status.startsWith('SKIPPED')).forEach(r => {
      console.log(`   - [${r.id}] ${r.name} (${r.slug})`);
    });
  }

  if (errors > 0) {
    console.log('\n❌ Failed categories:');
    results.filter(r => r.status.startsWith('ERROR')).forEach(r => {
      console.log(`   - [${r.id}] ${r.name}: ${r.status}`);
    });
  }

  // ── Validation ──
  console.log('\n🔍 Running validation...');
  const dbCategories = await prisma.category.findMany({
    where: { isActive: true },
    select: { id: true, name: true, slug: true, imageUrl: true }
  });
  
  const withBgImage = dbCategories.filter(c => c.imageUrl?.includes('category-backgrounds/'));
  const withoutImage = dbCategories.filter(c => !c.imageUrl);
  
  console.log(`  ✓ Categories with background images: ${withBgImage.length}`);
  console.log(`  ⚠ Categories without any image: ${withoutImage.length}`);

  // Check for duplicate image URLs
  const urlCounts = new Map<string, string[]>();
  for (const c of withBgImage) {
    const baseUrl = (c.imageUrl || '').split('?')[0];
    if (!urlCounts.has(baseUrl)) urlCounts.set(baseUrl, []);
    urlCounts.get(baseUrl)!.push(c.name);
  }
  const duplicates = [...urlCounts.entries()].filter(([, names]) => names.length > 1);
  if (duplicates.length > 0) {
    console.log('\n⚠ Duplicate image URLs detected:');
    duplicates.forEach(([url, names]) => {
      console.log(`   ${url} → used by: ${names.join(', ')}`);
    });
  } else {
    console.log('  ✓ No duplicate image URLs');
  }

  console.log('\n🎉 Done!');
}

main()
  .catch(err => {
    console.error('❌ Fatal error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
