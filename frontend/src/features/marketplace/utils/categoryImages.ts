import type { MarketplaceCategory } from '../api';
import { resolveMediaUrl } from '../../../lib/api';

export interface CategoryVisualMeta {
    imageUrl: string;
    accentColor: string;
    categoryTag: string;
}

export const BUNDLED_CATEGORY_PHOTO_VERSION = '1787987232675';

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

export const CATEGORY_SVG_FILE_MAP: Record<string, string> = {
    'electrical & electronics': 'electrical-and-electronics',
    'electrical-and-electronics': 'electrical-and-electronics',
    'electrical & appliances': 'electrical-and-electronics',
    'mechanical & engineering': 'mechanical-and-engineering',
    'mechanical-and-engineering': 'mechanical-and-engineering',
    'construction & building materials': 'construction-and-building-materials',
    'construction-and-building-materials': 'construction-and-building-materials',
    'industrial chemicals': 'industrial-chemicals',
    'industrial-chemicals': 'industrial-chemicals',
    'refractories': 'refractories',
    'automobile parts & services': 'automobile-parts-and-services',
    'automobile-parts-and-services': 'automobile-parts-and-services',
    'tyres & rubber products': 'tyres-and-rubber-products',
    'tyres-and-rubber-products': 'tyres-and-rubber-products',
    'it & computer equipment': 'it-and-computer-equipment',
    'it-and-computer-equipment': 'it-and-computer-equipment',
    'office equipment & stationery': 'office-equipment-and-stationery',
    'office-equipment-and-stationery': 'office-equipment-and-stationery',
    'medical & healthcare supplies': 'medical-and-healthcare-supplies',
    'medical-and-healthcare-supplies': 'medical-and-healthcare-supplies',
    'agriculture & nursery': 'agriculture-and-nursery',
    'agriculture-and-nursery': 'agriculture-and-nursery',
    'safety equipment & industrial safety': 'safety-equipment-and-industrial-safety',
    'safety-equipment-and-industrial-safety': 'safety-equipment-and-industrial-safety',
    'fuel, oil & gas': 'fuel-oil-and-gas',
    'fuel-oil-and-gas': 'fuel-oil-and-gas',
    'fuel-oil-gas': 'fuel-oil-and-gas',
    'hydraulics & pneumatics': 'hydraulics-and-pneumatics',
    'hydraulics-and-pneumatics': 'hydraulics-and-pneumatics',
    'steel & metal products': 'steel-and-metal-products',
    'steel-and-metal-products': 'steel-and-metal-products',
    'cement & concrete products': 'cement-and-concrete-products',
    'cement-and-concrete-products': 'cement-and-concrete-products',
    'pipes, tiles & hardware': 'pipes-tiles-and-hardware',
    'pipes-tiles-and-hardware': 'pipes-tiles-and-hardware',
    'industrial machinery & spare parts': 'industrial-machinery-and-spare-parts',
    'industrial-machinery-and-spare-parts': 'industrial-machinery-and-spare-parts',
    'automation & robotics': 'automation-and-robotics',
    'automation-and-robotics': 'automation-and-robotics',
    'fabrication & welding services': 'fabrication-and-welding-services',
    'fabrication-and-welding-services': 'fabrication-and-welding-services',
    'bearings & mechanical components': 'bearings-and-mechanical-components',
    'bearings-and-mechanical-components': 'bearings-and-mechanical-components',
    'electrical cables & power equipment': 'electrical-cables-and-power-equipment',
    'electrical-cables-and-power-equipment': 'electrical-cables-and-power-equipment',
    'industrial consumables': 'industrial-consumables',
    'industrial-consumables': 'industrial-consumables',
    'packaging & printing': 'packaging-and-printing',
    'packaging-and-printing': 'packaging-and-printing',
    'polymer & plastic products': 'polymer-and-plastic-products',
    'polymer-and-plastic-products': 'polymer-and-plastic-products',
    'trading & distribution': 'trading-and-distribution',
    'trading-and-distribution': 'trading-and-distribution',
    'logistics & supply services': 'logistics-and-supply-services',
    'logistics-and-supply-services': 'logistics-and-supply-services',
    'tools & industrial hardware': 'tools-and-industrial-hardware',
    'tools-and-industrial-hardware': 'tools-and-industrial-hardware',
    'laboratory equipment & chemicals': 'laboratory-equipment-and-chemicals',
    'laboratory-equipment-and-chemicals': 'laboratory-equipment-and-chemicals',
    'engineering consultancy services': 'engineering-consultancy-services',
    'engineering-consultancy-services': 'engineering-consultancy-services',
    'industrial maintenance services': 'industrial-maintenance-services',
    'industrial-maintenance-services': 'industrial-maintenance-services',
    'construction & civil work services': 'construction-and-civil-work-services',
    'construction-and-civil-work-services': 'construction-and-civil-work-services',
    'environmental & waste management': 'environmental-and-waste-management',
    'environmental-and-waste-management': 'environmental-and-waste-management',
    'telecom & communication equipment': 'telecom-and-communication-equipment',
    'telecom-and-communication-equipment': 'telecom-and-communication-equipment',
    'furniture & interior supplies': 'furniture-and-interior-supplies',
    'furniture-and-interior-supplies': 'furniture-and-interior-supplies',
    'general industrial supplier': 'general-industrial-supplier',
    'general-industrial-supplier': 'general-industrial-supplier',
    'mining & coal equipment': 'mining-and-coal-equipment',
    'mining-coal-equipment': 'mining-and-coal-equipment',
    'mining-and-coal-equipment': 'mining-and-coal-equipment',
    'power & energy equipment': 'power-and-energy-equipment',
    'power-energy-equipment': 'power-and-energy-equipment',
    'power-and-energy-equipment': 'power-and-energy-equipment',
    'gas equipment & cylinders': 'gas-equipment-and-cylinders',
    'gas-equipment-and-cylinders': 'gas-equipment-and-cylinders',
    'conveyor & material handling equipment': 'conveyor-and-material-handling-equipment',
    'conveyor-and-material-handling-equipment': 'conveyor-and-material-handling-equipment',
    'pumps, motors & hydraulics': 'pumps-motors-and-hydraulics',
    'pumps-motors-and-hydraulics': 'pumps-motors-and-hydraulics',
    'industrial seals & gaskets': 'industrial-seals-and-gaskets',
    'industrial-seals-and-gaskets': 'industrial-seals-and-gaskets',
    'welding & cutting equipment': 'welding-and-cutting-equipment',
    'welding-and-cutting-equipment': 'welding-and-cutting-equipment',
    'industrial fasteners & components': 'industrial-fasteners-and-components',
    'industrial-fasteners-and-components': 'industrial-fasteners-and-components',
    'retail & commercial supply': 'retail-and-commercial-supply',
    'retail-and-commercial-supply': 'retail-and-commercial-supply',
    'fmcg & daily utility supply': 'fmcg-and-daily-utility-supply',
    'fmcg-and-daily-utility-supply': 'fmcg-and-daily-utility-supply',
    'textile & garments supply': 'textile-and-garments-supply',
    'textile-and-garments-supply': 'textile-and-garments-supply',
    'oem / manufacturing vendor': 'oem-manufacturing-vendor',
    'oem-manufacturing-vendor': 'oem-manufacturing-vendor',
    'repair & service provider': 'repair-and-service-provider',
    'repair-and-service-provider': 'repair-and-service-provider',
    'multi-category industrial vendor': 'multi-category-industrial-vendor',
    'multi-category-industrial-vendor': 'multi-category-industrial-vendor',
};

