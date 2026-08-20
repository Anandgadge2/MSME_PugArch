import type { MarketplaceCategory } from '../api';

export interface CategoryVisualMeta {
    imageUrl: string;
    accentColor: string;
    categoryTag: string;
}

// Clean isolated product cluster SVGs with transparent backgrounds
const CATEGORY_IMAGE_REGISTRY: Record<string, { imageUrl: string; accentColor: string }> = {
    'electrical & electronics': {
        imageUrl: '/categories/electrical-electronics.svg',
        accentColor: '#d97706',
    },
    'electrical & appliances': {
        imageUrl: '/categories/electrical-electronics.svg',
        accentColor: '#d97706',
    },
    'office supplies': {
        imageUrl: '/categories/office-supplies.svg',
        accentColor: '#0284c7',
    },
    'office equipment & stationery': {
        imageUrl: '/categories/office-supplies.svg',
        accentColor: '#0284c7',
    },
    'industrial tools': {
        imageUrl: '/categories/tools-hardware.svg',
        accentColor: '#ca8a04',
    },
    'tools & industrial hardware': {
        imageUrl: '/categories/tools-hardware.svg',
        accentColor: '#ca8a04',
    },
    'mechanical & engineering': {
        imageUrl: '/categories/tools-hardware.svg',
        accentColor: '#2563eb',
    },
    'agri & gardening': {
        imageUrl: '/categories/agriculture-nursery.svg',
        accentColor: '#16a34a',
    },
    'agriculture & nursery': {
        imageUrl: '/categories/agriculture-nursery.svg',
        accentColor: '#16a34a',
    },
    'medical & lab supplies': {
        imageUrl: '/categories/medical-supplies.svg',
        accentColor: '#059669',
    },
    'medical & healthcare supplies': {
        imageUrl: '/categories/medical-supplies.svg',
        accentColor: '#059669',
    },
    'laboratory equipment & chemicals': {
        imageUrl: '/categories/industrial-chemicals.svg',
        accentColor: '#0f766e',
    },
    'safety supplies': {
        imageUrl: '/categories/safety-supplies.svg',
        accentColor: '#ea580c',
    },
    'safety equipment & industrial safety': {
        imageUrl: '/categories/safety-supplies.svg',
        accentColor: '#ea580c',
    },
    'automotive': {
        imageUrl: '/categories/automobile-parts.svg',
        accentColor: '#dc2626',
    },
    'automobile parts & services': {
        imageUrl: '/categories/automobile-parts.svg',
        accentColor: '#dc2626',
    },
    'construction materials': {
        imageUrl: '/categories/construction-materials.svg',
        accentColor: '#ea580c',
    },
    'construction & building materials': {
        imageUrl: '/categories/construction-materials.svg',
        accentColor: '#ea580c',
    },
    'industrial chemicals': {
        imageUrl: '/categories/industrial-chemicals.svg',
        accentColor: '#0f766e',
    },
    'refractories': {
        imageUrl: '/categories/refractories.svg',
        accentColor: '#c2410c',
    },
    'tyres & rubber products': {
        imageUrl: '/categories/tyres-rubber.svg',
        accentColor: '#334155',
    },
    'it & computer equipment': {
        imageUrl: '/categories/it-computer.svg',
        accentColor: '#4f46e5',
    },
    'fuel, oil & gas': {
        imageUrl: '/categories/fuel-oil-gas.svg',
        accentColor: '#d97706',
    },
    'hydraulics & pneumatics': {
        imageUrl: '/categories/hydraulics-pneumatics.svg',
        accentColor: '#0284c7',
    },
    'steel & metal products': {
        imageUrl: '/categories/steel-metal.svg',
        accentColor: '#475569',
    },
    'cement & concrete products': {
        imageUrl: '/categories/construction-materials.svg',
        accentColor: '#57534e',
    },
    'pipes, tiles & hardware': {
        imageUrl: '/categories/construction-materials.svg',
        accentColor: '#0369a1',
    },
    'industrial machinery & spare parts': {
        imageUrl: '/categories/tools-hardware.svg',
        accentColor: '#1e40af',
    },
    'automation & robotics': {
        imageUrl: '/categories/electrical-electronics.svg',
        accentColor: '#7c3aed',
    },
    'fabrication & welding services': {
        imageUrl: '/categories/tools-hardware.svg',
        accentColor: '#c2410c',
    },
    'bearings & mechanical components': {
        imageUrl: '/categories/tools-hardware.svg',
        accentColor: '#334155',
    },
    'electrical cables & power equipment': {
        imageUrl: '/categories/electrical-electronics.svg',
        accentColor: '#d97706',
    },
    'industrial consumables': {
        imageUrl: '/categories/tools-hardware.svg',
        accentColor: '#52525b',
    },
    'packaging & printing': {
        imageUrl: '/categories/packaging-printing.svg',
        accentColor: '#9333ea',
    },
    'polymer & plastic products': {
        imageUrl: '/categories/industrial-chemicals.svg',
        accentColor: '#0d9488',
    },
    'trading & distribution': {
        imageUrl: '/categories/packaging-printing.svg',
        accentColor: '#0284c7',
    },
    'logistics & supply services': {
        imageUrl: '/categories/packaging-printing.svg',
        accentColor: '#15803d',
    },
    'engineering consultancy services': {
        imageUrl: '/categories/tools-hardware.svg',
        accentColor: '#4338ca',
    },
    'industrial maintenance services': {
        imageUrl: '/categories/tools-hardware.svg',
        accentColor: '#0f766e',
    },
    'construction & civil work services': {
        imageUrl: '/categories/construction-materials.svg',
        accentColor: '#b45309',
    },
    'environmental & waste management': {
        imageUrl: '/categories/agriculture-nursery.svg',
        accentColor: '#047857',
    },
    'telecom & communication equipment': {
        imageUrl: '/categories/it-computer.svg',
        accentColor: '#2563eb',
    },
    'furniture & interior supplies': {
        imageUrl: '/categories/office-supplies.svg',
        accentColor: '#e11d48',
    },
    'general industrial supplier': {
        imageUrl: '/categories/tools-hardware.svg',
        accentColor: '#1e40af',
    },
    'mining & coal equipment': {
        imageUrl: '/categories/tools-hardware.svg',
        accentColor: '#3f3f46',
    },
    'power & energy equipment': {
        imageUrl: '/categories/electrical-electronics.svg',
        accentColor: '#b45309',
    },
    'gas equipment & cylinders': {
        imageUrl: '/categories/fuel-oil-gas.svg',
        accentColor: '#b91c1c',
    },
    'conveyor & material handling equipment': {
        imageUrl: '/categories/tyres-rubber.svg',
        accentColor: '#0e7490',
    },
    'pumps, motors & hydraulics': {
        imageUrl: '/categories/electrical-electronics.svg',
        accentColor: '#0284c7',
    },
    'industrial seals & gaskets': {
        imageUrl: '/categories/tyres-rubber.svg',
        accentColor: '#475569',
    },
    'welding & cutting equipment': {
        imageUrl: '/categories/tools-hardware.svg',
        accentColor: '#c2410c',
    },
    'industrial fasteners & components': {
        imageUrl: '/categories/tools-hardware.svg',
        accentColor: '#52525b',
    },
    'retail & commercial supply': {
        imageUrl: '/categories/office-supplies.svg',
        accentColor: '#4f46e5',
    },
    'fmcg & daily utility supply': {
        imageUrl: '/categories/shg-handicrafts.svg',
        accentColor: '#65a30d',
    },
    'textile & garments supply': {
        imageUrl: '/categories/textiles-garments.svg',
        accentColor: '#e11d48',
    },
    'shg & handicrafts': {
        imageUrl: '/categories/shg-handicrafts.svg',
        accentColor: '#059669',
    },
    'oem / manufacturing vendor': {
        imageUrl: '/categories/tools-hardware.svg',
        accentColor: '#1d4ed8',
    },
    'repair & service provider': {
        imageUrl: '/categories/tools-hardware.svg',
        accentColor: '#0284c7',
    },
    'multi-category industrial vendor': {
        imageUrl: '/categories/tools-hardware.svg',
        accentColor: '#3730a3',
    },
};

