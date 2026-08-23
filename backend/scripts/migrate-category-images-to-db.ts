import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import prisma from '../src/lib/prisma.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Mapping from normalized category names / slugs to SVG file names
const CATEGORY_FILE_MAP: Record<string, string> = {
  'electrical & electronics': 'electrical-electronics.svg',
  'electrical-electronics': 'electrical-electronics.svg',
  'electrical & appliances': 'electrical-electronics.svg',
  'mechanical & engineering': 'mechanical-engineering.svg',
  'mechanical-engineering': 'mechanical-engineering.svg',
  'construction & building materials': 'construction-materials.svg',
  'construction-building-materials': 'construction-materials.svg',
  'construction materials': 'construction-materials.svg',
  'industrial chemicals': 'industrial-chemicals.svg',
  'industrial-chemicals': 'industrial-chemicals.svg',
  'refractories': 'refractories.svg',
  'automobile parts & services': 'automobile-parts.svg',
  'automobile-parts-services': 'automobile-parts.svg',
  'automobile parts': 'automobile-parts.svg',
  'automotive': 'automobile-parts.svg',
  'tyres & rubber products': 'tyres-rubber.svg',
  'tyres-rubber-products': 'tyres-rubber.svg',
  'it & computer equipment': 'it-computer.svg',
  'it-computer-equipment': 'it-computer.svg',
  'office equipment & stationery': 'office-supplies.svg',
  'office-equipment-stationery': 'office-supplies.svg',
  'office supplies': 'office-supplies.svg',
  'medical & healthcare supplies': 'medical-supplies.svg',
  'medical-healthcare-supplies': 'medical-supplies.svg',
  'medical & lab supplies': 'medical-supplies.svg',
  'agriculture & nursery': 'agriculture-nursery.svg',
  'agriculture-nursery': 'agriculture-nursery.svg',
  'agri & gardening': 'agriculture-nursery.svg',
  'safety equipment & industrial safety': 'safety-supplies.svg',
  'safety-equipment-industrial-safety': 'safety-supplies.svg',
  'safety supplies': 'safety-supplies.svg',
  'fuel, oil & gas': 'fuel-oil-gas.svg',
  'fuel-oil-gas': 'fuel-oil-gas.svg',
  'fuel oil gas': 'fuel-oil-gas.svg',
  'hydraulics & pneumatics': 'hydraulics-pneumatics.svg',
  'hydraulics-pneumatics': 'hydraulics-pneumatics.svg',
  'steel & metal products': 'steel-metal.svg',
  'steel-metal-products': 'steel-metal.svg',
  'cement & concrete products': 'cement-concrete.svg',
  'cement-concrete-products': 'cement-concrete.svg',
  'pipes, tiles & hardware': 'pipes-tiles.svg',
  'pipes-tiles-hardware': 'pipes-tiles.svg',
  'industrial machinery & spare parts': 'machinery-spares.svg',
  'industrial-machinery-spare-parts': 'machinery-spares.svg',
  'automation & robotics': 'automation-robotics.svg',
  'automation-robotics': 'automation-robotics.svg',
  'fabrication & welding services': 'fabrication-welding.svg',
  'fabrication-welding-services': 'fabrication-welding.svg',
  'bearings & mechanical components': 'bearings-mechanical.svg',
  'bearings-mechanical-components': 'bearings-mechanical.svg',
  'electrical cables & power equipment': 'cables-power.svg',
  'electrical-cables-power-equipment': 'cables-power.svg',
  'industrial consumables': 'industrial-consumables.svg',
  'industrial-consumables': 'industrial-consumables.svg',
  'packaging & printing': 'packaging-printing.svg',
  'packaging-printing': 'packaging-printing.svg',
  'polymer & plastic products': 'polymers-plastics.svg',
  'polymer-plastic-products': 'polymers-plastics.svg',
  'trading & distribution': 'trading-distribution.svg',
  'trading-distribution': 'trading-distribution.svg',
  'logistics & supply services': 'logistics-supply.svg',
  'logistics-supply-services': 'logistics-supply.svg',
  'tools & industrial hardware': 'tools-hardware.svg',
  'tools-industrial-hardware': 'tools-hardware.svg',
  'industrial tools': 'tools-hardware.svg',
  'laboratory equipment & chemicals': 'laboratory-equipment.svg',
  'laboratory-equipment-chemicals': 'laboratory-equipment.svg',
  'engineering consultancy services': 'engineering-consultancy.svg',
  'engineering-consultancy-services': 'engineering-consultancy.svg',
  'industrial maintenance services': 'industrial-maintenance.svg',
  'industrial-maintenance-services': 'industrial-maintenance.svg',
  'construction & civil work services': 'civil-construction.svg',
  'construction-civil-work-services': 'civil-construction.svg',
  'environmental & waste management': 'environmental-waste.svg',
  'environmental-waste-management': 'environmental-waste.svg',
  'telecom & communication equipment': 'telecom-communication.svg',
  'telecom-communication-equipment': 'telecom-communication.svg',
  'furniture & interior supplies': 'furniture-interior.svg',
  'furniture-interior-supplies': 'furniture-interior.svg',
  'general industrial supplier': 'general-industrial.svg',
  'general-industrial-supplier': 'general-industrial.svg',
  'mining & coal equipment': 'mining-coal.svg',
  'mining-coal-equipment': 'mining-coal.svg',
  'power & energy equipment': 'power-energy.svg',
  'power-energy-equipment': 'power-energy.svg',
  'gas equipment & cylinders': 'gas-cylinders.svg',
  'gas-equipment-cylinders': 'gas-cylinders.svg',
  'conveyor & material handling equipment': 'conveyor-handling.svg',
  'conveyor-material-handling-equipment': 'conveyor-handling.svg',
  'pumps, motors & hydraulics': 'pumps-motors.svg',
  'pumps-motors-hydraulics': 'pumps-motors.svg',
  'industrial seals & gaskets': 'seals-gaskets.svg',
  'industrial-seals-gaskets': 'seals-gaskets.svg',
  'welding & cutting equipment': 'welding-cutting.svg',
  'welding-cutting-equipment': 'welding-cutting.svg',
  'industrial fasteners & components': 'fasteners-hardware.svg',
  'industrial-fasteners-components': 'fasteners-hardware.svg',
  'retail & commercial supply': 'retail-commercial.svg',
  'retail-commercial-supply': 'retail-commercial.svg',
  'fmcg & daily utility supply': 'fmcg-daily-utility.svg',
  'fmcg-daily-utility-supply': 'fmcg-daily-utility.svg',
  'textile & garments supply': 'textiles-garments.svg',
  'textile-garments-supply': 'textiles-garments.svg',
  'textiles & garments': 'textiles-garments.svg',
  'shg & handicrafts': 'shg-handicrafts.svg',
  'shg-handicrafts': 'shg-handicrafts.svg',
  'oem / manufacturing vendor': 'oem-manufacturing.svg',
  'oem-manufacturing-vendor': 'oem-manufacturing.svg',
  'repair & service provider': 'repair-services.svg',
  'repair-service-provider': 'repair-services.svg',
  'multi-category industrial vendor': 'multi-category-vendor.svg',
  'multi-category-industrial-vendor': 'multi-category-vendor.svg',
};

