import type { MarketplaceCategory } from '../api';

export interface CategoryVisualMeta {
    imageUrl: string;
    gradient: string;
    accentColor: string;
    categoryTag: string;
}

// Curated high-resolution imagery specifically targeted to MSME / industrial sectors
const CATEGORY_IMAGE_REGISTRY: Record<string, { imageUrl: string; gradient: string; accentColor: string }> = {
    'electrical & electronics': {
        imageUrl: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=500&auto=format&fit=crop&q=80',
        gradient: 'from-amber-600/70 to-yellow-500/80',
        accentColor: '#d97706',
    },
    'mechanical & engineering': {
        imageUrl: 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=500&auto=format&fit=crop&q=80',
        gradient: 'from-slate-800/75 to-blue-700/80',
        accentColor: '#2563eb',
    },
    'construction & building materials': {
        imageUrl: 'https://images.unsplash.com/photo-1541888946425-d0fbb18086f6?w=500&auto=format&fit=crop&q=80',
        gradient: 'from-amber-800/75 to-stone-700/80',
        accentColor: '#b45309',
    },
    'industrial chemicals': {
        imageUrl: 'https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?w=500&auto=format&fit=crop&q=80',
        gradient: 'from-teal-700/75 to-emerald-600/80',
        accentColor: '#0f766e',
    },
    'refractories': {
        imageUrl: 'https://images.unsplash.com/photo-1578328819058-b69f3a3b0f6b?w=500&auto=format&fit=crop&q=80',
        gradient: 'from-red-900/75 to-orange-700/80',
        accentColor: '#c2410c',
    },
    'automobile parts & services': {
        imageUrl: 'https://images.unsplash.com/photo-1486006920555-c77dce18193b?w=500&auto=format&fit=crop&q=80',
        gradient: 'from-blue-900/75 to-indigo-700/80',
        accentColor: '#1d4ed8',
    },
    'tyres & rubber products': {
        imageUrl: 'https://images.unsplash.com/photo-1578844251758-2f71da64c96f?w=500&auto=format&fit=crop&q=80',
        gradient: 'from-stone-900/80 to-slate-700/80',
        accentColor: '#334155',
    },
    'it & computer equipment': {
        imageUrl: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=500&auto=format&fit=crop&q=80',
        gradient: 'from-indigo-900/75 to-cyan-700/80',
        accentColor: '#4f46e5',
    },
    'office equipment & stationery': {
        imageUrl: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=500&auto=format&fit=crop&q=80',
        gradient: 'from-sky-800/75 to-blue-600/80',
        accentColor: '#0284c7',
    },
    'medical & healthcare supplies': {
        imageUrl: 'https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?w=500&auto=format&fit=crop&q=80',
        gradient: 'from-emerald-800/75 to-teal-600/80',
        accentColor: '#059669',
    },
    'agriculture & nursery': {
        imageUrl: 'https://images.unsplash.com/photo-1592417817098-8f3d6eb22521?w=500&auto=format&fit=crop&q=80',
        gradient: 'from-green-800/75 to-lime-600/80',
        accentColor: '#16a34a',
    },
    'safety equipment & industrial safety': {
        imageUrl: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=500&auto=format&fit=crop&q=80',
        gradient: 'from-orange-700/75 to-amber-600/80',
        accentColor: '#ea580c',
    },
    'fuel, oil & gas': {
        imageUrl: 'https://images.unsplash.com/photo-1611273426858-450d8e3c9fce?w=500&auto=format&fit=crop&q=80',
        gradient: 'from-slate-900/80 to-amber-800/80',
        accentColor: '#d97706',
    },
    'hydraulics & pneumatics': {
        imageUrl: 'https://images.unsplash.com/photo-1581092335397-9583fe92d232?w=500&auto=format&fit=crop&q=80',
        gradient: 'from-cyan-900/75 to-blue-700/80',
        accentColor: '#0891b2',
    },
    'steel & metal products': {
        imageUrl: 'https://images.unsplash.com/photo-1535813547-99c456a41d4a?w=500&auto=format&fit=crop&q=80',
        gradient: 'from-slate-900/80 to-zinc-700/80',
        accentColor: '#475569',
    },
    'cement & concrete products': {
        imageUrl: 'https://images.unsplash.com/photo-1517581177682-a085bb7ffb15?w=500&auto=format&fit=crop&q=80',
        gradient: 'from-stone-800/75 to-neutral-600/80',
        accentColor: '#57534e',
    },
    'pipes, tiles & hardware': {
        imageUrl: 'https://images.unsplash.com/photo-1584992236310-6edddc08acff?w=500&auto=format&fit=crop&q=80',
        gradient: 'from-blue-900/75 to-slate-700/80',
        accentColor: '#0369a1',
    },
    'industrial machinery & spare parts': {
        imageUrl: 'https://images.unsplash.com/photo-1504917599217-d4dc5ebe6122?w=500&auto=format&fit=crop&q=80',
        gradient: 'from-slate-900/80 to-blue-800/80',
        accentColor: '#1e40af',
    },
    'automation & robotics': {
        imageUrl: 'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=500&auto=format&fit=crop&q=80',
        gradient: 'from-violet-900/75 to-blue-600/80',
        accentColor: '#7c3aed',
    },
    'fabrication & welding services': {
        imageUrl: 'https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?w=500&auto=format&fit=crop&q=80',
        gradient: 'from-amber-900/80 to-orange-600/80',
        accentColor: '#c2410c',
    },
    'bearings & mechanical components': {
        imageUrl: 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=500&auto=format&fit=crop&q=80',
        gradient: 'from-slate-800/75 to-slate-600/80',
        accentColor: '#334155',
    },
    'electrical cables & power equipment': {
        imageUrl: 'https://images.unsplash.com/photo-1544724569-5f546fd6f2b5?w=500&auto=format&fit=crop&q=80',
        gradient: 'from-amber-800/75 to-orange-600/80',
        accentColor: '#d97706',
    },
    'industrial consumables': {
        imageUrl: 'https://images.unsplash.com/photo-1586864387967-d02ef85d93e8?w=500&auto=format&fit=crop&q=80',
        gradient: 'from-zinc-800/75 to-stone-600/80',
        accentColor: '#52525b',
    },
    'packaging & printing': {
        imageUrl: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=500&auto=format&fit=crop&q=80',
        gradient: 'from-violet-800/75 to-purple-600/80',
        accentColor: '#9333ea',
    },
    'polymer & plastic products': {
        imageUrl: 'https://images.unsplash.com/photo-1563170351-be82bc888aa4?w=500&auto=format&fit=crop&q=80',
        gradient: 'from-teal-800/75 to-cyan-600/80',
        accentColor: '#0d9488',
    },
    'trading & distribution': {
        imageUrl: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=500&auto=format&fit=crop&q=80',
        gradient: 'from-blue-900/75 to-sky-700/80',
        accentColor: '#0284c7',
    },
    'logistics & supply services': {
        imageUrl: 'https://images.unsplash.com/photo-1519003722824-194d4455a60c?w=500&auto=format&fit=crop&q=80',
        gradient: 'from-green-900/75 to-emerald-600/80',
        accentColor: '#15803d',
    },
    'tools & industrial hardware': {
        imageUrl: 'https://images.unsplash.com/photo-1581147036324-c17ac41dfa6c?w=500&auto=format&fit=crop&q=80',
        gradient: 'from-orange-800/75 to-amber-600/80',
        accentColor: '#c2410c',
    },
    'laboratory equipment & chemicals': {
        imageUrl: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=500&auto=format&fit=crop&q=80',
        gradient: 'from-teal-900/75 to-cyan-600/80',
        accentColor: '#0f766e',
    },
    'engineering consultancy services': {
        imageUrl: 'https://images.unsplash.com/photo-1581092335397-9583fe92d232?w=500&auto=format&fit=crop&q=80',
        gradient: 'from-indigo-900/75 to-blue-700/80',
        accentColor: '#4338ca',
    },
    'industrial maintenance services': {
        imageUrl: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=500&auto=format&fit=crop&q=80',
        gradient: 'from-slate-900/80 to-teal-700/80',
        accentColor: '#0f766e',
    },
    'construction & civil work services': {
        imageUrl: 'https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=500&auto=format&fit=crop&q=80',
        gradient: 'from-stone-900/80 to-amber-700/80',
        accentColor: '#b45309',
    },
    'environmental & waste management': {
        imageUrl: 'https://images.unsplash.com/photo-1532996122724-e3c354a0b15b?w=500&auto=format&fit=crop&q=80',
        gradient: 'from-emerald-900/75 to-teal-600/80',
        accentColor: '#047857',
    },
    'telecom & communication equipment': {
        imageUrl: 'https://images.unsplash.com/photo-1544717305-2782549b5136?w=500&auto=format&fit=crop&q=80',
        gradient: 'from-blue-900/75 to-indigo-700/80',
        accentColor: '#2563eb',
    },
    'furniture & interior supplies': {
        imageUrl: 'https://images.unsplash.com/photo-1524758631624-e2822e304c36?w=500&auto=format&fit=crop&q=80',
        gradient: 'from-rose-900/75 to-pink-700/80',
        accentColor: '#e11d48',
    },
    'general industrial supplier': {
        imageUrl: 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=500&auto=format&fit=crop&q=80',
        gradient: 'from-slate-900/80 to-blue-800/80',
        accentColor: '#1e40af',
    },
    'mining & coal equipment': {
        imageUrl: 'https://images.unsplash.com/photo-1578328819058-b69f3a3b0f6b?w=500&auto=format&fit=crop&q=80',
        gradient: 'from-stone-900/85 to-zinc-700/85',
        accentColor: '#3f3f46',
    },
    'power & energy equipment': {
        imageUrl: 'https://images.unsplash.com/photo-1473341304170-971dccb5ac1e?w=500&auto=format&fit=crop&q=80',
        gradient: 'from-amber-900/80 to-yellow-600/80',
        accentColor: '#b45309',
    },
    'gas equipment & cylinders': {
        imageUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=500&auto=format&fit=crop&q=80',
        gradient: 'from-red-900/75 to-amber-700/80',
        accentColor: '#b91c1c',
    },
    'conveyor & material handling equipment': {
        imageUrl: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=500&auto=format&fit=crop&q=80',
        gradient: 'from-slate-900/80 to-cyan-700/80',
        accentColor: '#0e7490',
    },
    'pumps, motors & hydraulics': {
        imageUrl: 'https://images.unsplash.com/photo-1581092335397-9583fe92d232?w=500&auto=format&fit=crop&q=80',
        gradient: 'from-blue-900/80 to-cyan-600/80',
        accentColor: '#0284c7',
    },
    'industrial seals & gaskets': {
        imageUrl: 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=500&auto=format&fit=crop&q=80',
        gradient: 'from-slate-800/75 to-stone-600/80',
        accentColor: '#475569',
    },
    'welding & cutting equipment': {
        imageUrl: 'https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?w=500&auto=format&fit=crop&q=80',
        gradient: 'from-orange-900/80 to-amber-600/80',
        accentColor: '#c2410c',
    },
    'industrial fasteners & components': {
        imageUrl: 'https://images.unsplash.com/photo-1586864387967-d02ef85d93e8?w=500&auto=format&fit=crop&q=80',
        gradient: 'from-zinc-900/80 to-slate-600/80',
        accentColor: '#52525b',
    },
    'retail & commercial supply': {
        imageUrl: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=500&auto=format&fit=crop&q=80',
        gradient: 'from-blue-800/75 to-indigo-600/80',
        accentColor: '#4f46e5',
    },
    'fmcg & daily utility supply': {
        imageUrl: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=500&auto=format&fit=crop&q=80',
        gradient: 'from-lime-900/75 to-green-600/80',
        accentColor: '#65a30d',
    },
    'textile & garments supply': {
        imageUrl: 'https://images.unsplash.com/photo-1558769132-cb1aea458c5e?w=500&auto=format&fit=crop&q=80',
        gradient: 'from-pink-900/75 to-rose-600/80',
        accentColor: '#e11d48',
    },
    'shg & handicrafts': {
        imageUrl: 'https://images.unsplash.com/photo-1590736969955-71cc94801759?w=500&auto=format&fit=crop&q=80',
        gradient: 'from-emerald-900/80 to-amber-600/80',
        accentColor: '#059669',
    },
    'oem / manufacturing vendor': {
        imageUrl: 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=500&auto=format&fit=crop&q=80',
        gradient: 'from-slate-900/80 to-blue-700/80',
        accentColor: '#1d4ed8',
    },
    'repair & service provider': {
        imageUrl: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=500&auto=format&fit=crop&q=80',
        gradient: 'from-cyan-900/80 to-blue-700/80',
        accentColor: '#0284c7',
    },
    'multi-category industrial vendor': {
        imageUrl: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=500&auto=format&fit=crop&q=80',
        gradient: 'from-slate-900/80 to-indigo-800/80',
        accentColor: '#3730a3',
    },
};

