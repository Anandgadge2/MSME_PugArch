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

    // 2. Fallback to dynamically generated unique SVG tailored to this category name
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
    }
    return getCategoryVisualMeta(category).imageUrl;
};
