import type { MarketplaceCategory } from '../api';

export interface CategoryVisualMeta {
    imageUrl: string;
    accentColor: string;
    categoryTag: string;
}

// Clean isolated product cluster SVGs with transparent backgrounds - Each category has its own distinct icon
const CATEGORY_IMAGE_REGISTRY: Record<string, { imageUrl: string; accentColor: string }> = {
    // 1. Electrical & Electronics
    'electrical & electronics': {
        imageUrl: '/categories/electrical-electronics.svg',
        accentColor: '#d97706',
    },
    'electrical & appliances': {
        imageUrl: '/categories/electrical-electronics.svg',
        accentColor: '#d97706',
    },

    // 2. Mechanical & Engineering
    'mechanical & engineering': {
        imageUrl: '/categories/mechanical-engineering.svg',
        accentColor: '#2563eb',
    },

    // 3. Construction & Building Materials
    'construction & building materials': {
        imageUrl: '/categories/construction-materials.svg',
        accentColor: '#ea580c',
    },
    'construction materials': {
        imageUrl: '/categories/construction-materials.svg',
        accentColor: '#ea580c',
    },

    // 4. Industrial Chemicals
    'industrial chemicals': {
        imageUrl: '/categories/industrial-chemicals.svg',
        accentColor: '#0f766e',
    },

    // 5. Refractories
    'refractories': {
        imageUrl: '/categories/refractories.svg',
        accentColor: '#c2410c',
    },

    // 6. Automobile Parts & Services
    'automobile parts & services': {
        imageUrl: '/categories/automobile-parts.svg',
        accentColor: '#dc2626',
    },
    'automotive': {
        imageUrl: '/categories/automobile-parts.svg',
        accentColor: '#dc2626',
    },

    // 7. Tyres & Rubber Products
    'tyres & rubber products': {
        imageUrl: '/categories/tyres-rubber.svg',
        accentColor: '#334155',
    },

    // 8. IT & Computer Equipment
    'it & computer equipment': {
        imageUrl: '/categories/it-computer.svg',
        accentColor: '#4f46e5',
    },

    // 9. Office Equipment & Stationery
    'office equipment & stationery': {
        imageUrl: '/categories/office-supplies.svg',
        accentColor: '#0284c7',
    },
    'office supplies': {
        imageUrl: '/categories/office-supplies.svg',
        accentColor: '#0284c7',
    },

    // 10. Medical & Healthcare Supplies
    'medical & healthcare supplies': {
        imageUrl: '/categories/medical-supplies.svg',
        accentColor: '#059669',
    },
    'medical & lab supplies': {
        imageUrl: '/categories/medical-supplies.svg',
        accentColor: '#059669',
    },

    // 11. Agriculture & Nursery
    'agriculture & nursery': {
        imageUrl: '/categories/agriculture-nursery.svg',
        accentColor: '#16a34a',
    },
    'agri & gardening': {
        imageUrl: '/categories/agriculture-nursery.svg',
        accentColor: '#16a34a',
    },

    // 12. Safety Equipment & Industrial Safety
    'safety equipment & industrial safety': {
        imageUrl: '/categories/safety-supplies.svg',
        accentColor: '#ea580c',
    },
    'safety supplies': {
        imageUrl: '/categories/safety-supplies.svg',
        accentColor: '#ea580c',
    },

    // 13. Fuel, Oil & Gas
    'fuel, oil & gas': {
        imageUrl: '/categories/fuel-oil-gas.svg',
        accentColor: '#d97706',
    },

    // 14. Hydraulics & Pneumatics
    'hydraulics & pneumatics': {
        imageUrl: '/categories/hydraulics-pneumatics.svg',
        accentColor: '#0284c7',
    },

    // 15. Steel & Metal Products
    'steel & metal products': {
        imageUrl: '/categories/steel-metal.svg',
        accentColor: '#475569',
    },

    // 16. Cement & Concrete Products
    'cement & concrete products': {
        imageUrl: '/categories/cement-concrete.svg',
        accentColor: '#57534e',
    },

    // 17. Pipes, Tiles & Hardware
    'pipes, tiles & hardware': {
        imageUrl: '/categories/pipes-tiles.svg',
        accentColor: '#0369a1',
    },

    // 18. Industrial Machinery & Spare Parts
    'industrial machinery & spare parts': {
        imageUrl: '/categories/machinery-spares.svg',
        accentColor: '#1e40af',
    },

    // 19. Automation & Robotics
    'automation & robotics': {
        imageUrl: '/categories/automation-robotics.svg',
        accentColor: '#7c3aed',
    },

    // 20. Fabrication & Welding Services
    'fabrication & welding services': {
        imageUrl: '/categories/fabrication-welding.svg',
        accentColor: '#c2410c',
    },

    // 21. Bearings & Mechanical Components
    'bearings & mechanical components': {
        imageUrl: '/categories/bearings-mechanical.svg',
        accentColor: '#334155',
    },

    // 22. Electrical Cables & Power Equipment
    'electrical cables & power equipment': {
        imageUrl: '/categories/cables-power.svg',
        accentColor: '#d97706',
    },

    // 23. Industrial Consumables
    'industrial consumables': {
        imageUrl: '/categories/industrial-consumables.svg',
        accentColor: '#52525b',
    },

    // 24. Packaging & Printing
    'packaging & printing': {
        imageUrl: '/categories/packaging-printing.svg',
        accentColor: '#9333ea',
    },

    // 25. Polymer & Plastic Products
    'polymer & plastic products': {
        imageUrl: '/categories/polymers-plastics.svg',
        accentColor: '#0d9488',
    },

    // 26. Trading & Distribution
    'trading & distribution': {
        imageUrl: '/categories/trading-distribution.svg',
        accentColor: '#0284c7',
    },

    // 27. Logistics & Supply Services
    'logistics & supply services': {
        imageUrl: '/categories/logistics-supply.svg',
        accentColor: '#15803d',
    },

    // 28. Tools & Industrial Hardware
    'tools & industrial hardware': {
        imageUrl: '/categories/tools-hardware.svg',
        accentColor: '#ca8a04',
    },
    'industrial tools': {
        imageUrl: '/categories/tools-hardware.svg',
        accentColor: '#ca8a04',
    },

    // 29. Laboratory Equipment & Chemicals
    'laboratory equipment & chemicals': {
        imageUrl: '/categories/laboratory-equipment.svg',
        accentColor: '#0f766e',
    },

    // 30. Engineering Consultancy Services
    'engineering consultancy services': {
        imageUrl: '/categories/engineering-consultancy.svg',
        accentColor: '#4338ca',
    },

    // 31. Industrial Maintenance Services
    'industrial maintenance services': {
        imageUrl: '/categories/industrial-maintenance.svg',
        accentColor: '#0f766e',
    },

    // 32. Construction & Civil Work Services
    'construction & civil work services': {
        imageUrl: '/categories/civil-construction.svg',
        accentColor: '#b45309',
    },

    // 33. Environmental & Waste Management
    'environmental & waste management': {
        imageUrl: '/categories/environmental-waste.svg',
        accentColor: '#047857',
    },

    // 34. Telecom & Communication Equipment
    'telecom & communication equipment': {
        imageUrl: '/categories/telecom-communication.svg',
        accentColor: '#2563eb',
    },

    // 35. Furniture & Interior Supplies
    'furniture & interior supplies': {
        imageUrl: '/categories/furniture-interior.svg',
        accentColor: '#e11d48',
    },

    // 36. General Industrial Supplier
    'general industrial supplier': {
        imageUrl: '/categories/general-industrial.svg',
        accentColor: '#1e40af',
    },

    // 37. Mining & Coal Equipment
    'mining & coal equipment': {
        imageUrl: '/categories/mining-coal.svg',
        accentColor: '#3f3f46',
    },

    // 38. Power & Energy Equipment
    'power & energy equipment': {
        imageUrl: '/categories/power-energy.svg',
        accentColor: '#b45309',
    },

    // 39. Gas Equipment & Cylinders
    'gas equipment & cylinders': {
        imageUrl: '/categories/gas-cylinders.svg',
        accentColor: '#b91c1c',
    },

    // 40. Conveyor & Material Handling Equipment
    'conveyor & material handling equipment': {
        imageUrl: '/categories/conveyor-handling.svg',
        accentColor: '#0e7490',
    },

    // 41. Pumps, Motors & Hydraulics
    'pumps, motors & hydraulics': {
        imageUrl: '/categories/pumps-motors.svg',
        accentColor: '#0284c7',
    },

    // 42. Industrial Seals & Gaskets
    'industrial seals & gaskets': {
        imageUrl: '/categories/seals-gaskets.svg',
        accentColor: '#475569',
    },

    // 43. Welding & Cutting Equipment
    'welding & cutting equipment': {
        imageUrl: '/categories/welding-cutting.svg',
        accentColor: '#c2410c',
    },

    // 44. Industrial Fasteners & Components
    'industrial fasteners & components': {
        imageUrl: '/categories/fasteners-hardware.svg',
        accentColor: '#52525b',
    },

    // 45. Retail & Commercial Supply
    'retail & commercial supply': {
        imageUrl: '/categories/retail-commercial.svg',
        accentColor: '#4f46e5',
    },

    // 46. FMCG & Daily Utility Supply
    'fmcg & daily utility supply': {
        imageUrl: '/categories/fmcg-daily-utility.svg',
        accentColor: '#65a30d',
    },

    // 47. Textile & Garments Supply
    'textile & garments supply': {
        imageUrl: '/categories/textiles-garments.svg',
        accentColor: '#e11d48',
    },
    'textiles & garments': {
        imageUrl: '/categories/textiles-garments.svg',
        accentColor: '#e11d48',
    },

    // 48. SHG & Handicrafts
    'shg & handicrafts': {
        imageUrl: '/categories/shg-handicrafts.svg',
        accentColor: '#059669',
    },

    // 49. OEM / Manufacturing Vendor
    'oem / manufacturing vendor': {
        imageUrl: '/categories/oem-manufacturing.svg',
        accentColor: '#1d4ed8',
    },

    // 50. Repair & Service Provider
    'repair & service provider': {
        imageUrl: '/categories/repair-services.svg',
        accentColor: '#0284c7',
    },

    // 51. Multi-category Industrial Vendor
    'multi-category industrial vendor': {
        imageUrl: '/categories/multi-category-vendor.svg',
        accentColor: '#3730a3',
    },
};