const KEYWORD_ICON_RULES: [string[], string][] = [
    [['cable', 'wire', 'transformer'], 'electrical-cables-and-power-equipment'],
    [['robot', 'automation', 'plc', 'sensor'], 'automation-and-robotics'],
    [['cement', 'concrete', 'mortar', 'paver'], 'cement-and-concrete-products'],
    [['pipe', 'tile', 'plumbing', 'fitting', 'sanitary'], 'pipes-tiles-and-hardware'],
    [['bearing', 'bushing', 'ball bearing'], 'bearings-and-mechanical-components'],
    [['fastener', 'bolt', 'nut', 'screw', 'washer'], 'industrial-fasteners-and-components'],
    [['conveyor', 'material handling', 'forklift', 'crane'], 'conveyor-and-material-handling-equipment'],
    [['pump', 'water pump', 'motor'], 'pumps-motors-and-hydraulics'],
    [['seal', 'gasket', 'o-ring'], 'industrial-seals-and-gaskets'],
    [['welding', 'weld', 'cutting torch', 'electrode'], 'welding-and-cutting-equipment'],
    [['mining', 'coal', 'mineral'], 'mining-and-coal-equipment'],
    [['gas', 'cylinder', 'oxygen', 'lpg'], 'gas-equipment-and-cylinders'],
    [['power', 'energy', 'solar', 'generator'], 'power-and-energy-equipment'],
    [['plastic', 'polymer', 'pvc', 'hdpe'], 'polymer-and-plastic-products'],
    [['machin', 'lathe', 'milling', 'spares'], 'industrial-machinery-and-spare-parts'],
    [['logistics', 'transport', 'freight', 'cargo'], 'logistics-and-supply-services'],
    [['trade', 'trading', 'distribution', 'distributor'], 'trading-and-distribution'],
    [['consultan', 'engineering design'], 'engineering-consultancy-services'],
    [['maintenance', 'servicing', 'overhaul'], 'industrial-maintenance-services'],
    [['civil', 'construction work', 'infrastructure'], 'construction-and-civil-work-services'],
    [['environment', 'waste', 'recycle'], 'environmental-and-waste-management'],
    [['telecom', 'communication', 'network'], 'telecom-and-communication-equipment'],
    [['furniture', 'chair', 'desk', 'interior'], 'furniture-interior-supplies'],
    [['consumable', 'abrasive'], 'industrial-consumables'],
    [['electric', 'appliance', 'electronic'], 'electrical-and-electronics'],
    [['office', 'stationery', 'paper'], 'office-equipment-and-stationery'],
    [['tool', 'hardware', 'wrench'], 'tools-and-industrial-hardware'],
    [['agri', 'farm', 'nursery', 'plant'], 'agriculture-and-nursery'],
    [['medic', 'health', 'hospital', 'pharma'], 'medical-and-healthcare-supplies'],
    [['safety', 'helmet', 'boot', 'protective'], 'safety-equipment-and-industrial-safety'],
    [['auto', 'car', 'vehicle', 'truck'], 'automobile-parts-and-services'],
    [['construct', 'building'], 'construction-and-building-materials'],
    [['chemic', 'laboratory'], 'industrial-chemicals'],
    [['refract', 'furnace', 'kiln', 'firebrick'], 'refractories'],
    [['tyre', 'tire', 'rubber'], 'tyres-and-rubber-products'],
    [['it ', 'computer', 'software', 'server'], 'it-and-computer-equipment'],
    [['fuel', 'petrol', 'diesel', 'oil'], 'fuel-oil-and-gas'],
    [['hydraulic', 'pneumatic'], 'hydraulics-and-pneumatics'],
    [['steel', 'metal', 'iron', 'aluminum'], 'steel-and-metal-products'],
    [['packag', 'box', 'carton', 'print'], 'packaging-and-printing'],
    [['shg', 'handicraft', 'artisan', 'handloom'], 'general-industrial-supplier'],
    [['textile', 'cloth', 'garment', 'fabric'], 'textile-and-garments-supply'],
    [['fmcg', 'daily utility', 'provision'], 'fmcg-and-daily-utility-supply'],
    [['retail', 'commercial'], 'retail-and-commercial-supply'],
    [['oem', 'manufacturing'], 'oem-manufacturing-vendor'],
    [['repair', 'service'], 'repair-and-service-provider'],
];

