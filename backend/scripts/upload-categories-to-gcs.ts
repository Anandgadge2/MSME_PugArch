import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getGCSBucket, getGCSBucketName } from '../src/config/gcs.js';
import prisma from '../src/lib/prisma.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CATEGORY_FILE_MAP: Record<string, string> = {
  'electrical & electronics': 'electrical-electronics.svg',
  'electrical-and-electronics': 'electrical-electronics.svg',
  'mechanical & engineering': 'mechanical-engineering.svg',
  'mechanical-and-engineering': 'mechanical-engineering.svg',
  'construction & building materials': 'construction-materials.svg',
  'construction-and-building-materials': 'construction-materials.svg',
  'industrial chemicals': 'industrial-chemicals.svg',
  'industrial-chemicals': 'industrial-chemicals.svg',
  'refractories': 'refractories.svg',
  'automobile parts & services': 'automobile-parts.svg',
  'automobile-parts-and-services': 'automobile-parts.svg',
  'tyres & rubber products': 'tyres-rubber.svg',
  'tyres-and-rubber-products': 'tyres-rubber.svg',
  'it & computer equipment': 'it-computer.svg',
  'it-and-computer-equipment': 'it-computer.svg',
  'office equipment & stationery': 'office-supplies.svg',
  'office-equipment-and-stationery': 'office-supplies.svg',
  'medical & healthcare supplies': 'medical-supplies.svg',
  'medical-and-healthcare-supplies': 'medical-supplies.svg',
  'agriculture & nursery': 'agriculture-nursery.svg',
  'agriculture-and-nursery': 'agriculture-nursery.svg',
  'safety equipment & industrial safety': 'safety-supplies.svg',
  'safety-equipment-and-industrial-safety': 'safety-supplies.svg',
  'fuel, oil & gas': 'fuel-oil-gas.svg',
  'fuel-oil-and-gas': 'fuel-oil-gas.svg',
  'hydraulics & pneumatics': 'hydraulics-pneumatics.svg',
  'hydraulics-and-pneumatics': 'hydraulics-pneumatics.svg',
  'steel & metal products': 'steel-metal.svg',
  'steel-and-metal-products': 'steel-metal.svg',
  'cement & concrete products': 'cement-concrete.svg',
  'cement-and-concrete-products': 'cement-concrete.svg',
  'pipes, tiles & hardware': 'pipes-tiles.svg',
  'pipes-tiles-and-hardware': 'pipes-tiles.svg',
  'industrial machinery & spare parts': 'machinery-spares.svg',
  'industrial-machinery-and-spare-parts': 'machinery-spares.svg',
  'automation & robotics': 'automation-robotics.svg',
  'automation-and-robotics': 'automation-robotics.svg',
  'fabrication & welding services': 'fabrication-welding.svg',
  'fabrication-and-welding-services': 'fabrication-welding.svg',
  'bearings & mechanical components': 'bearings-mechanical.svg',
  'bearings-and-mechanical-components': 'bearings-mechanical.svg',
  'electrical cables & power equipment': 'cables-power.svg',
  'electrical-cables-and-power-equipment': 'cables-power.svg',
  'industrial consumables': 'industrial-consumables.svg',
  'industrial-consumables': 'industrial-consumables.svg',
  'packaging & printing': 'packaging-printing.svg',
  'packaging-and-printing': 'packaging-printing.svg',
  'polymer & plastic products': 'polymers-plastics.svg',
  'polymer-and-plastic-products': 'polymers-plastics.svg',
  'trading & distribution': 'trading-distribution.svg',
  'trading-and-distribution': 'trading-distribution.svg',
  'logistics & supply services': 'logistics-supply.svg',
  'logistics-and-supply-services': 'logistics-supply.svg',
  'tools & industrial hardware': 'tools-hardware.svg',
  'tools-and-industrial-hardware': 'tools-hardware.svg',
  'laboratory equipment & chemicals': 'laboratory-equipment.svg',
  'laboratory-equipment-and-chemicals': 'laboratory-equipment.svg',
  'engineering consultancy services': 'engineering-consultancy.svg',
  'engineering-consultancy-services': 'engineering-consultancy.svg',
  'industrial maintenance services': 'industrial-maintenance.svg',
  'industrial-maintenance-services': 'industrial-maintenance.svg',
  'construction & civil work services': 'civil-construction.svg',
  'construction-and-civil-work-services': 'civil-construction.svg',
  'environmental & waste management': 'environmental-waste.svg',
  'environmental-and-waste-management': 'environmental-waste.svg',
  'telecom & communication equipment': 'telecom-communication.svg',
  'telecom-and-communication-equipment': 'telecom-communication.svg',
  'furniture & interior supplies': 'furniture-interior.svg',
  'furniture-and-interior-supplies': 'furniture-interior.svg',
  'general industrial supplier': 'general-industrial.svg',
  'general-industrial-supplier': 'general-industrial.svg',
  'mining & coal equipment': 'mining-coal.svg',
  'mining-coal-equipment': 'mining-coal.svg',
  'power & energy equipment': 'power-energy.svg',
  'power-energy-equipment': 'power-energy.svg',
  'gas equipment & cylinders': 'gas-cylinders.svg',
  'gas-equipment-and-cylinders': 'gas-cylinders.svg',
  'conveyor & material handling equipment': 'conveyor-handling.svg',
  'conveyor-and-material-handling-equipment': 'conveyor-handling.svg',
  'pumps, motors & hydraulics': 'pumps-motors.svg',
  'pumps-motors-and-hydraulics': 'pumps-motors.svg',
  'industrial seals & gaskets': 'seals-gaskets.svg',
  'industrial-seals-and-gaskets': 'seals-gaskets.svg',
  'welding & cutting equipment': 'welding-cutting.svg',
  'welding-and-cutting-equipment': 'welding-cutting.svg',
  'industrial fasteners & components': 'fasteners-hardware.svg',
  'industrial-fasteners-and-components': 'fasteners-hardware.svg',
  'retail & commercial supply': 'retail-commercial.svg',
  'retail-and-commercial-supply': 'retail-commercial.svg',
  'fmcg & daily utility supply': 'fmcg-daily-utility.svg',
  'fmcg-and-daily-utility-supply': 'fmcg-daily-utility.svg',
  'textile & garments supply': 'textiles-garments.svg',
  'textile-and-garments-supply': 'textiles-garments.svg',
  'oem / manufacturing vendor': 'oem-manufacturing.svg',
  'oem-manufacturing-vendor': 'oem-manufacturing.svg',
  'repair & service provider': 'repair-services.svg',
  'repair-and-service-provider': 'repair-services.svg',
  'multi-category industrial vendor': 'multi-category-vendor.svg',
  'multi-category-industrial-vendor': 'multi-category-vendor.svg',
};