const KEYWORD_FILE_RULES: [string[], string][] = [
  [['cable', 'wire', 'transformer'], 'cables-power.svg'],
  [['robot', 'automation', 'plc', 'sensor'], 'automation-robotics.svg'],
  [['cement', 'concrete', 'mortar', 'paver'], 'cement-concrete.svg'],
  [['pipe', 'tile', 'plumbing', 'fitting', 'sanitary'], 'pipes-tiles.svg'],
  [['bearing', 'bushing', 'ball bearing'], 'bearings-mechanical.svg'],
  [['fastener', 'bolt', 'nut', 'screw', 'washer'], 'fasteners-hardware.svg'],
  [['conveyor', 'material handling', 'forklift', 'crane'], 'conveyor-handling.svg'],
  [['pump', 'water pump', 'motor'], 'pumps-motors.svg'],
  [['seal', 'gasket', 'o-ring'], 'seals-gaskets.svg'],
  [['welding', 'weld', 'cutting torch', 'electrode'], 'welding-cutting.svg'],
  [['mining', 'coal', 'mineral'], 'mining-coal.svg'],
  [['gas', 'cylinder', 'oxygen', 'lpg'], 'gas-cylinders.svg'],
  [['power', 'energy', 'solar', 'generator'], 'power-energy.svg'],
  [['plastic', 'polymer', 'pvc', 'hdpe'], 'polymers-plastics.svg'],
  [['machin', 'lathe', 'milling', 'spares'], 'machinery-spares.svg'],
  [['logistics', 'transport', 'freight', 'cargo'], 'logistics-supply.svg'],
  [['trade', 'trading', 'distribution', 'distributor'], 'trading-distribution.svg'],
  [['consultan', 'engineering design'], 'engineering-consultancy.svg'],
  [['maintenance', 'servicing', 'overhaul'], 'industrial-maintenance.svg'],
  [['civil', 'construction work', 'infrastructure'], 'civil-construction.svg'],
  [['environment', 'waste', 'recycle'], 'environmental-waste.svg'],
  [['telecom', 'communication', 'network'], 'telecom-communication.svg'],
  [['furniture', 'chair', 'desk', 'interior'], 'furniture-interior.svg'],
  [['consumable', 'abrasive'], 'industrial-consumables.svg'],
  [['electric', 'appliance', 'electronic'], 'electrical-electronics.svg'],
  [['office', 'stationery', 'paper'], 'office-supplies.svg'],
  [['tool', 'hardware', 'wrench'], 'tools-hardware.svg'],
  [['agri', 'farm', 'nursery', 'plant'], 'agriculture-nursery.svg'],
  [['medic', 'health', 'hospital', 'pharma'], 'medical-supplies.svg'],
  [['safety', 'helmet', 'boot', 'protective'], 'safety-supplies.svg'],
  [['auto', 'car', 'vehicle', 'truck'], 'automobile-parts.svg'],
  [['construct', 'building'], 'construction-materials.svg'],
  [['chemic', 'laboratory'], 'industrial-chemicals.svg'],
  [['refract', 'furnace', 'kiln', 'firebrick'], 'refractories.svg'],
  [['tyre', 'tire', 'rubber'], 'tyres-rubber.svg'],
  [['it ', 'computer', 'software', 'server'], 'it-computer.svg'],
  [['fuel', 'petrol', 'diesel', 'oil'], 'fuel-oil-gas.svg'],
  [['hydraulic', 'pneumatic'], 'hydraulics-pneumatics.svg'],
  [['steel', 'metal', 'iron', 'aluminum'], 'steel-metal.svg'],
  [['packag', 'box', 'carton', 'print'], 'packaging-printing.svg'],
  [['shg', 'handicraft', 'artisan', 'handloom'], 'shg-handicrafts.svg'],
  [['textile', 'cloth', 'garment', 'fabric'], 'textiles-garments.svg'],
  [['fmcg', 'daily utility', 'provision'], 'fmcg-daily-utility.svg'],
  [['retail', 'commercial'], 'retail-commercial.svg'],
  [['oem', 'manufacturing'], 'oem-manufacturing.svg'],
  [['repair', 'service'], 'repair-services.svg'],
];

