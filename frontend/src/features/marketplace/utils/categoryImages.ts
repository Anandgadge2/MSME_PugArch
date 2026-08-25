import type { MarketplaceCategory } from '../api';

export interface CategoryVisualMeta {
    imageUrl: string;
    accentColor: string;
    categoryTag: string;
}

const DYNAMIC_PALETTES = [
    { bg1: '#eff6ff', bg2: '#dbeafe', stroke: '#2563eb', fill: '#1d4ed8', text: '#1e40af' },
    { bg1: '#ecfdf5', bg2: '#d1fae5', stroke: '#059669', fill: '#047857', text: '#065f46' },
    { bg1: '#fef3c7', bg2: '#fde68a', stroke: '#d97706', fill: '#b45309', text: '#92400e' },
    { bg1: '#fdf2f8', bg2: '#fce7f3', stroke: '#db2777', fill: '#be185d', text: '#9d174d' },
    { bg1: '#faf5ff', bg2: '#f3e8ff', stroke: '#9333ea', fill: '#7e22ce', text: '#6b21a8' },
    { bg1: '#f0fdfa', bg2: '#ccfbf1', stroke: '#0d9488', fill: '#0f766e', text: '#115e59' },
    { bg1: '#fff7ed', bg2: '#ffedd5', stroke: '#ea580c', fill: '#c2410c', text: '#9a3412' },
    { bg1: '#f8fafc', bg2: '#e2e8f0', stroke: '#475569', fill: '#334155', text: '#1e293b' },
    { bg1: '#f5f3ff', bg2: '#ede9fe', stroke: '#6366f1', fill: '#4f46e5', text: '#3730a3' },
    { bg1: '#f0fdf4', bg2: '#dcfce7', stroke: '#16a34a', fill: '#15803d', text: '#14532d' },
];

const sanitizeSvgText = (value: string) =>
    String(value || '')
        .replace(/[<>&"]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 24);

const getInitials = (name: string): string => {
    const words = name.trim().split(/\s+/).filter(w => !['&', 'and', 'of', 'for', 'the'].includes(w.toLowerCase()));
    if (words.length >= 2) {
        return (words[0][0] + words[1][0]).toUpperCase();
    }
    return (name.trim().slice(0, 2) || 'MS').toUpperCase();
};

const hashString = (str: string): number => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = (hash << 5) - hash + str.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash);
};

export const buildCategoryFallbackSvg = (categoryName: string, accentColor?: string): string => {
    const name = sanitizeSvgText(categoryName || 'MSME Category');
    const initials = getInitials(name);
    const hash = hashString(categoryName || 'default');
    const palette = DYNAMIC_PALETTES[hash % DYNAMIC_PALETTES.length];
    const strokeColor = accentColor || palette.stroke;

    const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
            <defs>
                <linearGradient id="catbg_${hash}" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stop-color="${palette.bg1}" />
                    <stop offset="100%" stop-color="${palette.bg2}" />
                </linearGradient>
                <linearGradient id="badge_${hash}" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stop-color="${strokeColor}" />
                    <stop offset="100%" stop-color="${palette.fill}" />
                </linearGradient>
                <filter id="shadow_${hash}" x="-15%" y="-15%" width="130%" height="130%">
                    <feDropShadow dx="0" dy="4" stdDeviation="4" flood-opacity="0.18"/>
                </filter>
            </defs>
            <!-- Background Card -->
            <rect width="190" height="190" x="5" y="5" rx="28" fill="url(#catbg_${hash})" stroke="${strokeColor}" stroke-width="2" opacity="0.95"/>
            <!-- 3D Category Emblem Badge -->
            <g filter="url(#shadow_${hash})">
                <circle cx="100" cy="80" r="42" fill="url(#badge_${hash})"/>
                <circle cx="100" cy="80" r="36" fill="#ffffff" opacity="0.18"/>
                <!-- Category Initials Monogram -->
                <text x="100" y="91" fill="#ffffff" font-family="system-ui, -apple-system, sans-serif" font-size="28" font-weight="900" text-anchor="middle" letter-spacing="1.5">${initials}</text>
            </g>
            <!-- Decorative Accent Elements -->
            <circle cx="48" cy="48" r="4" fill="${strokeColor}" opacity="0.4"/>
            <circle cx="152" cy="48" r="4" fill="${strokeColor}" opacity="0.4"/>
            <circle cx="100" cy="138" r="3" fill="${strokeColor}" opacity="0.6"/>
            <!-- Category Title Line -->
            <text x="100" y="160" fill="${palette.text}" font-family="system-ui, -apple-system, sans-serif" font-size="13" font-weight="800" text-anchor="middle">${name}</text>
        </svg>`;
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg.replace(/\s+/g, ' ').trim())}`;
};