async function main() {
  console.log('🚀 Starting Category Icon Upload to GCP Bucket & Database Update...');
  
  const bucket = getGCSBucket();
  const bucketName = getGCSBucketName();
  console.log(`📦 GCP Bucket: ${bucketName}`);

  const categoriesDir = path.resolve(__dirname, '../../frontend/public/categories');
  const files = fs.readdirSync(categoriesDir).filter(f => f.endsWith('.svg'));
  console.log(`📁 Found ${files.length} SVG category icons in ${categoriesDir}`);

  // 1. Upload all SVG files to GCP Bucket under categories/ folder
  for (const file of files) {
    const filePath = path.join(categoriesDir, file);
    const content = fs.readFileSync(filePath);
    const gcsKey = `categories/${file}`;
    const gcsFile = bucket.file(gcsKey);

    await gcsFile.save(content, {
      contentType: 'image/svg+xml',
      metadata: {
        cacheControl: 'public, max-age=31536000, immutable',
        contentType: 'image/svg+xml'
      },
      resumable: false
    });
    console.log(`  ✓ Uploaded to GCP: gs://${bucketName}/${gcsKey}`);
  }

  // 2. Fetch all categories and update their imageUrl with both GCS & Local fallback path
  const categories = await prisma.category.findMany();
  console.log(`\n📊 Updating ${categories.length} categories in Database...`);

  let updated = 0;
  for (const cat of categories) {
    const cleanName = cat.name.toLowerCase().trim();
    const cleanSlug = cat.slug.toLowerCase().trim();

    const matchedFile = CATEGORY_FILE_MAP[cleanSlug] || CATEGORY_FILE_MAP[cleanName] || `${cleanSlug}.svg`;
    if (matchedFile && fs.existsSync(path.join(categoriesDir, matchedFile))) {
      // Store public URL: https://storage.googleapis.com/<bucketName>/categories/<matchedFile>
      const gcsUrl = `https://storage.googleapis.com/${bucketName}/categories/${matchedFile}`;
      
      await prisma.category.update({
        where: { id: cat.id },
        data: { imageUrl: gcsUrl } as any
      });
      console.log(`  ✓ Category [${cat.id}] "${cat.name}" -> ${gcsUrl}`);
      updated++;
    }
  }

  console.log(`\n🎉 Successfully uploaded all icons to GCP and updated ${updated} / ${categories.length} categories in DB!`);
}

main()
  .catch(err => {
    console.error('❌ Error during upload:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