// Keyword fallback rules for dynamic or custom categories
const KEYWORD_IMAGE_RULES: [string[], { imageUrl: string; accentColor: string }][] = [
    [['electric', 'power', 'appliance', 'electronic', 'cable', 'transformer', 'wiring', 'solar', 'grid', 'sensor', 'motor', 'pump'], {
        imageUrl: '/categories/electrical-electronics.svg',
        accentColor: '#d97706',
    }],
    [['office', 'stationery', 'printer', 'paper', 'desk', 'toner', 'chair', 'furniture'], {
        imageUrl: '/categories/office-supplies.svg',
        accentColor: '#0284c7',
    }],
    [['tool', 'machin', 'mechanical', 'lathe', 'gear', 'engine', 'hardware', 'drill', 'saw', 'grind', 'bearing'], {
        imageUrl: '/categories/tools-hardware.svg',
        accentColor: '#ca8a04',
    }],
    [['agri', 'farm', 'garden', 'nursery', 'plant', 'crop', 'soil', 'irrigation', 'seed'], {
        imageUrl: '/categories/agriculture-nursery.svg',
        accentColor: '#16a34a',
    }],
    [['medic', 'health', 'hospital', 'clinic', 'pharma', 'surgical', 'ppe', 'diagnostic', 'doctor'], {
        imageUrl: '/categories/medical-supplies.svg',
        accentColor: '#059669',
    }],
    [['safety', 'helmet', 'boot', 'protective', 'fire', 'extinguisher', 'hazard', 'shield'], {
        imageUrl: '/categories/safety-supplies.svg',
        accentColor: '#ea580c',
    }],
    [['auto', 'car', 'vehicle', 'truck', 'brake', 'transmission', 'clutch', 'oil', 'wheel'], {
        imageUrl: '/categories/automobile-parts.svg',
        accentColor: '#dc2626',
    }],
    [['construct', 'building', 'cement', 'concrete', 'brick', 'sand', 'civil', 'scaffold', 'tile', 'pipe'], {
        imageUrl: '/categories/construction-materials.svg',
        accentColor: '#ea580c',
    }],
    [['chemic', 'flask', 'pharma', 'laboratory', 'acid', 'polymer', 'reagent', 'petro', 'drum'], {
        imageUrl: '/categories/industrial-chemicals.svg',
        accentColor: '#0f766e',
    }],
    [['refract', 'furnace', 'kiln', 'firebrick', 'crucible', 'thermal', 'foundry', 'casting'], {
        imageUrl: '/categories/refractories.svg',
        accentColor: '#c2410c',
    }],
    [['tyre', 'tire', 'rubber', 'tread', 'vulcaniz', 'conveyor', 'seal', 'gasket'], {
        imageUrl: '/categories/tyres-rubber.svg',
        accentColor: '#334155',
    }],
    [['it ', 'computer', 'software', 'network', 'telecom', 'server', 'data', 'cloud', 'laptop', 'monitor'], {
        imageUrl: '/categories/it-computer.svg',
        accentColor: '#4f46e5',
    }],
    [['fuel', 'petrol', 'diesel', 'gas', 'cylinder', 'lpg', 'lubricant'], {
        imageUrl: '/categories/fuel-oil-gas.svg',
        accentColor: '#d97706',
    }],
    [['hydraulic', 'pneumatic', 'piston', 'valve', 'compressor'], {
        imageUrl: '/categories/hydraulics-pneumatics.svg',
        accentColor: '#0284c7',
    }],
    [['steel', 'metal', 'iron', 'aluminum', 'sheet', 'alloy', 'rebar', 'beam', 'coil'], {
        imageUrl: '/categories/steel-metal.svg',
        accentColor: '#475569',
    }],
    [['packag', 'box', 'carton', 'corrugat', 'print', 'label', 'shipping', 'tape'], {
        imageUrl: '/categories/packaging-printing.svg',
        accentColor: '#9333ea',
    }],
    [['shg', 'handicraft', 'artisan', 'handloom', 'women', 'rural', 'cottage', 'pottery', 'fmcg'], {
        imageUrl: '/categories/shg-handicrafts.svg',
        accentColor: '#059669',
    }],
    [['textile', 'cloth', 'garment', 'fabric', 'uniform', 'apparel'], {
        imageUrl: '/categories/textiles-garments.svg',
        accentColor: '#e11d48',
    }],
];