// Keyword fallback rules for dynamic or custom categories
const KEYWORD_IMAGE_RULES: [string[], { imageUrl: string; gradient: string; accentColor: string }][] = [
    [['electric', 'power', 'electronic', 'cable', 'transformer', 'wiring', 'solar', 'grid', 'sensor'], {
        imageUrl: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=500&auto=format&fit=crop&q=80',
        gradient: 'from-amber-600/70 to-yellow-500/80',
        accentColor: '#d97706',
    }],
    [['mechanical', 'machin', 'lathe', 'gear', 'engine', 'motor', 'pump', 'fabricat', 'weld', 'valve'], {
        imageUrl: 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=500&auto=format&fit=crop&q=80',
        gradient: 'from-slate-800/75 to-blue-700/80',
        accentColor: '#2563eb',
    }],
    [['construct', 'building', 'cement', 'concrete', 'brick', 'sand', 'civil', 'scaffold', 'tile'], {
        imageUrl: 'https://images.unsplash.com/photo-1541888946425-d0fbb18086f6?w=500&auto=format&fit=crop&q=80',
        gradient: 'from-amber-800/75 to-stone-700/80',
        accentColor: '#b45309',
    }],
    [['chemic', 'flask', 'pharma', 'laboratory', 'acid', 'polymer', 'reagent', 'petro'], {
        imageUrl: 'https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?w=500&auto=format&fit=crop&q=80',
        gradient: 'from-teal-700/75 to-emerald-600/80',
        accentColor: '#0f766e',
    }],
    [['refract', 'furnace', 'kiln', 'firebrick', 'crucible', 'thermal', 'foundry', 'casting'], {
        imageUrl: 'https://images.unsplash.com/photo-1578328819058-b69f3a3b0f6b?w=500&auto=format&fit=crop&q=80',
        gradient: 'from-red-900/75 to-orange-700/80',
        accentColor: '#c2410c',
    }],
    [['auto', 'car', 'vehicle', 'truck', 'brake', 'transmission', 'clutch', 'spare part'], {
        imageUrl: 'https://images.unsplash.com/photo-1486006920555-c77dce18193b?w=500&auto=format&fit=crop&q=80',
        gradient: 'from-blue-900/75 to-indigo-700/80',
        accentColor: '#1d4ed8',
    }],
    [['tyre', 'tire', 'rubber', 'tread', 'vulcaniz', 'conveyor'], {
        imageUrl: 'https://images.unsplash.com/photo-1578844251758-2f71da64c96f?w=500&auto=format&fit=crop&q=80',
        gradient: 'from-stone-900/80 to-slate-700/80',
        accentColor: '#334155',
    }],
    [['it ', 'computer', 'software', 'network', 'telecom', 'server', 'data', 'cloud', 'laptop'], {
        imageUrl: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=500&auto=format&fit=crop&q=80',
        gradient: 'from-indigo-900/75 to-cyan-700/80',
        accentColor: '#4f46e5',
    }],
    [['office', 'stationery', 'printer', 'paper', 'desk', 'toner'], {
        imageUrl: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=500&auto=format&fit=crop&q=80',
        gradient: 'from-sky-800/75 to-blue-600/80',
        accentColor: '#0284c7',
    }],
    [['medical', 'health', 'hospital', 'clinic', 'pharma', 'surgical', 'safety gear', 'ppe'], {
        imageUrl: 'https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?w=500&auto=format&fit=crop&q=80',
        gradient: 'from-emerald-800/75 to-teal-600/80',
        accentColor: '#059669',
    }],
    [['agri', 'farm', 'nursery', 'plant', 'crop', 'soil', 'irrigation', 'seed'], {
        imageUrl: 'https://images.unsplash.com/photo-1592417817098-8f3d6eb22521?w=500&auto=format&fit=crop&q=80',
        gradient: 'from-green-800/75 to-lime-600/80',
        accentColor: '#16a34a',
    }],
    [['safety', 'helmet', 'protective', 'fire', 'hazard', 'shield'], {
        imageUrl: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=500&auto=format&fit=crop&q=80',
        gradient: 'from-orange-700/75 to-amber-600/80',
        accentColor: '#ea580c',
    }],
    [['steel', 'metal', 'iron', 'aluminum', 'sheet', 'pipe', 'alloy'], {
        imageUrl: 'https://images.unsplash.com/photo-1535813547-99c456a41d4a?w=500&auto=format&fit=crop&q=80',
        gradient: 'from-slate-900/80 to-zinc-700/80',
        accentColor: '#475569',
    }],
    [['packag', 'box', 'carton', 'corrugat', 'print', 'label', 'shipping'], {
        imageUrl: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=500&auto=format&fit=crop&q=80',
        gradient: 'from-violet-800/75 to-purple-600/80',
        accentColor: '#9333ea',
    }],
    [['logistic', 'transport', 'cargo', 'freight', 'warehouse', 'fleet'], {
        imageUrl: 'https://images.unsplash.com/photo-1519003722824-194d4455a60c?w=500&auto=format&fit=crop&q=80',
        gradient: 'from-green-900/75 to-emerald-600/80',
        accentColor: '#15803d',
    }],
    [['shg', 'handicraft', 'artisan', 'handloom', 'women', 'rural', 'cottage'], {
        imageUrl: 'https://images.unsplash.com/photo-1590736969955-71cc94801759?w=500&auto=format&fit=crop&q=80',
        gradient: 'from-emerald-900/80 to-amber-600/80',
        accentColor: '#059669',
    }],
    [['textile', 'cloth', 'garment', 'fabric', 'uniform', 'apparel'], {
        imageUrl: 'https://images.unsplash.com/photo-1558769132-cb1aea458c5e?w=500&auto=format&fit=crop&q=80',
        gradient: 'from-pink-900/75 to-rose-600/80',
        accentColor: '#e11d48',
    }],
    [['furniture', 'interior', 'decor', 'chair', 'table', 'cabinet'], {
        imageUrl: 'https://images.unsplash.com/photo-1524758631624-e2822e304c36?w=500&auto=format&fit=crop&q=80',
        gradient: 'from-rose-900/75 to-pink-700/80',
        accentColor: '#e11d48',
    }],
    [['food', 'grain', 'fmcg', 'spice', 'grocery', 'oil', 'flour'], {
        imageUrl: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=500&auto=format&fit=crop&q=80',
        gradient: 'from-lime-900/75 to-green-600/80',
        accentColor: '#65a30d',
    }],
];