// Keyword fallback rules for dynamic or custom categories
const KEYWORD_IMAGE_RULES: [string[], { imageUrl: string; accentColor: string }][] = [
    [['cable', 'wire', 'transformer', 'wiring', 'switchgear', 'substation'], {
        imageUrl: '/categories/cables-power.svg',
        accentColor: '#d97706',
    }],
    [['robot', 'automation', 'plc', 'sensor', 'servo', 'cnc', 'mechatronics'], {
        imageUrl: '/categories/automation-robotics.svg',
        accentColor: '#7c3aed',
    }],
    [['cement', 'concrete', 'mortar', 'paver', 'aggregate', 'plaster'], {
        imageUrl: '/categories/cement-concrete.svg',
        accentColor: '#57534e',
    }],
    [['pipe', 'tile', 'plumbing', 'fitting', 'sanitary', 'faucet', 'valve'], {
        imageUrl: '/categories/pipes-tiles.svg',
        accentColor: '#0369a1',
    }],
    [['bearing', 'bushing', 'pillow block', 'ball bearing', 'roller bearing'], {
        imageUrl: '/categories/bearings-mechanical.svg',
        accentColor: '#334155',
    }],
    [['fastener', 'bolt', 'nut', 'screw', 'washer', 'rivet', 'stud'], {
        imageUrl: '/categories/fasteners-hardware.svg',
        accentColor: '#52525b',
    }],
    [['conveyor', 'material handling', 'forklift', 'crane', 'hoist', 'pulley'], {
        imageUrl: '/categories/conveyor-handling.svg',
        accentColor: '#0e7490',
    }],
    [['pump', 'water pump', 'centrifugal', 'submersible', 'fluid'], {
        imageUrl: '/categories/pumps-motors.svg',
        accentColor: '#0284c7',
    }],
    [['seal', 'gasket', 'o-ring', 'packing', 'diaphragm'], {
        imageUrl: '/categories/seals-gaskets.svg',
        accentColor: '#475569',
    }],
    [['welding', 'weld', 'cutting torch', 'electrode', 'plasma cutter', 'flux'], {
        imageUrl: '/categories/welding-cutting.svg',
        accentColor: '#c2410c',
    }],
    [['mining', 'coal', 'mineral', 'quarry', 'ore', 'crusher'], {
        imageUrl: '/categories/mining-coal.svg',
        accentColor: '#3f3f46',
    }],
    [['gas', 'cylinder', 'oxygen', 'argon', 'nitrogen', 'lpg', 'cng'], {
        imageUrl: '/categories/gas-cylinders.svg',
        accentColor: '#b91c1c',
    }],
    [['power', 'energy', 'solar', 'wind', 'generator', 'turbine', 'battery'], {
        imageUrl: '/categories/power-energy.svg',
        accentColor: '#b45309',
    }],
    [['plastic', 'polymer', 'pvc', 'hdpe', 'molding', 'resin', 'polyethylene'], {
        imageUrl: '/categories/polymers-plastics.svg',
        accentColor: '#0d9488',
    }],
    [['machin', 'lathe', 'milling', 'drill machine', 'press', 'spares'], {
        imageUrl: '/categories/machinery-spares.svg',
        accentColor: '#1e40af',
    }],
    [['logistics', 'transport', 'cargo', 'freight', 'truck', 'shipping', 'delivery'], {
        imageUrl: '/categories/logistics-supply.svg',
        accentColor: '#15803d',
    }],
    [['trade', 'trading', 'distribution', 'distributor', 'wholesale', 'dealer'], {
        imageUrl: '/categories/trading-distribution.svg',
        accentColor: '#0284c7',
    }],
    [['consultan', 'engineering design', 'cad', 'architect', 'advisory'], {
        imageUrl: '/categories/engineering-consultancy.svg',
        accentColor: '#4338ca',
    }],
    [['maintenance', 'overhaul', 'servicing', 'inspection', 'calibration'], {
        imageUrl: '/categories/industrial-maintenance.svg',
        accentColor: '#0f766e',
    }],
    [['civil', 'construction work', 'excavation', 'road', 'infrastructure'], {
        imageUrl: '/categories/civil-construction.svg',
        accentColor: '#b45309',
    }],
    [['environment', 'waste', 'recycle', 'pollution', 'effluent', 'treatment'], {
        imageUrl: '/categories/environmental-waste.svg',
        accentColor: '#047857',
    }],
    [['telecom', 'communication', 'tower', 'antenna', 'network', 'router'], {
        imageUrl: '/categories/telecom-communication.svg',
        accentColor: '#2563eb',
    }],
    [['furniture', 'chair', 'desk', 'interior', 'table', 'workstation', 'cabinet'], {
        imageUrl: '/categories/furniture-interior.svg',
        accentColor: '#e11d48',
    }],
    [['consumable', 'abrasive', 'grinding disc', 'cutting wheel', 'tape', 'grease'], {
        imageUrl: '/categories/industrial-consumables.svg',
        accentColor: '#52525b',
    }],
    [['electric', 'appliance', 'electronic', 'grid', 'motor'], {
        imageUrl: '/categories/electrical-electronics.svg',
        accentColor: '#d97706',
    }],
    [['office', 'stationery', 'printer', 'paper', 'toner'], {
        imageUrl: '/categories/office-supplies.svg',
        accentColor: '#0284c7',
    }],
    [['tool', 'hammer', 'wrench', 'plier', 'screwdriver'], {
        imageUrl: '/categories/tools-hardware.svg',
        accentColor: '#ca8a04',
    }],
    [['agri', 'farm', 'garden', 'nursery', 'plant', 'crop', 'soil', 'seed'], {
        imageUrl: '/categories/agriculture-nursery.svg',
        accentColor: '#16a34a',
    }],
    [['medic', 'health', 'hospital', 'clinic', 'pharma', 'surgical', 'ppe'], {
        imageUrl: '/categories/medical-supplies.svg',
        accentColor: '#059669',
    }],
    [['safety', 'helmet', 'boot', 'protective', 'fire extinguisher', 'hazard'], {
        imageUrl: '/categories/safety-supplies.svg',
        accentColor: '#ea580c',
    }],
    [['auto', 'car', 'vehicle', 'truck parts', 'brake', 'transmission', 'clutch'], {
        imageUrl: '/categories/automobile-parts.svg',
        accentColor: '#dc2626',
    }],
    [['construct', 'building', 'brick', 'sand', 'scaffold'], {
        imageUrl: '/categories/construction-materials.svg',
        accentColor: '#ea580c',
    }],
    [['chemic', 'flask', 'laboratory', 'acid', 'reagent', 'petro'], {
        imageUrl: '/categories/industrial-chemicals.svg',
        accentColor: '#0f766e',
    }],
    [['refract', 'furnace', 'kiln', 'firebrick', 'crucible', 'foundry', 'casting'], {
        imageUrl: '/categories/refractories.svg',
        accentColor: '#c2410c',
    }],
    [['tyre', 'tire', 'rubber', 'tread', 'vulcaniz'], {
        imageUrl: '/categories/tyres-rubber.svg',
        accentColor: '#334155',
    }],
    [['it ', 'computer', 'software', 'server', 'data', 'cloud', 'laptop', 'monitor'], {
        imageUrl: '/categories/it-computer.svg',
        accentColor: '#4f46e5',
    }],
    [['fuel', 'petrol', 'diesel', 'lubricant'], {
        imageUrl: '/categories/fuel-oil-gas.svg',
        accentColor: '#d97706',
    }],
    [['hydraulic', 'pneumatic', 'piston'], {
        imageUrl: '/categories/hydraulics-pneumatics.svg',
        accentColor: '#0284c7',
    }],
    [['steel', 'metal', 'iron', 'aluminum', 'sheet', 'alloy', 'rebar', 'beam', 'coil'], {
        imageUrl: '/categories/steel-metal.svg',
        accentColor: '#475569',
    }],
    [['packag', 'box', 'carton', 'corrugat', 'print', 'label'], {
        imageUrl: '/categories/packaging-printing.svg',
        accentColor: '#9333ea',
    }],
    [['shg', 'handicraft', 'artisan', 'handloom', 'women', 'rural', 'pottery'], {
        imageUrl: '/categories/shg-handicrafts.svg',
        accentColor: '#059669',
    }],
    [['textile', 'cloth', 'garment', 'fabric', 'uniform', 'apparel'], {
        imageUrl: '/categories/textiles-garments.svg',
        accentColor: '#e11d48',
    }],
    [['fmcg', 'daily utility', 'provision', 'grocery', 'detergent'], {
        imageUrl: '/categories/fmcg-daily-utility.svg',
        accentColor: '#65a30d',
    }],
    [['retail', 'store', 'shop', 'pos'], {
        imageUrl: '/categories/retail-commercial.svg',
        accentColor: '#4f46e5',
    }],
    [['oem', 'manufacturing', 'fabricat'], {
        imageUrl: '/categories/oem-manufacturing.svg',
        accentColor: '#1d4ed8',
    }],
    [['repair', 'technician', 'workshop'], {
        imageUrl: '/categories/repair-services.svg',
        accentColor: '#0284c7',
    }],
];

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