const CATEGORY_STOCK_IMAGES: Record<string, string> = {
    'electrical-and-electronics': 'https://images.unsplash.com/photo-1555664424-778a1e5e1b48?w=360&q=85&auto=format&fit=crop',
    'mechanical-and-engineering': 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=360&q=85&auto=format&fit=crop',
    'construction-and-building-materials': 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=360&q=85&auto=format&fit=crop',
    'industrial-chemicals': 'https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?w=360&q=85&auto=format&fit=crop',
    'refractories': 'https://images.unsplash.com/photo-1504917599217-d4dc5ebe6122?w=360&q=85&auto=format&fit=crop',
    'automobile-parts-and-services': 'https://images.unsplash.com/photo-1486006920555-c77dce18193b?w=360&q=85&auto=format&fit=crop',
    'tyres-and-rubber-products': 'https://images.unsplash.com/photo-1578844251758-2f71da64c96f?w=360&q=85&auto=format&fit=crop',
    'it-and-computer-equipment': 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=360&q=85&auto=format&fit=crop',
    'office-equipment-and-stationery': 'https://images.unsplash.com/photo-1497215728101-856f4ea42174?w=360&q=85&auto=format&fit=crop',
    'medical-and-healthcare-supplies': 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=360&q=85&auto=format&fit=crop',
    'agriculture-and-nursery': 'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?w=360&q=85&auto=format&fit=crop',
    'safety-equipment-and-industrial-safety': 'https://images.unsplash.com/photo-1618090584176-7132b9911657?w=360&q=85&auto=format&fit=crop',
    'fuel-oil-and-gas': 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=360&q=85&auto=format&fit=crop',
    'hydraulics-and-pneumatics': 'https://images.unsplash.com/photo-1581092335397-9583fe92d232?w=360&q=85&auto=format&fit=crop',
    'steel-and-metal-products': 'https://images.unsplash.com/photo-1504917599217-d4dc5ebe6122?w=360&q=85&auto=format&fit=crop',
    'cement-and-concrete-products': 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=360&q=85&auto=format&fit=crop',
    'pipes-tiles-and-hardware': 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=360&q=85&auto=format&fit=crop',
    'industrial-machinery-and-spare-parts': 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=360&q=85&auto=format&fit=crop',
    'automation-and-robotics': 'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=360&q=85&auto=format&fit=crop',
    'fabrication-and-welding-services': 'https://images.unsplash.com/photo-1504917599217-d4dc5ebe6122?w=360&q=85&auto=format&fit=crop',
    'bearings-and-mechanical-components': 'https://images.unsplash.com/photo-1581092335397-9583fe92d232?w=360&q=85&auto=format&fit=crop',
    'electrical-cables-and-power-equipment': 'https://images.unsplash.com/photo-1555664424-778a1e5e1b48?w=360&q=85&auto=format&fit=crop',
    'industrial-consumables': 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=360&q=85&auto=format&fit=crop',
    'packaging-and-printing': 'https://images.unsplash.com/photo-1530587191325-3db32d826c18?w=360&q=85&auto=format&fit=crop',
    'polymer-and-plastic-products': 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=360&q=85&auto=format&fit=crop',
    'trading-and-distribution': 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=360&q=85&auto=format&fit=crop',
    'logistics-and-supply-services': 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=360&q=85&auto=format&fit=crop',
    'tools-and-industrial-hardware': 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=360&q=85&auto=format&fit=crop',
    'laboratory-equipment-and-chemicals': 'https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?w=360&q=85&auto=format&fit=crop',
    'engineering-consultancy-services': 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=360&q=85&auto=format&fit=crop',
    'industrial-maintenance-services': 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=360&q=85&auto=format&fit=crop',
    'construction-and-civil-work-services': 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=360&q=85&auto=format&fit=crop',
    'environmental-and-waste-management': 'https://images.unsplash.com/photo-1532996122724-e3c354a0b15b?w=360&q=85&auto=format&fit=crop',
    'telecom-and-communication-equipment': 'https://images.unsplash.com/photo-1544197150-b99a580bb7a8?w=360&q=85&auto=format&fit=crop',
    'furniture-and-interior-supplies': 'https://images.unsplash.com/photo-1524758631624-e2822e304c36?w=360&q=85&auto=format&fit=crop',
    'general-industrial-supplier': 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=360&q=85&auto=format&fit=crop',
    'mining-and-coal-equipment': 'https://images.unsplash.com/photo-1578328819058-b69f3a3b0f6b?w=360&q=85&auto=format&fit=crop',
    'power-and-energy-equipment': 'https://images.unsplash.com/photo-1473341304170-971dccb5ac1e?w=360&q=85&auto=format&fit=crop',
    'gas-equipment-and-cylinders': 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=360&q=85&auto=format&fit=crop',
    'conveyor-and-material-handling-equipment': 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=360&q=85&auto=format&fit=crop',
    'pumps-motors-and-hydraulics': 'https://images.unsplash.com/photo-1581092335397-9583fe92d232?w=360&q=85&auto=format&fit=crop',
    'industrial-seals-and-gaskets': 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=360&q=85&auto=format&fit=crop',
    'welding-and-cutting-equipment': 'https://images.unsplash.com/photo-1504917599217-d4dc5ebe6122?w=360&q=85&auto=format&fit=crop',
    'industrial-fasteners-and-components': 'https://images.unsplash.com/photo-1581092335397-9583fe92d232?w=360&q=85&auto=format&fit=crop',
    'retail-and-commercial-supply': 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=360&q=85&auto=format&fit=crop',
    'fmcg-and-daily-utility-supply': 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=360&q=85&auto=format&fit=crop',
    'textile-and-garments-supply': 'https://images.unsplash.com/photo-1606744824163-985d376605aa?w=360&q=85&auto=format&fit=crop',
    'oem-manufacturing-vendor': 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=360&q=85&auto=format&fit=crop',
    'repair-and-service-provider': 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=360&q=85&auto=format&fit=crop',
    'multi-category-industrial-vendor': 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=360&q=85&auto=format&fit=crop'
};

