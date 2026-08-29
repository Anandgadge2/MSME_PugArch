import type { MarketplaceCategory } from '../api';
import { resolveMediaUrl } from '../../../lib/api';

export interface CategoryVisualMeta {
    imageUrl: string;
    accentColor: string;
    categoryTag: string;
}

export const BUNDLED_CATEGORY_PHOTO_VERSION = '1787987232675';

/**
 * Non-blocking client-side preloader to prime the browser image cache
 * so category photos appear instantly with zero latency.
 */
export const preloadCriticalCategoryPhotos = (limit = 14) => {
    if (typeof window === 'undefined') return;
    const slugs = Array.from(BUNDLED_SLUG_SET).slice(0, limit);
    for (const slug of slugs) {
        const img = new Image();
        img.src = `/category-photos/${BUNDLED_CATEGORY_PHOTO_VERSION}/${slug}.webp`;
    }
};

/**
 * Checks if a stored image URL is one of the legacy seed SVG illustrations.
 * Legacy placeholder SVGs should fall back to the bundled realistic industrial photography,
 * while actual admin-uploaded photos (e.g. from /photos/, .jpg, .png, .webp, data URIs) are preserved.
 */
export const isLegacyPlaceholderSvg = (url: unknown): boolean => {
    if (!url || typeof url !== 'string') return true;
    const trimmed = url.trim();
    if (!trimmed) return true;

    // Explicit user/admin upload formats
    if (trimmed.startsWith('data:') || trimmed.startsWith('blob:')) return false;
    if (trimmed.includes('/photos/') || trimmed.includes('/uploads/')) return false;

    // If it points to the legacy static SVG files in GCS or local /categories/*.svg
    const lower = trimmed.toLowerCase();
    if (lower.endsWith('.svg') || lower.includes('.svg?')) {
        return true;
    }
    if (lower.includes('/categories/') && !lower.includes('/photos/')) {
        return true;
    }

    return false;
};

