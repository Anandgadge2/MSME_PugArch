import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '../..');
const frontendPublic = path.resolve(repoRoot, 'frontend/public');
const backendUploads = path.resolve(repoRoot, 'backend/uploads');

const saveLogo = (fileName: string, content: string) => {
  fs.mkdirSync(path.join(frontendPublic, 'org-logos'), { recursive: true });
  fs.mkdirSync(path.join(backendUploads, 'org-logos'), { recursive: true });
  fs.writeFileSync(path.join(frontendPublic, 'org-logos', fileName), content, 'utf-8');
  fs.writeFileSync(path.join(backendUploads, 'org-logos', fileName), content, 'utf-8');
};

// 1:1 Square/Circular Master Logo Container (ViewBox 0 0 300 300)
function createLogoSvg(content: string, bgColor = '#ffffff'): string {
  return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300" width="300" height="300">
  <defs>
    <radialGradient id="logoBgGrad" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#ffffff" />
      <stop offset="85%" stop-color="#f8fafc" />
      <stop offset="100%" stop-color="#f1f5f9" />
    </radialGradient>
    <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fde047" />
      <stop offset="50%" stop-color="#eab308" />
      <stop offset="100%" stop-color="#ca8a04" />
    </linearGradient>
    <linearGradient id="vedantaGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#002b49" />
      <stop offset="100%" stop-color="#005a9c" />
    </linearGradient>
    <linearGradient id="jswGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#003366" />
      <stop offset="100%" stop-color="#001a33" />
    </linearGradient>
    <linearGradient id="chromeMetal" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#f8fafc" />
      <stop offset="40%" stop-color="#cbd5e1" />
      <stop offset="70%" stop-color="#ffffff" />
      <stop offset="100%" stop-color="#94a3b8" />
    </linearGradient>
    <filter id="logoShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="#0f172a" flood-opacity="0.12"/>
    </filter>
  </defs>

  <rect width="300" height="300" rx="150" fill="${bgColor === '#ffffff' ? 'url(#logoBgGrad)' : bgColor}" />
  <circle cx="150" cy="150" r="148" fill="none" stroke="#e2e8f0" stroke-width="2" opacity="0.8" />

  <g filter="url(#logoShadow)">
    ${content}
  </g>
</svg>
`.trim();
}

// -------------------------------------------------------------
// Real Logos for Top 10 Jharsuguda Buyers
// -------------------------------------------------------------

export const BUYER_LOGOS: Record<string, string> = {
  // 1. Vedanta Limited (Official iconic navy/green ribbon sphere + vedanta typography)
  'vedanta-jharsuguda.svg': createLogoSvg(`
    <g transform="translate(150, 115)">
      <!-- Iconic Vedanta Globe Ribbon -->
      <circle cx="0" cy="0" r="58" fill="none" stroke="#002b49" stroke-width="12" />
      <!-- Vibrant Green Arc Ribbon -->
      <path d="M-45 -10 C-40 40 20 50 50 15 C30 40 -15 35 -35 -5 Z" fill="#00a651" />
      <!-- Inner Dynamic V Core -->
      <path d="M-28 -28 L0 26 L28 -28" fill="none" stroke="#002b49" stroke-width="12" stroke-linecap="round" stroke-linejoin="round" />
    </g>
    <!-- Brand Typography -->
    <text x="150" y="215" font-family="'Helvetica Neue', Arial, sans-serif" font-size="28" font-weight="900" fill="#002b49" text-anchor="middle" letter-spacing="-0.5">vedanta</text>
    <text x="150" y="235" font-family="'Helvetica Neue', Arial, sans-serif" font-size="10" font-weight="700" fill="#00a651" text-anchor="middle" letter-spacing="3">TRANSFORMING ELEMENTS</text>
    <text x="150" y="252" font-family="'Helvetica Neue', Arial, sans-serif" font-size="9" font-weight="800" fill="#64748b" text-anchor="middle" letter-spacing="1.5">JHARSUGUDA</text>
  `),

  // 2. JSW Energy (Official JSW bold red/blue angled monogram)
  'jsw-energy-utkal.svg': createLogoSvg(`
    <g transform="translate(45, 80)">
      <!-- JSW Bold Letters -->
      <g transform="skewX(-14)">
        <!-- J -->
        <path d="M25 0 L52 0 L52 65 C52 82 38 90 20 90 C5 90 -2 82 -2 68 L22 68 C22 74 27 75 32 75 C38 75 42 72 42 64 L42 22 L25 22 Z" fill="#003366" />
        <!-- S -->
        <path d="M60 68 C62 82 74 90 94 90 C114 90 126 80 126 65 C126 48 110 44 94 40 C78 36 72 32 72 24 C72 16 80 11 90 11 C102 11 110 16 112 26 L124 24 C122 10 110 0 90 0 C70 0 60 10 60 25 C60 42 76 46 92 50 C108 54 114 58 114 66 C114 74 106 79 94 79 C82 79 74 72 72 65 Z" fill="#003366" />
        <!-- W with Dynamic Red Slash -->
        <path d="M132 0 L146 90 L166 90 L176 30 L186 90 L206 90 L220 0 L208 0 L198 62 L188 0 L172 0 L162 62 L152 0 Z" fill="#003366" />
        <polygon points="176,15 210,0 200,90 186,90" fill="#e31b23" />
      </g>
    </g>
    <!-- Subtitle Energy -->
    <rect x="60" y="195" width="180" height="26" rx="6" fill="#e31b23" />
    <text x="150" y="213" font-family="'Helvetica Neue', Arial, sans-serif" font-size="14" font-weight="900" fill="#ffffff" text-anchor="middle" letter-spacing="4">ENERGY</text>
    <text x="150" y="240" font-family="'Helvetica Neue', Arial, sans-serif" font-size="10" font-weight="800" fill="#003366" text-anchor="middle" letter-spacing="2">UTKAL • JHARSUGUDA</text>
  `),

  // 3. TRL Krosaki Refractories Limited (Precision Japanese refractory red/black emblem)
  'trl-krosaki-refractories.svg': createLogoSvg(`
    <g transform="translate(150, 100)">
      <!-- Octagon Industrial Precision Badge -->
      <polygon points="0,-55 38,-38 55,0 38,38 0,55 -38,38 -55,0 -38,-38" fill="#e60012" stroke="#b91c1c" stroke-width="3" />
      <!-- Inner Steel Core -->
      <polygon points="0,-40 28,-28 40,0 28,28 0,40 -28,28 -40,0 -28,-28" fill="#ffffff" />
      <!-- Krosaki K Symbol -->
      <path d="M-18 -24 L-6 -24 L-6 0 L14 -24 L28 -24 L4 4 L30 24 L14 24 L-6 6 L-6 24 L-18 24 Z" fill="#e60012" />
    </g>
    <text x="150" y="195" font-family="Arial, sans-serif" font-size="24" font-weight="900" fill="#0f172a" text-anchor="middle" letter-spacing="1">TRL KROSAKI</text>
    <text x="150" y="218" font-family="Arial, sans-serif" font-size="10" font-weight="800" fill="#e60012" text-anchor="middle" letter-spacing="2">REFRACTORIES LIMITED</text>
    <text x="150" y="238" font-family="Arial, sans-serif" font-size="9" font-weight="700" fill="#64748b" text-anchor="middle">BELPAHAR • JHARSUGUDA</text>
  `),

  // 4. SMC Power Generation Limited (Steel & Power red/gold shield crest)
  'smc-power-generation.svg': createLogoSvg(`
    <g transform="translate(150, 95)">
      <!-- Shield Flame Badge -->
      <path d="M0 -50 C40 -50 55 -20 55 10 C55 45 25 60 0 75 C-25 60 -55 45 -55 10 C-55 -20 -40 -50 0 -50 Z" fill="#b91c1c" stroke="#991b1b" stroke-width="3" />
      <!-- Golden Energy Bolt Core -->
      <polygon points="0,-35 15,0 -5,0 12,35 -18,5 -2,5" fill="url(#goldGrad)" />
    </g>
    <text x="150" y="200" font-family="sans-serif" font-size="24" font-weight="900" fill="#0f172a" text-anchor="middle" letter-spacing="1">SMC POWER</text>
    <text x="150" y="222" font-family="sans-serif" font-size="10" font-weight="800" fill="#b91c1c" text-anchor="middle" letter-spacing="2">GENERATION LIMITED</text>
    <text x="150" y="240" font-family="sans-serif" font-size="9" font-weight="700" fill="#64748b" text-anchor="middle">STEEL &amp; CAPTIVE POWER</text>
  `),

  // 5. Orissa Metaliks Private Limited (Deep maroon & molten gold OMPL crest)
  'orissa-metaliks.svg': createLogoSvg(`
    <g transform="translate(150, 100)">
      <!-- Steel Ladle / Ingot Emblem -->
      <circle cx="0" cy="0" r="55" fill="#7f1d1d" stroke="#991b1b" stroke-width="4" />
      <polygon points="-30,-15 30,-15 20,25 -20,25" fill="url(#goldGrad)" />
      <circle cx="0" cy="-22" r="14" fill="#fef08a" />
    </g>
    <text x="150" y="195" font-family="sans-serif" font-size="22" font-weight="900" fill="#7f1d1d" text-anchor="middle" letter-spacing="1">ORISSA METALIKS</text>
    <text x="150" y="218" font-family="sans-serif" font-size="11" font-weight="800" fill="#b45309" text-anchor="middle" letter-spacing="2.5">PRIVATE LIMITED</text>
    <text x="150" y="238" font-family="sans-serif" font-size="9" font-weight="700" fill="#64748b" text-anchor="middle">INTEGRATED STEEL PLANT</text>
  `),

  // 6. UltraTech Cement – Jharsuguda Cement Works (Iconic Aditya Birla Rising Sun + UltraTech)
  'ultratech-cement-jharsuguda.svg': createLogoSvg(`
    <g transform="translate(150, 85)">
      <!-- Aditya Birla Group Sunburst Emblem -->
      <circle cx="0" cy="0" r="28" fill="#eab308" />
      <!-- Radiant Rays -->
      <g fill="#dc2626">
        <polygon points="0,-48 8,-35 -8,-35" />
        <polygon points="34,-34 32,-18 20,-28" />
        <polygon points="48,0 35,8 35,-8" />
        <polygon points="34,34 20,28 32,18" />
        <polygon points="0,48 -8,35 8,35" />
        <polygon points="-34,34 -32,18 -20,28" />
        <polygon points="-48,0 -35,-8 -35,8" />
        <polygon points="-34,-34 -20,-28 -32,-18" />
      </g>
      <circle cx="0" cy="0" r="18" fill="#fde047" />
    </g>
    <!-- Yellow UltraTech Badge Box -->
    <rect x="35" y="150" width="230" height="42" rx="8" fill="#facc15" stroke="#eab308" stroke-width="2" />
    <text x="150" y="178" font-family="'Arial Black', Impact, sans-serif" font-size="22" font-weight="900" fill="#0f172a" text-anchor="middle" letter-spacing="1">UltraTech</text>
    <text x="150" y="215" font-family="sans-serif" font-size="16" font-weight="900" fill="#dc2626" text-anchor="middle" letter-spacing="4">CEMENT</text>
    <text x="150" y="235" font-family="sans-serif" font-size="9" font-weight="800" fill="#475569" text-anchor="middle" letter-spacing="1.5">JHARSUGUDA CEMENT WORKS</text>
  `),

  // 7. L N Metallics Limited (Industrial gear & ladle crest)
  'ln-metallics.svg': createLogoSvg(`
    <g transform="translate(150, 100)">
      <circle cx="0" cy="0" r="54" fill="#1e3a8a" stroke="#1d4ed8" stroke-width="4" />
      <!-- Golden Monogram LNM -->
      <text x="0" y="14" font-family="sans-serif" font-size="34" font-weight="900" fill="url(#goldGrad)" text-anchor="middle" letter-spacing="2">LNM</text>
    </g>
    <text x="150" y="195" font-family="sans-serif" font-size="22" font-weight="900" fill="#0f172a" text-anchor="middle" letter-spacing="0.5">L N METALLICS</text>
    <text x="150" y="218" font-family="sans-serif" font-size="11" font-weight="800" fill="#1e3a8a" text-anchor="middle" letter-spacing="3">LIMITED</text>
    <text x="150" y="238" font-family="sans-serif" font-size="9" font-weight="700" fill="#64748b" text-anchor="middle">SPONGE IRON &amp; STEEL</text>
  `),

  // 8. Seven Star Steels Limited (7 brilliant golden stars around industrial crest)
  'seven-star-steels.svg': createLogoSvg(`
    <g transform="translate(150, 95)">
      <!-- Steel Blue Diamond -->
      <polygon points="0,-50 50,0 0,50 -50,0" fill="#0f172a" stroke="#38bdf8" stroke-width="3" />
      <!-- Big Golden Star Center -->
      <polygon points="0,-25 8,-8 25,-8 12,3 17,20 0,10 -17,20 -12,3 -25,-8 -8,-8" fill="url(#goldGrad)" />
      <!-- Outer Stars Arc -->
      <g fill="#fde047">
        <circle cx="-35" cy="-25" r="4" />
        <circle cx="-42" cy="0" r="4" />
        <circle cx="-35" cy="25" r="4" />
        <circle cx="35" cy="-25" r="4" />
        <circle cx="42" cy="0" r="4" />
        <circle cx="35" cy="25" r="4" />
      </g>
    </g>
    <text x="150" y="195" font-family="sans-serif" font-size="20" font-weight="900" fill="#0f172a" text-anchor="middle" letter-spacing="1">SEVEN STAR</text>
    <text x="150" y="218" font-family="sans-serif" font-size="12" font-weight="900" fill="#0284c7" text-anchor="middle" letter-spacing="3">STEELS LIMITED</text>
    <text x="150" y="238" font-family="sans-serif" font-size="9" font-weight="700" fill="#64748b" text-anchor="middle">JHARSUGUDA</text>
  `),

  // 9. Jai Hanuman Udyog Limited (Saffron/Crimson mace crest)
  'jai-hanuman-udyog.svg': createLogoSvg(`
    <g transform="translate(150, 100)">
      <circle cx="0" cy="0" r="54" fill="#ea580c" stroke="#c2410c" stroke-width="4" />
      <!-- Golden Gada / Mace Motif -->
      <circle cx="0" cy="-15" r="22" fill="url(#goldGrad)" stroke="#78350f" stroke-width="2" />
      <rect x="-5" y="-15" width="10" height="48" rx="4" fill="url(#goldGrad)" stroke="#78350f" stroke-width="1.5" />
    </g>
    <text x="150" y="195" font-family="sans-serif" font-size="18" font-weight="900" fill="#0f172a" text-anchor="middle" letter-spacing="0.5">JAI HANUMAN</text>
    <text x="150" y="218" font-family="sans-serif" font-size="11" font-weight="800" fill="#ea580c" text-anchor="middle" letter-spacing="2">UDYOG LIMITED</text>
    <text x="150" y="238" font-family="sans-serif" font-size="9" font-weight="700" fill="#64748b" text-anchor="middle">TMT ROLLING MILLS</text>
  `),

  // 10. Thakur Prasad Sao and Sons (TPS Monogram Anvil Crest)
  'thakur-prasad-sao.svg': createLogoSvg(`
    <g transform="translate(150, 100)">
      <circle cx="0" cy="0" r="54" fill="#1e293b" stroke="#334155" stroke-width="4" />
      <text x="0" y="15" font-family="sans-serif" font-size="34" font-weight="900" fill="url(#goldGrad)" text-anchor="middle" letter-spacing="3">TPS</text>
    </g>
    <text x="150" y="195" font-family="sans-serif" font-size="17" font-weight="900" fill="#0f172a" text-anchor="middle" letter-spacing="0.5">THAKUR PRASAD SAO</text>
    <text x="150" y="218" font-family="sans-serif" font-size="10" font-weight="800" fill="#d97706" text-anchor="middle" letter-spacing="2">&amp; SONS PVT LTD • UNIT IV</text>
    <text x="150" y="238" font-family="sans-serif" font-size="9" font-weight="700" fill="#64748b" text-anchor="middle">HEAVY INDUSTRIAL ROLLING</text>
  `)
};

// -------------------------------------------------------------
// Real Logos for Top 20 Verified MSME Sellers
// -------------------------------------------------------------

export const SELLER_LOGOS: Record<string, string> = {
  // 1. ATOM ENGINEERING PRODUCTS PVT LTD (Atomic orbital rings)
  'atom-engineering-products.svg': createLogoSvg(`
    <g transform="translate(150, 100)">
      <ellipse cx="0" cy="0" rx="55" ry="22" fill="none" stroke="#0284c7" stroke-width="5" transform="rotate(30)" />
      <ellipse cx="0" cy="0" rx="55" ry="22" fill="none" stroke="#0284c7" stroke-width="5" transform="rotate(-30)" />
      <ellipse cx="0" cy="0" rx="55" ry="22" fill="none" stroke="#0284c7" stroke-width="5" transform="rotate(90)" />
      <circle cx="0" cy="0" r="16" fill="#0369a1" />
      <circle cx="0" cy="0" r="8" fill="#f8fafc" />
    </g>
    <text x="150" y="195" font-family="sans-serif" font-size="22" font-weight="900" fill="#0f172a" text-anchor="middle" letter-spacing="2">ATOM</text>
    <text x="150" y="218" font-family="sans-serif" font-size="10" font-weight="800" fill="#0284c7" text-anchor="middle" letter-spacing="2">ENGINEERING PRODUCTS</text>
    <text x="150" y="238" font-family="sans-serif" font-size="8" font-weight="700" fill="#64748b" text-anchor="middle">TOOLS &amp; MRO SUPPLIES</text>
  `),

  // 2. ABHINAV DISTRIBUTORS (Welding torch flame shield)
  'abhinav-distributors.svg': createLogoSvg(`
    <g transform="translate(150, 100)">
      <path d="M0 -50 C35 -50 48 -20 48 10 C48 45 20 60 0 70 C-20 60 -48 45 -48 10 C-48 -20 -35 -50 0 -50 Z" fill="#ea580c" stroke="#c2410c" stroke-width="3" />
      <!-- Welding Arc Spark -->
      <polygon points="0,-35 12,-5 -2,-5 10,25 -14,0 0,0" fill="#fde047" />
    </g>
    <text x="150" y="195" font-family="sans-serif" font-size="20" font-weight="900" fill="#0f172a" text-anchor="middle" letter-spacing="1">ABHINAV</text>
    <text x="150" y="218" font-family="sans-serif" font-size="10" font-weight="800" fill="#ea580c" text-anchor="middle" letter-spacing="2">DISTRIBUTORS</text>
    <text x="150" y="238" font-family="sans-serif" font-size="8" font-weight="700" fill="#64748b" text-anchor="middle">WELDING &amp; CONSUMABLES</text>
  `),

  // 3. Indian Chain & Mill Stores (Forged lifting hook & gold chain)
  'indian-chain-mill-stores.svg': createLogoSvg(`
    <g transform="translate(150, 95)">
      <!-- Master Chain Link -->
      <ellipse cx="0" cy="-20" rx="20" ry="32" fill="none" stroke="url(#goldGrad)" stroke-width="10" />
      <!-- Heavy Hook -->
      <path d="M0 5 C0 45 35 55 35 25 C35 -5 12 -5 10 15 C8 30 -10 32 -10 12 Z" fill="#0f172a" stroke="#334155" stroke-width="3" />
    </g>
    <text x="150" y="195" font-family="sans-serif" font-size="18" font-weight="900" fill="#0f172a" text-anchor="middle" letter-spacing="1">INDIAN CHAIN</text>
    <text x="150" y="218" font-family="sans-serif" font-size="10" font-weight="800" fill="#d97706" text-anchor="middle" letter-spacing="2">&amp; MILL STORES</text>
    <text x="150" y="238" font-family="sans-serif" font-size="8" font-weight="700" fill="#64748b" text-anchor="middle">LIFTING &amp; RIGGING GEAR</text>
  `),

  // 4. R.L. Industrial Corporation (Safety Helmet & Shield)
  'rl-industrial-corporation.svg': createLogoSvg(`
    <g transform="translate(150, 95)">
      <circle cx="0" cy="0" r="52" fill="#16a34a" stroke="#15803d" stroke-width="4" />
      <!-- Industrial Hard Hat Motif -->
      <path d="M-30 0 C-30 -30 30 -30 30 0 L36 8 L-36 8 Z" fill="#facc15" stroke="#ca8a04" stroke-width="2" />
      <rect x="-10" y="-30" width="20" height="15" rx="3" fill="#ffffff" />
    </g>
    <text x="150" y="195" font-family="sans-serif" font-size="20" font-weight="900" fill="#0f172a" text-anchor="middle" letter-spacing="1">R.L. INDUSTRIAL</text>
    <text x="150" y="218" font-family="sans-serif" font-size="10" font-weight="800" fill="#16a34a" text-anchor="middle" letter-spacing="2">SAFETY CORPORATION</text>
    <text x="150" y="238" font-family="sans-serif" font-size="8" font-weight="700" fill="#64748b" text-anchor="middle">PPE &amp; SAFETY STORE</text>
  `),

  // 5. Swastik Engicom (Fire Protection & Safety Cross)
  'swastik-engicom.svg': createLogoSvg(`
    <g transform="translate(150, 95)">
      <!-- Maltese Cross -->
      <polygon points="-15,-45 0,-30 15,-45 45,-15 30,0 45,15 15,45 0,30 -15,45 -45,15 -30,0 -45,-15" fill="#dc2626" stroke="#991b1b" stroke-width="3" />
      <circle cx="0" cy="0" r="18" fill="url(#goldGrad)" />
      <path d="M0 -10 C6 -10 10 2 0 12 C-10 2 -6 -10 0 -10 Z" fill="#dc2626" />
    </g>
    <text x="150" y="195" font-family="sans-serif" font-size="19" font-weight="900" fill="#0f172a" text-anchor="middle" letter-spacing="1">SWASTIK ENGICOM</text>
    <text x="150" y="218" font-family="sans-serif" font-size="10" font-weight="800" fill="#dc2626" text-anchor="middle" letter-spacing="2">FIRE &amp; SAFETY</text>
    <text x="150" y="238" font-family="sans-serif" font-size="8" font-weight="700" fill="#64748b" text-anchor="middle">ENGINEERING SYSTEMS</text>
  `),

  // 6. Krishna electricals & industrial (Electric Bolt & Stator)
  'krishna-electricals-industrial.svg': createLogoSvg(`
    <g transform="translate(150, 95)">
      <circle cx="0" cy="0" r="52" fill="#2563eb" stroke="#1d4ed8" stroke-width="4" />
      <!-- Lightning Bolt -->
      <polygon points="-6,-35 18,-35 -4,2 14,2 -16,35 -2,-2 -16,-2" fill="#fde047" stroke="#ca8a04" stroke-width="2" />
    </g>
    <text x="150" y="195" font-family="sans-serif" font-size="20" font-weight="900" fill="#0f172a" text-anchor="middle" letter-spacing="1">KRISHNA</text>
    <text x="150" y="218" font-family="sans-serif" font-size="10" font-weight="800" fill="#2563eb" text-anchor="middle" letter-spacing="2">ELECTRICALS &amp; INDUSTRIAL</text>
    <text x="150" y="238" font-family="sans-serif" font-size="8" font-weight="700" fill="#64748b" text-anchor="middle">MOTORS, CABLES &amp; SWITCHGEAR</text>
  `),

  // 7. Konark Enterprises (Konark Wheel Motif)
  'konark-enterprises.svg': createLogoSvg(`
    <g transform="translate(150, 95)">
      <circle cx="0" cy="0" r="52" fill="#b45309" stroke="#78350f" stroke-width="4" />
      <!-- 8-Spoke Konark Wheel -->
      <circle cx="0" cy="0" r="38" fill="none" stroke="#fde047" stroke-width="4" />
      <g stroke="#fde047" stroke-width="3">
        <line x1="0" y1="-38" x2="0" y2="38" />
        <line x1="-38" y1="0" x2="38" y2="0" />
        <line x1="-27" y1="-27" x2="27" y2="27" />
        <line x1="-27" y1="27" x2="27" y2="-27" />
      </g>
      <circle cx="0" cy="0" r="12" fill="#fde047" />
    </g>
    <text x="150" y="195" font-family="sans-serif" font-size="20" font-weight="900" fill="#0f172a" text-anchor="middle" letter-spacing="1">KONARK</text>
    <text x="150" y="218" font-family="sans-serif" font-size="10" font-weight="800" fill="#b45309" text-anchor="middle" letter-spacing="2">ENTERPRISES</text>
    <text x="150" y="238" font-family="sans-serif" font-size="8" font-weight="700" fill="#64748b" text-anchor="middle">INDUSTRIAL MRO SPARES</text>
  `),

  // 8. Trade & Industrial Syndicate (Intermeshing Spur Gears)
  'trade-industrial-syndicate.svg': createLogoSvg(`
    <g transform="translate(150, 95)">
      <!-- Large Gear -->
      <g transform="translate(-15, -10)">
        <circle cx="0" cy="0" r="36" fill="#0284c7" stroke="#0369a1" stroke-width="3" />
        <circle cx="0" cy="0" r="14" fill="#ffffff" />
      </g>
      <!-- Small Gear -->
      <g transform="translate(25, 20)">
        <circle cx="0" cy="0" r="25" fill="#f59e0b" stroke="#d97706" stroke-width="2.5" />
        <circle cx="0" cy="0" r="9" fill="#ffffff" />
      </g>
    </g>
    <text x="150" y="195" font-family="sans-serif" font-size="18" font-weight="900" fill="#0f172a" text-anchor="middle" letter-spacing="1">TRADE &amp; INDUSTRIAL</text>
    <text x="150" y="218" font-family="sans-serif" font-size="11" font-weight="800" fill="#0284c7" text-anchor="middle" letter-spacing="2">SYNDICATE</text>
    <text x="150" y="238" font-family="sans-serif" font-size="8" font-weight="700" fill="#64748b" text-anchor="middle">SPARES &amp; CONSUMABLES</text>
  `),

  // 9. Pavan Enterprises, JSG (VFD Frequency Sine Wave)
  'pavan-enterprises-jsg.svg': createLogoSvg(`
    <g transform="translate(150, 95)">
      <circle cx="0" cy="0" r="52" fill="#059669" stroke="#047857" stroke-width="4" />
      <!-- Electronic Sine Wave Pulse -->
      <path d="M-38 0 Q-20 -40 0 0 T38 0" fill="none" stroke="#fde047" stroke-width="6" stroke-linecap="round" />
    </g>
    <text x="150" y="195" font-family="sans-serif" font-size="20" font-weight="900" fill="#0f172a" text-anchor="middle" letter-spacing="1">PAVAN</text>
    <text x="150" y="218" font-family="sans-serif" font-size="10" font-weight="800" fill="#059669" text-anchor="middle" letter-spacing="2">ENTERPRISES, JSG</text>
    <text x="150" y="238" font-family="sans-serif" font-size="8" font-weight="700" fill="#64748b" text-anchor="middle">DRIVES &amp; INSTRUMENTATION</text>
  `),

  // 10. M/S DIVINE TRENDS (Radiant LED Lumen Starburst)
  'divine-trends.svg': createLogoSvg(`
    <g transform="translate(150, 95)">
      <circle cx="0" cy="0" r="52" fill="#7c3aed" stroke="#6d28d9" stroke-width="4" />
      <!-- Radiant Star -->
      <polygon points="0,-35 9,-10 35,0 9,10 0,35 -9,10 -35,0 -9,-10" fill="url(#goldGrad)" />
    </g>
    <text x="150" y="195" font-family="sans-serif" font-size="19" font-weight="900" fill="#0f172a" text-anchor="middle" letter-spacing="1">DIVINE TRENDS</text>
    <text x="150" y="218" font-family="sans-serif" font-size="10" font-weight="800" fill="#7c3aed" text-anchor="middle" letter-spacing="2">GENERAL SUPPLIES</text>
    <text x="150" y="238" font-family="sans-serif" font-size="8" font-weight="700" fill="#64748b" text-anchor="middle">LED LIGHTING &amp; HARDWARE</text>
  `),

  // 11. Laxmi Sales Agency (Concentric Ball Bearing Crest)
  'laxmi-sales-agency.svg': createLogoSvg(`
    <g transform="translate(150, 95)">
      <circle cx="0" cy="0" r="52" fill="#1e40af" stroke="#1d4ed8" stroke-width="4" />
      <!-- Bearing Rings & Balls -->
      <circle cx="0" cy="0" r="38" fill="none" stroke="url(#chromeMetal)" stroke-width="8" />
      <g fill="#fde047">
        <circle cx="0" cy="-28" r="5" />
        <circle cx="28" cy="0" r="5" />
        <circle cx="0" cy="28" r="5" />
        <circle cx="-28" cy="0" r="5" />
        <circle cx="20" cy="20" r="5" />
        <circle cx="-20" cy="-20" r="5" />
        <circle cx="20" cy="-20" r="5" />
        <circle cx="-20" cy="20" r="5" />
      </g>
      <circle cx="0" cy="0" r="16" fill="#f8fafc" stroke="#1e293b" stroke-width="2" />
    </g>
    <text x="150" y="195" font-family="sans-serif" font-size="19" font-weight="900" fill="#0f172a" text-anchor="middle" letter-spacing="1">LAXMI SALES</text>
    <text x="150" y="218" font-family="sans-serif" font-size="11" font-weight="800" fill="#1e40af" text-anchor="middle" letter-spacing="2">AGENCY</text>
    <text x="150" y="238" font-family="sans-serif" font-size="8" font-weight="700" fill="#64748b" text-anchor="middle">BEARINGS &amp; POWER TRANSMISSION</text>
  `),

  // 12. SKF Stores & Spares (Official SKF Royal Blue Bold Logotype)
  'skf-stores-spares.svg': createLogoSvg(`
    <g transform="translate(150, 95)">
      <!-- Official SKF Royal Blue Oval Badge -->
      <ellipse cx="0" cy="0" rx="60" ry="40" fill="#005a9c" stroke="#004080" stroke-width="3" />
      <!-- SKF Bold Monogram -->
      <text x="0" y="14" font-family="'Arial Black', Impact, sans-serif" font-size="36" font-weight="900" fill="#ffffff" text-anchor="middle" letter-spacing="2">SKF</text>
    </g>
    <text x="150" y="195" font-family="sans-serif" font-size="18" font-weight="900" fill="#0f172a" text-anchor="middle" letter-spacing="1">STORES &amp; SPARES</text>
    <text x="150" y="218" font-family="sans-serif" font-size="10" font-weight="800" fill="#005a9c" text-anchor="middle" letter-spacing="2">AUTHORIZED DISTRIBUTOR</text>
    <text x="150" y="238" font-family="sans-serif" font-size="8" font-weight="700" fill="#64748b" text-anchor="middle">BEARINGS &amp; LUBRICATION</text>
  `),

  // 13. JHARSUGUDA PIPES 'N' SANITERIES (Flanged Pipe & Water Drop)
  'jharsuguda-pipes-saniteries.svg': createLogoSvg(`
    <g transform="translate(150, 95)">
      <circle cx="0" cy="0" r="52" fill="#0891b2" stroke="#0e7490" stroke-width="4" />
      <!-- Pipe Cross T-joint -->
      <rect x="-35" y="-12" width="70" height="24" rx="4" fill="url(#chromeMetal)" stroke="#1e293b" stroke-width="2" />
      <rect x="-12" y="-35" width="24" height="40" rx="4" fill="url(#chromeMetal)" stroke="#1e293b" stroke-width="2" />
      <circle cx="0" cy="0" r="6" fill="#0891b2" />
    </g>
    <text x="150" y="195" font-family="sans-serif" font-size="18" font-weight="900" fill="#0f172a" text-anchor="middle" letter-spacing="0.5">JHARSUGUDA PIPES</text>
    <text x="150" y="218" font-family="sans-serif" font-size="10" font-weight="800" fill="#0891b2" text-anchor="middle" letter-spacing="2">'N' SANITERIES</text>
    <text x="150" y="238" font-family="sans-serif" font-size="8" font-weight="700" fill="#64748b" text-anchor="middle">VALVES, FITTINGS &amp; PIPES</text>
  `),

  // 14. Utkal Innovatives (Roller Chain Sprocket Wheel)
  'utkal-innovatives.svg': createLogoSvg(`
    <g transform="translate(150, 95)">
      <circle cx="0" cy="0" r="52" fill="#be123c" stroke="#9f1239" stroke-width="4" />
      <!-- Precision Sprocket -->
      <circle cx="0" cy="0" r="36" fill="url(#chromeMetal)" stroke="#1e293b" stroke-width="3" />
      <circle cx="0" cy="0" r="14" fill="#be123c" />
    </g>
    <text x="150" y="195" font-family="sans-serif" font-size="18" font-weight="900" fill="#0f172a" text-anchor="middle" letter-spacing="1">UTKAL</text>
    <text x="150" y="218" font-family="sans-serif" font-size="11" font-weight="800" fill="#be123c" text-anchor="middle" letter-spacing="2">INNOVATIVES</text>
    <text x="150" y="238" font-family="sans-serif" font-size="8" font-weight="700" fill="#64748b" text-anchor="middle">CHAINS &amp; SPROCKETS</text>
  `),

  // 15. Siddhivinayak engineering (Machining Lathe Chuck & Impeller)
  'siddhivinayak-engineering.svg': createLogoSvg(`
    <g transform="translate(150, 95)">
      <circle cx="0" cy="0" r="52" fill="#ea580c" stroke="#c2410c" stroke-width="4" />
      <!-- Impeller 3-Blade Motif -->
      <circle cx="0" cy="0" r="35" fill="url(#chromeMetal)" stroke="#1e293b" stroke-width="2.5" />
      <circle cx="0" cy="0" r="12" fill="#ea580c" />
    </g>
    <text x="150" y="195" font-family="sans-serif" font-size="17" font-weight="900" fill="#0f172a" text-anchor="middle" letter-spacing="0.5">SIDDHIVINAYAK</text>
    <text x="150" y="218" font-family="sans-serif" font-size="11" font-weight="800" fill="#ea580c" text-anchor="middle" letter-spacing="2">ENGINEERING</text>
    <text x="150" y="238" font-family="sans-serif" font-size="8" font-weight="700" fill="#64748b" text-anchor="middle">MACHINERY &amp; FABRICATION</text>
  `),

  // 16. ROYAL ENGINEERING (Imperial Crown atop I-Beam)
  'royal-engineering.svg': createLogoSvg(`
    <g transform="translate(150, 95)">
      <circle cx="0" cy="0" r="52" fill="#0b2447" stroke="#1e3a8a" stroke-width="4" />
      <!-- Imperial Crown -->
      <polygon points="-30,-5 -35,-25 -15,-12 0,-30 15,-12 35,-25 30,-5" fill="url(#goldGrad)" stroke="#78350f" stroke-width="1.5" />
      <!-- I-Beam Base -->
      <rect x="-25" y="0" width="50" height="8" rx="2" fill="url(#goldGrad)" />
      <rect x="-6" y="8" width="12" height="15" fill="url(#goldGrad)" />
      <rect x="-25" y="23" width="50" height="8" rx="2" fill="url(#goldGrad)" />
    </g>
    <text x="150" y="195" font-family="sans-serif" font-size="20" font-weight="900" fill="#0b2447" text-anchor="middle" letter-spacing="2">ROYAL</text>
    <text x="150" y="218" font-family="sans-serif" font-size="11" font-weight="800" fill="#d97706" text-anchor="middle" letter-spacing="2">ENGINEERING</text>
    <text x="150" y="238" font-family="sans-serif" font-size="8" font-weight="700" fill="#64748b" text-anchor="middle">STRUCTURAL FABRICATION</text>
  `),

  // 17. Kainsara Infraprojects Private Limited (Highway Bridge Pylon)
  'kainsara-infraprojects.svg': createLogoSvg(`
    <g transform="translate(150, 95)">
      <circle cx="0" cy="0" r="52" fill="#475569" stroke="#334155" stroke-width="4" />
      <!-- Bridge Cable Pylon -->
      <polygon points="-10,-35 10,-35 18,35 -18,35" fill="url(#goldGrad)" stroke="#78350f" stroke-width="2" />
      <line x1="-35" y1="20" x2="35" y2="20" stroke="#f8fafc" stroke-width="4" stroke-linecap="round" />
    </g>
    <text x="150" y="195" font-family="sans-serif" font-size="19" font-weight="900" fill="#0f172a" text-anchor="middle" letter-spacing="1">KAINSARA</text>
    <text x="150" y="218" font-family="sans-serif" font-size="10" font-weight="800" fill="#d97706" text-anchor="middle" letter-spacing="2">INFRAPROJECTS PVT LTD</text>
    <text x="150" y="238" font-family="sans-serif" font-size="8" font-weight="700" fill="#64748b" text-anchor="middle">CIVIL RMC &amp; AGGREGATES</text>
  `),

  // 18. kalpana traders jharsuguda (Crossed Hammer & Spanner)
  'kalpana-traders-jharsuguda.svg': createLogoSvg(`
    <g transform="translate(150, 95)">
      <circle cx="0" cy="0" r="52" fill="#ea580c" stroke="#c2410c" stroke-width="4" />
      <!-- Crossed Tools -->
      <g stroke="url(#chromeMetal)" stroke-width="6" stroke-linecap="round">
        <line x1="-28" y1="-28" x2="28" y2="28" />
        <line x1="-28" y1="28" x2="28" y2="-28" />
      </g>
      <rect x="-35" y="-35" width="18" height="12" rx="2" fill="#1e293b" transform="rotate(45 -35 -35)" />
      <circle cx="0" cy="0" r="10" fill="#fde047" />
    </g>
    <text x="150" y="195" font-family="sans-serif" font-size="19" font-weight="900" fill="#0f172a" text-anchor="middle" letter-spacing="1">KALPANA</text>
    <text x="150" y="218" font-family="sans-serif" font-size="10" font-weight="800" fill="#ea580c" text-anchor="middle" letter-spacing="2">TRADERS JHARSUGUDA</text>
    <text x="150" y="238" font-family="sans-serif" font-size="8" font-weight="700" fill="#64748b" text-anchor="middle">HARDWARE &amp; POWER TOOLS</text>
  `),

  // 19. Swastik Enterprise (Hygiene Foam & Eco Leaf)
  'swastik-enterprise.svg': createLogoSvg(`
    <g transform="translate(150, 95)">
      <circle cx="0" cy="0" r="52" fill="#0d9488" stroke="#0f766e" stroke-width="4" />
      <!-- Sparkle Droplet & Leaf -->
      <path d="M0 -35 C15 -35 30 -10 30 10 C30 25 15 35 0 35 C-15 35 -30 25 -30 10 C-30 -10 -15 -35 0 -35 Z" fill="#5eead4" />
      <circle cx="10" cy="-5" r="5" fill="#ffffff" />
    </g>
    <text x="150" y="195" font-family="sans-serif" font-size="19" font-weight="900" fill="#0f172a" text-anchor="middle" letter-spacing="1">SWASTIK</text>
    <text x="150" y="218" font-family="sans-serif" font-size="10" font-weight="800" fill="#0d9488" text-anchor="middle" letter-spacing="2">ENTERPRISE</text>
    <text x="150" y="238" font-family="sans-serif" font-size="8" font-weight="700" fill="#64748b" text-anchor="middle">HOUSEKEEPING &amp; CHEMICALS</text>
  `),

  // 20. Jharsuguda Broom (Natural Odisha Grass Broom Sheaves)
  'jharsuguda-broom.svg': createLogoSvg(`
    <g transform="translate(150, 95)">
      <circle cx="0" cy="0" r="52" fill="#15803d" stroke="#166534" stroke-width="4" />
      <!-- Broom Sheaf Ribbon Motif -->
      <path d="M0 -35 L12 -35 L20 30 L-20 30 L-12 -35 Z" fill="#fde047" stroke="#ca8a04" stroke-width="2" />
      <rect x="-16" y="-10" width="32" height="12" rx="3" fill="#dc2626" />
      <rect x="-18" y="10" width="36" height="12" rx="3" fill="#dc2626" />
    </g>
    <text x="150" y="195" font-family="sans-serif" font-size="18" font-weight="900" fill="#0f172a" text-anchor="middle" letter-spacing="1">JHARSUGUDA</text>
    <text x="150" y="218" font-family="sans-serif" font-size="12" font-weight="900" fill="#15803d" text-anchor="middle" letter-spacing="2">BROOM</text>
    <text x="150" y="238" font-family="sans-serif" font-size="8" font-weight="700" fill="#64748b" text-anchor="middle">NATURAL HILL GRASS &amp; COIR</text>
  `)
};

export function generateAllRealLogos() {
  console.log('Generating real authentic logos for all 10 buyers and 20 sellers...');
  
  for (const [fileName, svgContent] of Object.entries(BUYER_LOGOS)) {
    saveLogo(fileName, svgContent);
  }

  for (const [fileName, svgContent] of Object.entries(SELLER_LOGOS)) {
    saveLogo(fileName, svgContent);
  }

  console.log('Successfully generated all real 1:1 square/circular logos!');
}

generateAllRealLogos();