const findCuratedStockImage = (name: string, slug?: string): string | null => {
    const cleanSlug = (slug || '').toLowerCase().trim();
    if (cleanSlug && CATEGORY_STOCK_IMAGES[cleanSlug]) {
        return CATEGORY_STOCK_IMAGES[cleanSlug];
    }
    const cleanName = (name || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-');
    if (CATEGORY_STOCK_IMAGES[cleanName]) {
        return CATEGORY_STOCK_IMAGES[cleanName];
    }
    for (const [key, url] of Object.entries(CATEGORY_STOCK_IMAGES)) {
        if (cleanSlug.includes(key) || cleanName.includes(key) || key.includes(cleanSlug) || key.includes(cleanName)) {
            return url;
        }
    }
    return null;
};

export const normalizeDataUri = (url: unknown): string => {
    if (!url || typeof url !== 'string') return '';
    const trimmed = url.trim();
    if (trimmed.startsWith('data:image/svg+xml;utf8,')) {
        return trimmed.replace('data:image/svg+xml;utf8,', 'data:image/svg+xml;charset=utf-8,');
    }
    return trimmed;
};

export const getCategoryVisualMeta = (category: MarketplaceCategory | string): CategoryVisualMeta => {
    const rawName = typeof category === 'string' ? category : category?.name || '';
    const rawSlug = typeof category === 'string' ? '' : category?.slug || '';
    const cleanName = rawName.trim().toLowerCase();
    const hash = hashString(cleanName || 'category');
    const palette = DYNAMIC_PALETTES[hash % DYNAMIC_PALETTES.length];

    // 1. If category object has imageUrl stored in database
    if (typeof category === 'object' && category !== null) {
        const rawCustom = (category as any).imageUrl || (category as any).image || (category as any).photoUrl;
        const customImage = normalizeDataUri(rawCustom);
        if (customImage && (customImage.startsWith('data:image/') || customImage.startsWith('http://') || customImage.startsWith('https://') || customImage.startsWith('/'))) {
            return {
                imageUrl: customImage,
                accentColor: palette.stroke,
                categoryTag: rawName,
            };
        }
    }

    // 2. Curated stock photo mapping for crisp industrial visual clarity
    const curatedImage = findCuratedStockImage(rawName, rawSlug);
    if (curatedImage) {
        return {
            imageUrl: curatedImage,
            accentColor: palette.stroke,
            categoryTag: rawName,
        };
    }

    // 3. Fallback to dynamically generated unique SVG tailored to this category name
    return {
        imageUrl: buildCategoryFallbackSvg(rawName, palette.stroke),
        accentColor: palette.stroke,
        categoryTag: rawName,
    };
};

export const getCategoryImageUrl = (category: MarketplaceCategory | string): string => {
    if (typeof category === 'object' && category !== null) {
        // If the category object already has a custom image from database
        const rawIcon = (category as any).imageUrl || (category as any).image || (category as any).photoUrl;
        const iconProp = normalizeDataUri(rawIcon);
        if (iconProp && (iconProp.startsWith('data:image/') || iconProp.startsWith('http://') || iconProp.startsWith('https://') || iconProp.startsWith('/'))) {
            return iconProp;
        }
        const curated = findCuratedStockImage(category.name, category.slug);
        if (curated) return curated;
    } else if (typeof category === 'string') {
        const curated = findCuratedStockImage(category);
        if (curated) return curated;
    }
    return getCategoryVisualMeta(category).imageUrl;
};
