import type { MarketplaceCategory } from '../api';
import { resolveMediaUrl } from '../../../lib/api';

export interface CategoryVisualMeta {
    imageUrl: string;
    accentColor: string;
    categoryTag: string;
}

const GCS_BUCKET_NAME = process.env.NEXT_PUBLIC_GCS_BUCKET_NAME || 'jsgsmile1';
const GCS_BASE_URL = `https://storage.googleapis.com/${GCS_BUCKET_NAME}/categories`;

export const CATEGORY_SVG_FILE_MAP: Record<string, string> = {
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

const KEYWORD_ICON_RULES: [string[], string][] = [
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

export const findCategorySvgFilename = (name: string, slug?: string): string => {
    const cleanName = (name || '').toLowerCase().trim();
    const cleanSlug = (slug || '').toLowerCase().trim();

    if (cleanSlug && CATEGORY_SVG_FILE_MAP[cleanSlug]) {
        return CATEGORY_SVG_FILE_MAP[cleanSlug];
    }
    if (cleanName && CATEGORY_SVG_FILE_MAP[cleanName]) {
        return CATEGORY_SVG_FILE_MAP[cleanName];
    }
    for (const [keywords, fileName] of KEYWORD_ICON_RULES) {
        if (keywords.some(kw => cleanName.includes(kw) || cleanSlug.includes(kw))) {
            return fileName;
        }
    }
    return 'general-industrial.svg';
};

export const normalizeDataUri = (url: unknown): string => {
    if (!url || typeof url !== 'string') return '';
    const trimmed = url.trim();
    if (trimmed.startsWith('data:image/svg+xml;utf8,')) {
        return trimmed.replace('data:image/svg+xml;utf8,', 'data:image/svg+xml;charset=utf-8,');
    }
    return trimmed;
};

export const buildCategoryFallbackSvg = (categoryName: string, accentColor = '#2563eb'): string => {
    const fileName = findCategorySvgFilename(categoryName);
    return resolveMediaUrl(`${GCS_BASE_URL}/${fileName}`) || `${GCS_BASE_URL}/${fileName}`;
};

export const getCategoryVisualMeta = (category: MarketplaceCategory | string): CategoryVisualMeta => {
    const rawName = typeof category === 'string' ? category : category?.name || '';
    const rawSlug = typeof category === 'string' ? '' : category?.slug || '';
    
    // 1. If category object has custom imageUrl stored in database
    if (typeof category === 'object' && category !== null) {
        const rawCustom = (category as any).imageUrl || (category as any).image || (category as any).photoUrl;
        const resolved = resolveMediaUrl(rawCustom);
        if (resolved && !resolved.includes('category-backgrounds')) {
            return {
                imageUrl: resolved,
                accentColor: '#2563eb',
                categoryTag: rawName,
            };
        }
    }

    // 2. Direct match to GCS Bucket SVG
    const svgFile = findCategorySvgFilename(rawName, rawSlug);
    const cloudUrl = resolveMediaUrl(`${GCS_BASE_URL}/${svgFile}`) || `${GCS_BASE_URL}/${svgFile}`;

    return {
        imageUrl: cloudUrl,
        accentColor: '#2563eb',
        categoryTag: rawName,
    };
};

export const getCategoryImageUrl = (category: MarketplaceCategory | string): string => {
    if (typeof category === 'object' && category !== null) {
        const rawCustom = (category as any).imageUrl || (category as any).image || (category as any).photoUrl;
        const resolved = resolveMediaUrl(rawCustom);
        if (resolved && !resolved.includes('category-backgrounds')) return resolved;

        const svgFile = findCategorySvgFilename(category.name, category.slug);
        return resolveMediaUrl(`${GCS_BASE_URL}/${svgFile}`) || `${GCS_BASE_URL}/${svgFile}`;
    }

    if (typeof category === 'string') {
        const svgFile = findCategorySvgFilename(category);
        return resolveMediaUrl(`${GCS_BASE_URL}/${svgFile}`) || `${GCS_BASE_URL}/${svgFile}`;
    }

    return resolveMediaUrl(`${GCS_BASE_URL}/general-industrial.svg`) || `${GCS_BASE_URL}/general-industrial.svg`;
};
