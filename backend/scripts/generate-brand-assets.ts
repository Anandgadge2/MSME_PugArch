import fs from 'fs';
import path from 'path';

import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '../..');
const frontendPublic = path.resolve(repoRoot, 'frontend/public');
const backendUploads = path.resolve(repoRoot, 'backend/uploads');

const ensureDirs = () => {
  ['org-logos', 'banners', 'products'].forEach(dir => {
    fs.mkdirSync(path.join(frontendPublic, dir), { recursive: true });
    fs.mkdirSync(path.join(backendUploads, dir), { recursive: true });
  });
};

const saveAsset = (subDir: string, fileName: string, content: string) => {
  const fPath = path.join(frontendPublic, subDir, fileName);
  const bPath = path.join(backendUploads, subDir, fileName);
  fs.writeFileSync(fPath, content, 'utf-8');
  fs.writeFileSync(bPath, content, 'utf-8');
};

const generateLogoSvg = (name: string, subtitle: string, primaryColor: string, secondaryColor: string, iconType: string, initials: string) => {
  let iconSvg = '';
  
  switch(iconType) {
    case 'vedanta':
      iconSvg = `
        <rect x="25" y="20" width="50" height="50" rx="14" fill="url(#grad)" stroke="${secondaryColor}" stroke-width="2.5" />
        <path d="M35 33 L50 62 L65 33 Z" fill="${secondaryColor}" opacity="0.95" />
        <path d="M42 33 L50 50 L58 33 Z" fill="#ffffff" />
        <circle cx="50" cy="27" r="3.5" fill="#f59e0b" />
      `;
      break;
    case 'jsw':
      iconSvg = `
        <rect x="20" y="20" width="60" height="60" rx="16" fill="url(#grad)" />
        <path d="M30 65 L48 25 L56 25 L40 65 Z" fill="#ef4444" />
        <path d="M48 65 L66 25 L74 25 L58 65 Z" fill="#38bdf8" />
        <polygon points="46,38 58,38 52,50 62,50 44,68 48,54 38,54" fill="#fbbf24" />
      `;
      break;
    case 'refractory':
      iconSvg = `
        <rect x="22" y="22" width="56" height="56" rx="12" fill="url(#grad)" stroke="#f97316" stroke-width="2" />
        <polygon points="50,28 72,40 50,52 28,40" fill="#f97316" />
        <polygon points="50,52 72,40 72,58 50,70" fill="#c2410c" />
        <polygon points="50,52 28,40 28,58 50,70" fill="#ea580c" />
        <circle cx="50" cy="40" r="4" fill="#ffffff" />
      `;
      break;
    case 'steel':
      iconSvg = `
        <rect x="20" y="20" width="60" height="60" rx="16" fill="url(#grad)" />
        <path d="M32 30 L68 30 L62 42 L38 42 Z" fill="${secondaryColor}" />
        <rect x="44" y="42" width="12" height="26" fill="#e2e8f0" />
        <path d="M30 68 L70 68 L64 56 L36 56 Z" fill="${secondaryColor}" />
      `;
      break;
    case 'cement':
      iconSvg = `
        <rect x="20" y="20" width="60" height="60" rx="14" fill="#facc15" stroke="#000000" stroke-width="3" />
        <polygon points="50,26 74,40 50,54 26,40" fill="#000000" />
        <polygon points="50,54 74,40 74,62 50,76" fill="#1e293b" />
        <polygon points="50,54 26,40 26,62 50,76" fill="#334155" />
        <text x="50" y="44" font-size="10" font-weight="900" text-anchor="middle" fill="#facc15">UT</text>
      `;
      break;
    case 'bearing':
      iconSvg = `
        <circle cx="50" cy="50" r="30" fill="url(#grad)" stroke="${secondaryColor}" stroke-width="3" />
        <circle cx="50" cy="50" r="16" fill="#ffffff" stroke="${primaryColor}" stroke-width="3" />
        <circle cx="50" cy="28" r="4" fill="${secondaryColor}" />
        <circle cx="72" cy="50" r="4" fill="${secondaryColor}" />
        <circle cx="50" cy="72" r="4" fill="${secondaryColor}" />
        <circle cx="28" cy="50" r="4" fill="${secondaryColor}" />
        <circle cx="65" cy="35" r="4" fill="${secondaryColor}" />
        <circle cx="65" cy="65" r="4" fill="${secondaryColor}" />
        <circle cx="35" cy="65" r="4" fill="${secondaryColor}" />
        <circle cx="35" cy="35" r="4" fill="${secondaryColor}" />
      `;
      break;
    case 'safety':
      iconSvg = `
        <rect x="20" y="20" width="60" height="60" rx="16" fill="url(#grad)" />
        <path d="M50 26 C64 26 70 34 70 46 C70 60 50 72 50 72 C50 72 30 60 30 46 C30 34 36 26 50 26 Z" fill="${secondaryColor}" stroke="#ffffff" stroke-width="2" />
        <path d="M42 47 L47 52 L58 41" stroke="#ffffff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" fill="none" />
      `;
      break;
    case 'electrical':
      iconSvg = `
        <rect x="20" y="20" width="60" height="60" rx="16" fill="url(#grad)" />
        <circle cx="50" cy="50" r="24" fill="none" stroke="${secondaryColor}" stroke-width="3" stroke-dasharray="4,3" />
        <polygon points="53,26 38,48 48,48 44,74 62,48 51,48" fill="#fbbf24" stroke="#ffffff" stroke-width="1.5" />
      `;
      break;
    case 'chain':
      iconSvg = `
        <rect x="20" y="20" width="60" height="60" rx="16" fill="url(#grad)" />
        <rect x="30" y="32" width="22" height="36" rx="11" fill="none" stroke="${secondaryColor}" stroke-width="5" transform="rotate(-30 41 50)" />
        <rect x="48" y="32" width="22" height="36" rx="11" fill="none" stroke="#ffffff" stroke-width="5" transform="rotate(-30 59 50)" />
      `;
      break;
    case 'welding':
      iconSvg = `
        <rect x="20" y="20" width="60" height="60" rx="16" fill="url(#grad)" />
        <path d="M35 65 L65 35 M58 28 L72 42" stroke="${secondaryColor}" stroke-width="5" stroke-linecap="round" />
        <polygon points="35,65 30,70 25,65 30,60" fill="#f59e0b" />
        <circle cx="28" cy="68" r="7" fill="#fbbf24" opacity="0.6" />
        <circle cx="22" cy="72" r="3" fill="#f97316" />
      `;
      break;
    case 'pipe':
      iconSvg = `
        <rect x="20" y="20" width="60" height="60" rx="16" fill="url(#grad)" />
        <path d="M26 36 L74 36 L74 64 L26 64 Z" fill="none" stroke="${secondaryColor}" stroke-width="4" />
        <ellipse cx="26" cy="50" rx="5" ry="14" fill="${secondaryColor}" />
        <ellipse cx="74" cy="50" rx="5" ry="14" fill="#38bdf8" />
        <circle cx="50" cy="50" r="8" fill="#ffffff" stroke="${primaryColor}" stroke-width="3" />
      `;
      break;
    case 'cleaning':
      iconSvg = `
        <rect x="20" y="20" width="60" height="60" rx="16" fill="url(#grad)" />
        <path d="M50 25 L68 55 C68 65 60 73 50 73 C40 73 32 65 32 55 Z" fill="${secondaryColor}" opacity="0.9" />
        <circle cx="44" cy="48" r="4" fill="#ffffff" opacity="0.8" />
        <polygon points="56,38 60,46 68,48 62,54 64,62 56,58 48,62 50,54 44,48 52,46" fill="#facc15" />
      `;
      break;
    case 'eco':
      iconSvg = `
        <rect x="20" y="20" width="60" height="60" rx="16" fill="url(#grad)" />
        <path d="M30 68 C30 45 45 30 70 28 C70 53 55 68 30 68 Z" fill="#22c55e" stroke="#ffffff" stroke-width="2" />
        <path d="M30 68 L52 46" stroke="#ffffff" stroke-width="3" stroke-linecap="round" />
        <path d="M42 56 L50 62" stroke="#ffffff" stroke-width="2" stroke-linecap="round" />
      `;
      break;
    default:
      iconSvg = `
        <rect x="20" y="20" width="60" height="60" rx="16" fill="url(#grad)" />
        <text x="50" y="58" font-size="22" font-weight="900" text-anchor="middle" fill="#ffffff">${initials}</text>
      `;
  }

  return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 100" width="320" height="100">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${primaryColor}" />
      <stop offset="100%" stop-color="${secondaryColor}" />
    </linearGradient>
    <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="2" stdDeviation="3" flood-opacity="0.12"/>
    </filter>
  </defs>

  <rect width="320" height="100" rx="16" fill="#ffffff" stroke="#e2e8f0" stroke-width="1.5" filter="url(#shadow)" />

  <g>
    ${iconSvg}
  </g>

  <text x="96" y="44" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Noto Sans', sans-serif" font-size="13.5" font-weight="800" fill="#0f172a" letter-spacing="-0.2px">
    ${escapeXml(name.length > 22 ? name.slice(0, 22) + '...' : name)}
  </text>
  
  <text x="96" y="64" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Noto Sans', sans-serif" font-size="9.5" font-weight="600" fill="#64748b" letter-spacing="0.4px">
    ${escapeXml(subtitle)}
  </text>

  <g transform="translate(96, 72)">
    <rect width="80" height="15" rx="7.5" fill="#f1f5f9" />
    <circle cx="8" cy="7.5" r="3" fill="#10b981" />
    <text x="16" y="10.5" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="7.5" font-weight="800" fill="#047857" letter-spacing="0.3px">JHARSUGUDA</text>
  </g>
</svg>
`.trim();
};

const generateBannerSvg = (name: string, category: string, primaryColor: string, secondaryColor: string) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 400" width="1200" height="400">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${primaryColor}" />
      <stop offset="60%" stop-color="${secondaryColor}" />
      <stop offset="100%" stop-color="#020617" />
    </linearGradient>
    <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
      <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>
    </pattern>
  </defs>

  <rect width="1200" height="400" fill="url(#bg)" />
  <rect width="1200" height="400" fill="url(#grid)" />

  <circle cx="1050" cy="120" r="220" fill="rgba(255,255,255,0.05)" />
  <circle cx="150" cy="300" r="180" fill="rgba(255,255,255,0.04)" />

  <rect x="80" y="80" width="220" height="34" rx="17" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.3)" />
  <circle cx="100" cy="97" r="6" fill="#10b981" />
  <text x="116" y="103" font-family="-apple-system, sans-serif" font-size="11" font-weight="800" fill="#ffffff" letter-spacing="1.5px">VERIFIED ORGANIZATION</text>

  <text x="80" y="180" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="38" font-weight="900" fill="#ffffff" letter-spacing="-0.5px">
    ${escapeXml(name)}
  </text>

  <text x="80" y="225" font-family="-apple-system, sans-serif" font-size="18" font-weight="600" fill="rgba(255,255,255,0.85)">
    Jharsuguda Industrial Hub • ${escapeXml(category)}
  </text>

  <g transform="translate(80, 275)">
    <rect width="180" height="50" rx="12" fill="rgba(0,0,0,0.3)" stroke="rgba(255,255,255,0.15)" />
    <text x="20" y="24" font-family="sans-serif" font-size="9.5" font-weight="700" fill="rgba(255,255,255,0.6)" letter-spacing="0.5px">LOCATION</text>
    <text x="20" y="41" font-family="sans-serif" font-size="13" font-weight="800" fill="#ffffff">Jharsuguda, Odisha</text>

    <rect x="200" width="180" height="50" rx="12" fill="rgba(0,0,0,0.3)" stroke="rgba(255,255,255,0.15)" />
    <text x="220" y="24" font-family="sans-serif" font-size="9.5" font-weight="700" fill="rgba(255,255,255,0.6)" letter-spacing="0.5px">STATUS</text>
    <text x="220" y="41" font-family="sans-serif" font-size="13" font-weight="800" fill="#34d399">GST &amp; MSME Verified</text>

    <rect x="400" width="200" height="50" rx="12" fill="rgba(0,0,0,0.3)" stroke="rgba(255,255,255,0.15)" />
    <text x="420" y="24" font-family="sans-serif" font-size="9.5" font-weight="700" fill="rgba(255,255,255,0.6)" letter-spacing="0.5px">PORTAL LINKAGE</text>
    <text x="420" y="41" font-family="sans-serif" font-size="13" font-weight="800" fill="#60a5fa">JSG SMILE Active</text>
  </g>
</svg>
`.trim();

const generateProductSvg = (title: string, category: string, primaryColor: string, secondaryColor: string, type: string) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600" width="600" height="600">
  <defs>
    <linearGradient id="pbg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#f8fafc" />
      <stop offset="100%" stop-color="#e2e8f0" />
    </linearGradient>
    <linearGradient id="pgrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${primaryColor}" />
      <stop offset="100%" stop-color="${secondaryColor}" />
    </linearGradient>
  </defs>

  <rect width="600" height="600" fill="url(#pbg)" />

  <g transform="translate(150, 120)">
    <rect width="300" height="280" rx="24" fill="url(#pgrad)" stroke="rgba(255,255,255,0.4)" stroke-width="4" filter="drop-shadow(0 20px 30px rgba(0,0,0,0.15))" />
    <circle cx="150" cy="140" r="80" fill="rgba(255,255,255,0.15)" />
    <circle cx="150" cy="140" r="55" fill="rgba(255,255,255,0.25)" />
    <text x="150" y="150" font-family="sans-serif" font-size="28" font-weight="900" text-anchor="middle" fill="#ffffff">${escapeXml(type.slice(0, 4).toUpperCase())}</text>
  </g>

  <rect x="40" y="440" width="520" height="120" rx="16" fill="#ffffff" stroke="#cbd5e1" stroke-width="1.5" />
  
  <text x="70" y="480" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="18" font-weight="900" fill="#0f172a">
    ${escapeXml(title.length > 34 ? title.slice(0, 34) + '...' : title)}
  </text>
  
  <text x="70" y="508" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="13" font-weight="600" fill="#64748b">
    Category: ${escapeXml(category)} • Jharsuguda MSME Supply
  </text>

  <g transform="translate(70, 524)">
    <rect width="130" height="22" rx="11" fill="#ecfdf5" stroke="#a7f3d0" />
    <text x="12" y="15" font-family="sans-serif" font-size="10" font-weight="800" fill="#065f46">COMMERCIAL GRADE</text>
  </g>
</svg>
`.trim();

function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}

import { BUYERS_DATA, SELLERS_DATA } from './portal-seed-data.js';

export const generateAllAssets = () => {
  ensureDirs();
  console.log('Generating SVG logos, banners, and product images...');

  for (const buyer of BUYERS_DATA) {
    const logoSvg = generateLogoSvg(buyer.name, buyer.subtitle, buyer.primaryColor, buyer.secondaryColor, buyer.icon, buyer.shortName.slice(0, 2));
    saveAsset('org-logos', `${buyer.slug}.svg`, logoSvg);

    const bannerSvg = generateBannerSvg(buyer.name, buyer.category, buyer.primaryColor, buyer.secondaryColor);
    saveAsset('banners', `${buyer.slug}-banner.svg`, bannerSvg);

    for (let i = 0; i < buyer.requirements.length; i++) {
      const req = buyer.requirements[i];
      const prodSvg = generateProductSvg(req.title, req.category, buyer.primaryColor, buyer.secondaryColor, req.type);
      saveAsset('products', `${buyer.slug}-req-${i + 1}.svg`, prodSvg);
    }
  }

  for (const seller of SELLERS_DATA) {
    const logoSvg = generateLogoSvg(seller.name, seller.subtitle, seller.primaryColor, seller.secondaryColor, seller.icon, seller.shortName.slice(0, 2));
    saveAsset('org-logos', `${seller.slug}.svg`, logoSvg);

    const bannerSvg = generateBannerSvg(seller.name, seller.category, seller.primaryColor, seller.secondaryColor);
    saveAsset('banners', `${seller.slug}-banner.svg`, bannerSvg);

    for (let i = 0; i < seller.products.length; i++) {
      const prod = seller.products[i];
      const prodSvg = generateProductSvg(prod.name, prod.category, seller.primaryColor, seller.secondaryColor, 'PRODUCT');
      saveAsset('products', `${seller.slug}-prod-${i + 1}.svg`, prodSvg);
    }
  }

  console.log('All brand assets successfully generated!');
};

generateAllAssets();