const DEFAULT_CATEGORY_META = {
    imageUrl: 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=500&auto=format&fit=crop&q=80',
    gradient: 'from-slate-900/80 to-blue-800/80',
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
        <svg xmlns="http://www.w3.org/2000/svg" width="400" height="280" viewBox="0 0 400 280">
            <defs>
                <linearGradient id="catbg" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stop-color="#0b2447" />
                    <stop offset="100%" stop-color="${accentColor}" />
                </linearGradient>
                <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                    <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>
                </pattern>
            </defs>
            <rect width="400" height="280" rx="16" fill="url(#catbg)"/>
            <rect width="400" height="280" fill="url(#grid)"/>
            <circle cx="340" cy="50" r="70" fill="rgba(255,255,255,0.08)"/>
            <circle cx="50" cy="230" r="80" fill="rgba(255,255,255,0.06)"/>
            <g transform="translate(160, 80)" fill="none" stroke="rgba(255,255,255,0.85)" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
            </g>
            <text x="200" y="195" fill="#ffffff" font-family="system-ui, -apple-system, sans-serif" font-size="16" font-weight="700" text-anchor="middle" letter-spacing="0.5">${title}</text>
            <rect x="140" y="215" width="120" height="22" rx="11" fill="rgba(255,255,255,0.18)" stroke="rgba(255,255,255,0.3)"/>
            <text x="200" y="230" fill="#ffffff" font-family="system-ui, -apple-system, sans-serif" font-size="10" font-weight="800" text-anchor="middle" letter-spacing="1">MSME SECTOR</text>
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
            gradient: direct.gradient,
            accentColor: direct.accentColor,
            categoryTag: rawName,
        };
    }

    // 2. Keyword fuzzy match
    for (const [keywords, meta] of KEYWORD_IMAGE_RULES) {
        if (keywords.some(kw => cleanName.includes(kw))) {
            return {
                imageUrl: meta.imageUrl,
                gradient: meta.gradient,
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
        // If the category object already has a direct valid web image URL
        const iconProp = (category as any).imageUrl || (category as any).image || (category as any).photoUrl || category.icon;
        if (typeof iconProp === 'string' && (iconProp.startsWith('http://') || iconProp.startsWith('https://') || iconProp.startsWith('/'))) {
            return iconProp;
        }
    }
    return getCategoryVisualMeta(category).imageUrl;
};