export const findCategorySvgFilename = (name?: string, slug?: string): string => {
    const cleanName = (name || '').toLowerCase().trim();
    const cleanSlug = (slug || '').toLowerCase().trim().replace(/&/g, 'and').replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');

    if (cleanSlug && BUNDLED_SLUG_SET.has(cleanSlug)) {
        return cleanSlug;
    }
    if (cleanSlug && CATEGORY_SVG_FILE_MAP[cleanSlug]) {
        return CATEGORY_SVG_FILE_MAP[cleanSlug];
    }
    if (cleanName && CATEGORY_SVG_FILE_MAP[cleanName]) {
        return CATEGORY_SVG_FILE_MAP[cleanName];
    }
    for (const [keywords, slugTarget] of KEYWORD_ICON_RULES) {
        if (keywords.some(kw => cleanName.includes(kw) || cleanSlug.includes(kw))) {
            return slugTarget;
        }
    }
    return 'general-industrial-supplier';
};

export const getBundledPhotoUrl = (name?: string, slug?: string): string => {
    const matchedSlug = findCategorySvgFilename(name, slug);
    return `/category-photos/${BUNDLED_CATEGORY_PHOTO_VERSION}/${matchedSlug}.webp`;
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
    return getBundledPhotoUrl(categoryName);
};