const DEFAULT_CATEGORY_META = {
    imageUrl: '/categories/tools-hardware.svg',
    accentColor: '#2563eb',
};

const sanitizeSvgText = (value: string) =>
    String(value || '')
        .replace(/[<>&"]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 28);

export const buildCategoryFallbackSvg = (categoryName: string, accentColor = '#2563eb') => {
    const title = sanitizeSvgText(categoryName || 'MSME Category');
    const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="140" height="140" viewBox="0 0 140 140">
            <defs>
                <linearGradient id="catbg" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stop-color="#f8fafc" />
                    <stop offset="100%" stop-color="#e2e8f0" />
                </linearGradient>
            </defs>
            <rect width="140" height="140" rx="16" fill="url(#catbg)"/>
            <circle cx="70" cy="55" r="30" fill="${accentColor}" opacity="0.12"/>
            <g transform="translate(56, 41)" fill="none" stroke="${accentColor}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
            </g>
            <text x="70" y="105" fill="#1e293b" font-family="system-ui, -apple-system, sans-serif" font-size="10" font-weight="700" text-anchor="middle">${title}</text>
        </svg>`;
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg.replace(/\s+/g, ' ').trim())}`;
};

export const getCategoryVisualMeta = (category: MarketplaceCategory | string): CategoryVisualMeta => {
    const rawName = typeof category === 'string' ? category : category.name || '';
    const cleanName = rawName.trim().toLowerCase();

    // 1. Direct match in registry
    if (CATEGORY_IMAGE_REGISTRY[cleanName]) {
        const direct = CATEGORY_IMAGE_REGISTRY[cleanName];
        return {
            imageUrl: direct.imageUrl,
            accentColor: direct.accentColor,
            categoryTag: rawName,
        };
    }

    // 2. Keyword fuzzy match
    for (const [keywords, meta] of KEYWORD_IMAGE_RULES) {
        if (keywords.some(kw => cleanName.includes(kw))) {
            return {
                imageUrl: meta.imageUrl,
                accentColor: meta.accentColor,
                categoryTag: rawName,
            };
        }
    }

    // 3. Fallback
    return {
        ...DEFAULT_CATEGORY_META,
        categoryTag: rawName,
    };
};

export const getCategoryImageUrl = (category: MarketplaceCategory | string): string => {
    if (typeof category === 'object' && category !== null) {
        // If the category object already has a custom image path or icon
        const iconProp = (category as any).imageUrl || (category as any).image || (category as any).photoUrl || category.icon;
        if (typeof iconProp === 'string' && (iconProp.startsWith('http://') || iconProp.startsWith('https://') || iconProp.startsWith('/'))) {
            return iconProp;
        }
    }
    return getCategoryVisualMeta(category).imageUrl;
};