function svgToDataUri(svgString: string): string {
  const cleaned = svgString
    .replace(/<\?xml.*?\?>/gi, '')
    .replace(/<!--.*?-->/g, '')
    .trim();
  return `data:image/svg+xml;base64,${Buffer.from(cleaned, 'utf-8').toString('base64')}`;
}

async function run() {
  console.log('🚀 Starting Category Image Migration to PostgreSQL Database...');

  const categoriesDir = path.resolve(__dirname, '../../frontend/public/categories');

  if (!fs.existsSync(categoriesDir)) {
    console.error(`❌ Categories directory not found at: ${categoriesDir}`);
    process.exit(1);
  }

  // Read all SVG files
  const svgFiles = fs.readdirSync(categoriesDir).filter(f => f.endsWith('.svg'));
  console.log(`📁 Found ${svgFiles.length} SVG files in categories folder.`);

  const svgContentMap: Record<string, string> = {};
  for (const file of svgFiles) {
    const filePath = path.join(categoriesDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    svgContentMap[file] = svgToDataUri(content);
  }

  // Fetch all existing categories from database
  const categories = await prisma.category.findMany();
  console.log(`📊 Found ${categories.length} categories in database.`);

  let updatedCount = 0;

  for (const cat of categories) {
    const cleanName = cat.name.toLowerCase().trim();
    const cleanSlug = cat.slug.toLowerCase().trim();

    // 1. Exact match in CATEGORY_FILE_MAP
    let matchedFile = CATEGORY_FILE_MAP[cleanName] || CATEGORY_FILE_MAP[cleanSlug];

    // 2. Direct slug.svg check
    if (!matchedFile && svgContentMap[`${cleanSlug}.svg`]) {
      matchedFile = `${cleanSlug}.svg`;
    }

    // 3. Keyword match
    if (!matchedFile) {
      for (const [keywords, fileName] of KEYWORD_FILE_RULES) {
        if (keywords.some(kw => cleanName.includes(kw) || cleanSlug.includes(kw))) {
          matchedFile = fileName;
          break;
        }
      }
    }

    if (matchedFile && svgContentMap[matchedFile]) {
      const dataUri = svgContentMap[matchedFile];
      await prisma.category.update({
        where: { id: cat.id },
        data: { imageUrl: dataUri } as any
      });
      updatedCount++;
      console.log(`  ✓ Updated Category [${cat.id}] "${cat.name}" with SVG: ${matchedFile}`);
    } else {
      console.log(`  ⚠ No SVG found for Category [${cat.id}] "${cat.name}" (Slug: ${cat.slug})`);
    }
  }

  console.log(`\n🎉 Successfully migrated ${updatedCount} / ${categories.length} categories to database!`);

  // Verify
  const verified = await prisma.category.count({
    where: {
      imageUrl: {
        startsWith: 'data:image/svg+xml'
      }
    } as any
  });
  console.log(`✅ Verified: ${verified} categories now have SVG data URIs stored directly in PostgreSQL.`);

  // Clean up frontend/public/categories folder
  console.log(`\n🧹 Removing local categories directory: ${categoriesDir}...`);
  fs.rmSync(categoriesDir, { recursive: true, force: true });
  console.log('✅ Successfully removed frontend/public/categories directory.');

  console.log('\n🌟 Migration complete!');
}

run()
  .catch((err) => {
    console.error('❌ Migration failed with error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