export const BUNDLED_SLUG_SET = new Set([
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

const KEYWORD_PHOTO_RULES: [string[], string][] = [
    [['cable', 'wire', 'transformer', 'power line'], 'electrical-cables-and-power-equipment'],
    [['robot', 'automation', 'plc', 'sensor', 'robotic'], 'automation-and-robotics'],
    [['cement', 'concrete', 'mortar', 'paver', 'rcc'], 'cement-and-concrete-products'],
    [['pipe', 'tile', 'plumbing', 'fitting', 'sanitary', 'flange'], 'pipes-tiles-and-hardware'],
    [['bearing', 'bushing', 'ball bearing', 'roller bearing'], 'bearings-and-mechanical-components'],
    [['fastener', 'bolt', 'nut', 'screw', 'washer', 'rivet'], 'industrial-fasteners-and-components'],
    [['conveyor', 'material handling', 'forklift', 'crane', 'hoist'], 'conveyor-and-material-handling-equipment'],
    [['pump', 'water pump', 'motor', 'submersible'], 'pumps-motors-and-hydraulics'],
    [['seal', 'gasket', 'o-ring', 'packing'], 'industrial-seals-and-gaskets'],
    [['welding', 'weld', 'cutting torch', 'electrode', 'plasma'], 'welding-and-cutting-equipment'],
    [['mining', 'coal', 'mineral', 'excavat', 'quarry'], 'mining-and-coal-equipment'],
    [['gas', 'cylinder', 'oxygen', 'lpg', 'nitrogen', 'argon'], 'gas-equipment-and-cylinders'],
    [['power', 'energy', 'solar', 'generator', 'substation'], 'power-and-energy-equipment'],
    [['plastic', 'polymer', 'pvc', 'hdpe', 'molding'], 'polymer-and-plastic-products'],
    [['machin', 'lathe', 'milling', 'spares', 'cnc'], 'industrial-machinery-and-spare-parts'],
    [['logistics', 'transport', 'freight', 'cargo', 'fleet'], 'logistics-and-supply-services'],
    [['trade', 'trading', 'distribution', 'distributor', 'wholesale'], 'trading-and-distribution'],
    [['consultan', 'engineering design', 'advisory'], 'engineering-consultancy-services'],
    [['maintenance', 'servicing', 'overhaul', 'amc'], 'industrial-maintenance-services'],
    [['civil', 'construction work', 'infrastructure', 'roadwork'], 'construction-and-civil-work-services'],
    [['environment', 'waste', 'recycle', 'effluent', 'treatment'], 'environmental-and-waste-management'],
    [['telecom', 'communication', 'network', 'fiber'], 'telecom-and-communication-equipment'],
    [['furniture', 'chair', 'desk', 'interior', 'workstation'], 'furniture-and-interior-supplies'],
    [['consumable', 'abrasive', 'grinding', 'lubricant'], 'industrial-consumables'],
    [['electric', 'appliance', 'electronic', 'circuit', 'switchgear'], 'electrical-and-electronics'],
    [['office', 'stationery', 'paper', 'printer'], 'office-equipment-and-stationery'],
    [['tool', 'hardware', 'wrench', 'spanner', 'drill'], 'tools-and-industrial-hardware'],
    [['agri', 'farm', 'nursery', 'plant', 'fertilizer'], 'agriculture-and-nursery'],
    [['medic', 'health', 'hospital', 'pharma', 'clinical'], 'medical-and-healthcare-supplies'],
    [['safety', 'helmet', 'boot', 'protective', 'ppe', 'fire'], 'safety-equipment-and-industrial-safety'],
    [['auto', 'car', 'vehicle', 'truck', 'automotive'], 'automobile-parts-and-services'],
    [['construct', 'building', 'structure', 'tmt'], 'construction-and-building-materials'],
    [['chemic', 'laboratory', 'acid', 'solvent'], 'industrial-chemicals'],
    [['refract', 'furnace', 'kiln', 'firebrick', 'casting'], 'refractories'],
    [['tyre', 'tire', 'rubber'], 'tyres-and-rubber-products'],
    [['it ', 'computer', 'software', 'server', 'hardware'], 'it-and-computer-equipment'],
    [['fuel', 'petrol', 'diesel', 'oil', 'petroleum'], 'fuel-oil-and-gas'],
    [['hydraulic', 'pneumatic', 'piston'], 'hydraulics-and-pneumatics'],
    [['steel', 'metal', 'iron', 'aluminum', 'alloy'], 'steel-and-metal-products'],
    [['packag', 'box', 'carton', 'print', 'corrugated'], 'packaging-and-printing'],
    [['textile', 'cloth', 'garment', 'fabric', 'uniform'], 'textile-and-garments-supply'],
    [['fmcg', 'daily utility', 'provision', 'grocery'], 'fmcg-and-daily-utility-supply'],
    [['retail', 'commercial', 'store'], 'retail-and-commercial-supply'],
    [['oem', 'manufacturing', 'assembly'], 'oem-manufacturing-vendor'],
    [['repair', 'service', 'rebuild'], 'repair-and-service-provider'],
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
    for (const [keywords, slugTarget] of KEYWORD_PHOTO_RULES) {
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

/**
 * Returns complete visual metadata for a category.
 * If the admin has uploaded a custom photo in the database (or GCS), that image takes 100% priority.
 * Otherwise, falls back to the bundled realistic industrial photograph.
 */
export const getCategoryVisualMeta = (category: MarketplaceCategory | string): CategoryVisualMeta => {
    const rawName = typeof category === 'string' ? category : category?.name || '';
    const rawSlug = typeof category === 'string' ? '' : category?.slug || '';

    // 1. If category object has custom photo uploaded by Admin
    if (typeof category === 'object' && category !== null) {
        const rawCustom = (category as any).imageUrl || (category as any).image || (category as any).photoUrl;
        if (typeof rawCustom === 'string' && rawCustom.trim()) {
            const trimmed = rawCustom.trim();
            if (!isLegacyPlaceholderSvg(trimmed)) {
                if (trimmed.startsWith('data:') || trimmed.startsWith('blob:')) {
                    return {
                        imageUrl: normalizeDataUri(trimmed),
                        accentColor: '#2563eb',
                        categoryTag: rawName,
                    };
                }
                const resolved = resolveMediaUrl(trimmed);
                if (resolved) {
                    return {
                        imageUrl: resolved,
                        accentColor: '#2563eb',
                        categoryTag: rawName,
                    };
                }
            }
        }
    }

    // 2. Direct match to Bundled Realistic Industrial Photo (.webp)
    const bundledUrl = getBundledPhotoUrl(rawName, rawSlug);

    return {
        imageUrl: bundledUrl,
        accentColor: '#2563eb',
        categoryTag: rawName,
    };
};

/**
 * Returns the final display image URL for a category.
 * Admin-uploaded photo takes highest priority; otherwise returns realistic industrial photo from /category-photos/.
 */
export const getCategoryImageUrl = (category: MarketplaceCategory | string): string => {
    if (typeof category === 'object' && category !== null) {
        const rawCustom = (category as any).imageUrl || (category as any).image || (category as any).photoUrl;
        if (typeof rawCustom === 'string' && rawCustom.trim()) {
            const trimmed = rawCustom.trim();
            if (!isLegacyPlaceholderSvg(trimmed)) {
                if (trimmed.startsWith('data:') || trimmed.startsWith('blob:')) {
                    return normalizeDataUri(trimmed);
                }
                const resolved = resolveMediaUrl(trimmed);
                if (resolved) {
                    return resolved;
                }
            }
        }
        return getBundledPhotoUrl(category.name, category.slug);
    }

    if (typeof category === 'string') {
        return getBundledPhotoUrl(category);
    }

    return `/category-photos/${BUNDLED_CATEGORY_PHOTO_VERSION}/general-industrial-supplier.webp`;
};
