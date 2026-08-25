import { BASE_URL, getBaseUrl, resolveMediaUrl } from '../../../lib/api';

export type MarketplaceImageItemType = 'product' | 'service';

const imageExtensions = /\.(png|jpe?g|webp|gif|bmp|svg|avif)(\?.*)?$/i;

const serviceFallbackPalettes = [
    { bg: '#e8f3ff', accent: '#0b5cad', soft: '#b9d7f4' },
    { bg: '#edf7f2', accent: '#16794c', soft: '#b8e0cc' },
    { bg: '#fff4e7', accent: '#b75a09', soft: '#f4cf9d' },
    { bg: '#f2efff', accent: '#5b46a8', soft: '#d1c7fb' },
    { bg: '#eef7fb', accent: '#087083', soft: '#b9e0e8' },
];

const sanitizeSvgText = (value: unknown) =>
    String(value || '')
        .replace(/[<>&"]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 34);

const stableHash = (value: string) => {
    let hash = 0;
    for (let index = 0; index < value.length; index += 1) {
        hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
    }
    return Math.abs(hash);
};

const normalizeUrl = (value: unknown) => {
    const raw = String(value || '').trim();
    if (!raw) return '';
    if (raw.startsWith('/org-logos/') || raw.startsWith('/products/')) {
        return raw;
    }
    const resolved = resolveMediaUrl(raw);
    if (resolved) return resolved;
    if (/^(https?:)?\/\//i.test(raw) || raw.startsWith('data:') || raw.startsWith('blob:')) return raw;
    const base = (typeof window !== 'undefined' ? getBaseUrl() : BASE_URL).replace(/\/$/, '');
    if (raw.startsWith('/')) {
        return base ? `${base}${raw}` : raw;
    }
    return base ? `${base}/${raw.replace(/^\.?\//, '')}` : `/${raw.replace(/^\.?\//, '')}`;
};

const extractUrlFromAsset = (asset: any) => {
    if (!asset) return '';
    if (typeof asset === 'string') return normalizeUrl(asset);
    
    const directUrl = asset.url || asset.fileUrl || asset.imageUrl || asset.path || asset.downloadUrl || asset.fileAsset?.url;
    if (directUrl && (/^(https?:)?\/\//i.test(directUrl) || directUrl.startsWith('data:') || directUrl.startsWith('blob:'))) {
        return normalizeUrl(directUrl);
    }

    const fileId = asset.fileAssetId || asset.fileAsset?.id || asset.id;
    if (fileId && Number(fileId) > 0) {
        return normalizeUrl(`/api/files/${fileId}/view`);
    }

    if (directUrl) return normalizeUrl(directUrl);
    return '';
};

const looksLikeImage = (entry: any) => {
    const mimeType = String(entry?.mimeType || entry?.fileAsset?.mimeType || '').toLowerCase();
    const name = String(entry?.originalName || entry?.fileName || entry?.name || entry?.fileAsset?.originalName || entry?.url || entry?.fileAsset?.url || '').toLowerCase();
    return mimeType.startsWith('image/') || imageExtensions.test(name);
};

const readImageFromEntry = (entry: any, isKnownImageSource = false) => {
    if (!entry) return '';

    if (typeof entry === 'string') {
        const norm = normalizeUrl(entry);
        if (norm && (isKnownImageSource || imageExtensions.test(norm) || norm.startsWith('data:') || norm.startsWith('blob:') || norm.includes('/api/files/') || norm.includes('/uploads/'))) {
            return norm;
        }
        return isKnownImageSource ? norm : '';
    }

    const candidate = extractUrlFromAsset(entry.imageUrl)
        || extractUrlFromAsset(entry.primaryImageUrl)
        || extractUrlFromAsset(entry.thumbnailUrl)
        || extractUrlFromAsset(entry.fileAsset)
        || extractUrlFromAsset(entry.url)
        || extractUrlFromAsset(entry.fileUrl)
        || extractUrlFromAsset(entry.asset)
        || extractUrlFromAsset(entry.file)
        || extractUrlFromAsset(entry);

    if (!candidate) return '';

    if (isKnownImageSource || looksLikeImage(entry) || imageExtensions.test(candidate) || candidate.startsWith('data:') || candidate.startsWith('blob:') || candidate.includes('/api/files/') || candidate.includes('/uploads/')) {
        return candidate;
    }

    return '';
};

export const getMarketplaceImageCandidates = (item: any): string[] => {
    if (!item) return [];
    const direct: string[] = [];

    const directProps = [
        item.imageUrl,
        item.primaryImageUrl,
        item.thumbnailUrl,
        item.photoUrl,
        item.coverImageUrl,
        item.bannerImageUrl,
        item.fileAsset?.url || (item.fileAsset?.id ? `/api/files/${item.fileAsset.id}/view` : ''),
    ];

    for (const prop of directProps) {
        if (!prop) continue;
        const norm = normalizeUrl(prop);
        if (norm) direct.push(norm);
    }

    const primaryImageCollections = [
        item.images,
        item.productImages,
        item.serviceImages,
        item.catalogueImages,
        item.media,
    ];

    for (const collection of primaryImageCollections) {
        if (!Array.isArray(collection)) continue;
        for (const entry of collection) {
            const candidate = readImageFromEntry(entry, true);
            if (candidate) direct.push(candidate);
        }
    }

    const secondaryCollections = [
        item.catalogueFiles,
        item.files,
        item.attachments,
    ];

    for (const collection of secondaryCollections) {
        if (!Array.isArray(collection)) continue;
        for (const entry of collection) {
            const candidate = readImageFromEntry(entry, false);
            if (candidate) direct.push(candidate);
        }
    }

    return Array.from(new Set(direct.filter(Boolean)));
};

export const buildServiceFallbackImage = (item: any) => {
    const label = sanitizeSvgText(item?.category?.name || item?.categoryName || 'Professional Service');
    const title = sanitizeSvgText(item?.name || 'Verified MSME Service');
    const seed = stableHash(`${item?.id || ''}:${title}:${label}`);
    const palette = serviceFallbackPalettes[seed % serviceFallbackPalettes.length];
    const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="640" height="420" viewBox="0 0 640 420" role="img" aria-label="${title}">
            <defs>
                <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stop-color="${palette.bg}"/>
                    <stop offset="1" stop-color="#ffffff"/>
                </linearGradient>
                <linearGradient id="accent" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stop-color="${palette.accent}"/>
                    <stop offset="1" stop-color="${palette.soft}"/>
                </linearGradient>
            </defs>
            <rect width="640" height="420" rx="32" fill="url(#bg)"/>
            <circle cx="520" cy="72" r="96" fill="${palette.soft}" opacity="0.36"/>
            <circle cx="112" cy="332" r="112" fill="${palette.soft}" opacity="0.24"/>
            <rect x="58" y="62" width="524" height="296" rx="28" fill="#ffffff" opacity="0.84"/>
            <path d="M214 221h212M214 252h150M214 283h182" stroke="${palette.soft}" stroke-width="18" stroke-linecap="round"/>
            <g transform="translate(112 132)" fill="none" stroke="url(#accent)" stroke-width="16" stroke-linecap="round" stroke-linejoin="round">
                <path d="M76 20a52 52 0 0 0-58 70l42-42 34 34-42 42a52 52 0 0 0 70-58"/>
                <path d="M86 96l84 84"/>
                <path d="M154 166l30-30"/>
            </g>
            <text x="214" y="154" fill="${palette.accent}" font-family="Arial, Helvetica, sans-serif" font-size="28" font-weight="800">${label}</text>
            <text x="214" y="193" fill="#0f172a" font-family="Arial, Helvetica, sans-serif" font-size="24" font-weight="700">${title}</text>
            <rect x="214" y="311" width="140" height="30" rx="15" fill="${palette.bg}" stroke="${palette.soft}"/>
            <text x="238" y="332" fill="${palette.accent}" font-family="Arial, Helvetica, sans-serif" font-size="14" font-weight="800">SERVICE</text>
        </svg>`;

    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg.replace(/\s+/g, ' ').trim())}`;
};

const productFallbackPalettes = [
    { bg: '#f1f5f9', accent: '#334155', soft: '#cbd5e1', badge: '#0f172a' }, // Steel & Metal / Industrial
    { bg: '#eff6ff', accent: '#1d4ed8', soft: '#bfdbfe', badge: '#1e40af' }, // Electronics & Tech
    { bg: '#f0fdf4', accent: '#15803d', soft: '#bbf7d0', badge: '#166534' }, // Eco / Agriculture
    { bg: '#fff7ed', accent: '#c2410c', soft: '#fed7aa', badge: '#9a3412' }, // Safety & Construction
    { bg: '#faf5ff', accent: '#7e22ce', soft: '#e9d5ff', badge: '#6b21a8' }, // Manufacturing & Goods
];

export const buildProductFallbackImage = (item: any) => {
    const label = sanitizeSvgText(item?.category?.name || item?.categoryName || 'MSME Product');
    const title = sanitizeSvgText(item?.name || 'Verified Product');
    const seed = stableHash(`${item?.id || ''}:${title}:${label}`);
    const palette = productFallbackPalettes[seed % productFallbackPalettes.length];

    const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="640" height="420" viewBox="0 0 640 420" role="img" aria-label="${title}">
            <defs>
                <linearGradient id="pbg" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stop-color="${palette.bg}"/>
                    <stop offset="1" stop-color="#ffffff"/>
                </linearGradient>
                <linearGradient id="pac" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stop-color="${palette.accent}"/>
                    <stop offset="1" stop-color="${palette.soft}"/>
                </linearGradient>
            </defs>
            <rect width="640" height="420" rx="32" fill="url(#pbg)"/>
            <circle cx="540" cy="80" r="90" fill="${palette.soft}" opacity="0.3"/>
            <circle cx="100" cy="340" r="100" fill="${palette.soft}" opacity="0.2"/>
            <rect x="58" y="58" width="524" height="304" rx="28" fill="#ffffff" opacity="0.88"/>
            <g transform="translate(100 120)" fill="none" stroke="url(#pac)" stroke-width="14" stroke-linecap="round" stroke-linejoin="round">
                <path d="M40 20 L100 50 L160 20 L100 -10 Z" transform="translate(0 30)"/>
                <path d="M40 50 L40 120 L100 150 L100 80 Z" transform="translate(0 20)"/>
                <path d="M160 50 L160 120 L100 150 L100 80 Z" transform="translate(0 20)"/>
            </g>
            <text x="220" y="154" fill="${palette.accent}" font-family="Arial, Helvetica, sans-serif" font-size="26" font-weight="800">${label}</text>
            <text x="220" y="195" fill="#0f172a" font-family="Arial, Helvetica, sans-serif" font-size="24" font-weight="700">${title}</text>
            <rect x="220" y="306" width="150" height="32" rx="16" fill="${palette.bg}" stroke="${palette.soft}"/>
            <text x="246" y="327" fill="${palette.accent}" font-family="Arial, Helvetica, sans-serif" font-size="13" font-weight="800">MSME PRODUCT</text>
        </svg>`;

    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg.replace(/\s+/g, ' ').trim())}`;
};

export const resolveMarketplaceImage = (item: any, itemType?: MarketplaceImageItemType) =>
    getMarketplaceImageCandidates(item)[0] || (itemType === 'service' ? buildServiceFallbackImage(item) : buildProductFallbackImage(item));

export const fallbackImageTone = (itemType: MarketplaceImageItemType) =>
    itemType === 'service'
        ? 'bg-blue-50 text-[#0b2447]/45 border-blue-100'
        : 'bg-slate-50 text-slate-300 border-slate-100';