export const getCategoryVisualMeta = (category: MarketplaceCategory | string): CategoryVisualMeta => {
    const rawName = typeof category === 'string' ? category : category?.name || '';
    const rawSlug = typeof category === 'string' ? '' : category?.slug || '';

    // 1. If category object has custom imageUrl stored in database (e.g. data URI or uploaded file)
    if (typeof category === 'object' && category !== null) {
        const rawCustom = (category as any).imageUrl || (category as any).image || (category as any).photoUrl;
        if (typeof rawCustom === 'string' && rawCustom.trim()) {
            const trimmed = rawCustom.trim();
            if (trimmed.startsWith('data:')) {
                return {
                    imageUrl: normalizeDataUri(trimmed),
                    accentColor: '#2563eb',
                    categoryTag: rawName,
                };
            }
            const resolved = resolveMediaUrl(trimmed);
            if (resolved && !resolved.includes('/api/files/raw/categories/')) {
                return {
                    imageUrl: resolved,
                    accentColor: '#2563eb',
                    categoryTag: rawName,
                };
            }
        }
    }

    // 2. Direct match to Bundled Static Photo
    const bundledUrl = getBundledPhotoUrl(rawName, rawSlug);

    return {
        imageUrl: bundledUrl,
        accentColor: '#2563eb',
        categoryTag: rawName,
    };
};

export const getCategoryImageUrl = (category: MarketplaceCategory | string): string => {
    if (typeof category === 'object' && category !== null) {
        const rawCustom = (category as any).imageUrl || (category as any).image || (category as any).photoUrl;
        if (typeof rawCustom === 'string' && rawCustom.trim()) {
            const trimmed = rawCustom.trim();
            if (trimmed.startsWith('data:')) {
                return normalizeDataUri(trimmed);
            }
            const resolved = resolveMediaUrl(trimmed);
            if (resolved && !resolved.includes('/api/files/raw/categories/')) {
                return resolved;
            }
        }
        return getBundledPhotoUrl(category.name, category.slug);
    }

    if (typeof category === 'string') {
        return getBundledPhotoUrl(category);
    }

    return `/category-photos/${BUNDLED_CATEGORY_PHOTO_VERSION}/general-industrial-supplier.webp`;
};