export const buildCategoryFallbackSvg = (categoryName: string, accentColor?: string) => {
    const name = sanitizeSvgText(categoryName || 'MSME Category');
    const initials = getInitials(name);
    const hash = hashString(categoryName || 'default');
    const palette = DYNAMIC_PALETTES[hash % DYNAMIC_PALETTES.length];
    const strokeColor = accentColor || palette.stroke;

    const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="140" height="140" viewBox="0 0 140 140">
            <defs>
                <linearGradient id="catbg_${hash}" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stop-color="${palette.bg1}" />
                    <stop offset="100%" stop-color="${palette.bg2}" />
                </linearGradient>
                <linearGradient id="badge_${hash}" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stop-color="${strokeColor}" />
                    <stop offset="100%" stop-color="${palette.fill}" />
                </linearGradient>
                <filter id="shadow_${hash}" x="-10%" y="-10%" width="130%" height="130%">
                    <feDropShadow dx="0" dy="3" stdDeviation="2.5" flood-opacity="0.16"/>
                </filter>
            </defs>
            <!-- Background Card -->
            <rect width="132" height="132" x="4" y="4" rx="20" fill="url(#catbg_${hash})" stroke="${strokeColor}" stroke-width="1.5" opacity="0.85"/>
            <!-- 3D Category Emblem Badge -->
            <g filter="url(#shadow_${hash})">
                <circle cx="70" cy="54" r="28" fill="url(#badge_${hash})"/>
                <circle cx="70" cy="54" r="24" fill="#ffffff" opacity="0.15"/>
                <!-- Category Initials Monogram -->
                <text x="70" y="62" fill="#ffffff" font-family="system-ui, -apple-system, sans-serif" font-size="20" font-weight="900" text-anchor="middle" letter-spacing="1">${initials}</text>
            </g>
            <!-- Decorative Accent Elements -->
            <circle cx="34" cy="34" r="3" fill="${strokeColor}" opacity="0.4"/>
            <circle cx="106" cy="34" r="3" fill="${strokeColor}" opacity="0.4"/>
            <circle cx="70" cy="94" r="2.5" fill="${strokeColor}" opacity="0.6"/>
            <!-- Category Title Line -->
            <text x="70" y="112" fill="${palette.text}" font-family="system-ui, -apple-system, sans-serif" font-size="9.5" font-weight="800" text-anchor="middle">${name}</text>
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

    // 3. Fallback to a dynamically generated unique SVG tailored to this category name
    const hash = hashString(cleanName);
    const palette = DYNAMIC_PALETTES[hash % DYNAMIC_PALETTES.length];
    return {
        imageUrl: buildCategoryFallbackSvg(rawName, palette.stroke),
        accentColor: palette.stroke,
        categoryTag: rawName,
    };
};

export const getCategoryImageUrl = (category: MarketplaceCategory | string): string => {
    if (typeof category === 'object' && category !== null) {
        // If the category object already has a custom image path or icon
        const iconProp = (category as any).imageUrl || (category as any).image || (category as any).photoUrl || category.icon;
        if (typeof iconProp === 'string' && (iconProp.startsWith('http://') || iconProp.startsWith('https://') || iconProp.startsWith('/') || iconProp.startsWith('data:image/'))) {
            return iconProp;
        }
    }
    return getCategoryVisualMeta(category).imageUrl;
};
