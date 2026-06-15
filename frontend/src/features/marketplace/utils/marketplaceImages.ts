import { BASE_URL } from '../../../lib/api';

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
    if (/^(https?:)?\/\//i.test(raw) || raw.startsWith('data:') || raw.startsWith('blob:')) return raw;
    if (raw.startsWith('/')) return `${BASE_URL}${raw}`;
    return `${BASE_URL}/${raw.replace(/^\.?\//, '')}`;
};

const looksLikeImage = (entry: any) => {
    const mimeType = String(entry?.mimeType || entry?.fileAsset?.mimeType || '').toLowerCase();
    const name = String(entry?.originalName || entry?.fileName || entry?.name || entry?.fileAsset?.originalName || entry?.url || entry?.fileAsset?.url || '').toLowerCase();
    return mimeType.startsWith('image/') || imageExtensions.test(name);
};

const readImageFromEntry = (entry: any) => {
    if (!entry) return '';
    const direct = normalizeUrl(entry.imageUrl || entry.primaryImageUrl || entry.thumbnailUrl || entry.url || entry.fileUrl);
    if (direct && (looksLikeImage(entry) || imageExtensions.test(direct) || direct.startsWith('data:') || direct.startsWith('blob:'))) {
        return direct;
    }

    const fileAssetUrl = normalizeUrl(entry.fileAsset?.url || entry.asset?.url || entry.file?.url);
    if (fileAssetUrl && (looksLikeImage(entry) || imageExtensions.test(fileAssetUrl))) return fileAssetUrl;
    return '';
};

export const getMarketplaceImageCandidates = (item: any): string[] => {
    if (!item) return [];
    const direct = [
        item.imageUrl,
        item.primaryImageUrl,
        item.thumbnailUrl,
        item.photoUrl,
        item.coverImageUrl,
        item.bannerImageUrl,
        item.fileAsset?.url,
    ].map(normalizeUrl).filter(Boolean);

    const mediaCollections = [
        item.images,
        item.productImages,
        item.serviceImages,
        item.catalogueImages,
        item.media,
        item.catalogueFiles,
        item.files,
        item.attachments,
    ];

    for (const collection of mediaCollections) {
        if (!Array.isArray(collection)) continue;
        for (const entry of collection) {
            const candidate = readImageFromEntry(entry);
            if (candidate) direct.push(candidate);
        }
    }

    return Array.from(new Set(direct));
};

const buildServiceFallbackImage = (item: any) => {
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

export const resolveMarketplaceImage = (item: any, itemType?: MarketplaceImageItemType) =>
    getMarketplaceImageCandidates(item)[0] || (itemType === 'service' ? buildServiceFallbackImage(item) : '');

export const fallbackImageTone = (itemType: MarketplaceImageItemType) =>
    itemType === 'service'
        ? 'bg-blue-50 text-[#0b2447]/45 border-blue-100'
        : 'bg-slate-50 text-slate-300 border-slate-100';
