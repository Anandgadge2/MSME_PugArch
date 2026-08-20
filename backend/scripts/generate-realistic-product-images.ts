import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '../..');

const targetDirs = [
  path.resolve(repoRoot, 'frontend/public'),
  path.resolve(repoRoot, 'backend/uploads'),
  path.resolve(repoRoot, 'backend/frontend/public'),
  path.resolve(repoRoot, 'backend/backend/uploads')
];

const ensureDirs = () => {
  ['products', 'org-logos', 'banners'].forEach(dir => {
    targetDirs.forEach(base => {
      try {
        fs.mkdirSync(path.join(base, dir), { recursive: true });
      } catch (e) {}
    });
  });
};

const saveAsset = (subDir: string, fileName: string, content: string) => {
  targetDirs.forEach(base => {
    try {
      const fullDir = path.join(base, subDir);
      if (!fs.existsSync(fullDir)) fs.mkdirSync(fullDir, { recursive: true });
      fs.writeFileSync(path.join(fullDir, fileName), content, 'utf-8');
    } catch (e) {}
  });
};

function studioWrap(content: string, ratingBadge?: string): string {
  return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 500" width="500" height="500">
  <defs>
    <radialGradient id="studioBg" cx="50%" cy="38%" r="65%">
      <stop offset="0%" stop-color="#ffffff" />
      <stop offset="65%" stop-color="#f8fafc" />
      <stop offset="100%" stop-color="#e2e8f0" />
    </radialGradient>
    <radialGradient id="contactShadow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="rgba(15, 23, 42, 0.32)" />
      <stop offset="50%" stop-color="rgba(15, 23, 42, 0.12)" />
      <stop offset="100%" stop-color="rgba(15, 23, 42, 0)" />
    </radialGradient>
    <linearGradient id="chromeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ffffff" />
      <stop offset="25%" stop-color="#cbd5e1" />
      <stop offset="50%" stop-color="#ffffff" />
      <stop offset="75%" stop-color="#64748b" />
      <stop offset="100%" stop-color="#94a3b8" />
    </linearGradient>
    <linearGradient id="copperGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fed7aa" />
      <stop offset="35%" stop-color="#ea580c" />
      <stop offset="70%" stop-color="#ffedd5" />
      <stop offset="100%" stop-color="#9a3412" />
    </linearGradient>
    <linearGradient id="goldCarbide" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fef08a" />
      <stop offset="40%" stop-color="#ca8a04" />
      <stop offset="80%" stop-color="#eab308" />
      <stop offset="100%" stop-color="#854d0e" />
    </linearGradient>
    <linearGradient id="darkMetal" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#475569" />
      <stop offset="50%" stop-color="#1e293b" />
      <stop offset="100%" stop-color="#0f172a" />
    </linearGradient>
    <linearGradient id="toolBlue" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#38bdf8" />
      <stop offset="40%" stop-color="#0284c7" />
      <stop offset="100%" stop-color="#0369a1" />
    </linearGradient>
    <linearGradient id="royalBlue" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#2563eb" />
      <stop offset="50%" stop-color="#1d4ed8" />
      <stop offset="100%" stop-color="#1e3a8a" />
    </linearGradient>
    <linearGradient id="safetyOrange" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fb923c" />
      <stop offset="50%" stop-color="#ea580c" />
      <stop offset="100%" stop-color="#9a3412" />
    </linearGradient>
    <linearGradient id="dangerRed" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#f87171" />
      <stop offset="50%" stop-color="#dc2626" />
      <stop offset="100%" stop-color="#991b1b" />
    </linearGradient>
    <linearGradient id="cautionYellow" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fef08a" />
      <stop offset="40%" stop-color="#eab308" />
      <stop offset="100%" stop-color="#a16207" />
    </linearGradient>
    <linearGradient id="coirBrown" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#d97706" />
      <stop offset="40%" stop-color="#92400e" />
      <stop offset="100%" stop-color="#451a03" />
    </linearGradient>
    <linearGradient id="hillGrassGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fef08a" />
      <stop offset="35%" stop-color="#eab308" />
      <stop offset="70%" stop-color="#ca8a04" />
      <stop offset="100%" stop-color="#854d0e" />
    </linearGradient>
    <linearGradient id="emeraldLiquid" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#34d399" />
      <stop offset="50%" stop-color="#10b981" />
      <stop offset="100%" stop-color="#047857" />
    </linearGradient>
    <filter id="softGlow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="10" stdDeviation="14" flood-color="#0f172a" flood-opacity="0.18"/>
    </filter>
  </defs>
  <rect width="500" height="500" rx="20" fill="url(#studioBg)" />
  <ellipse cx="250" cy="430" rx="190" ry="24" fill="url(#contactShadow)" />
  <ellipse cx="250" cy="427" rx="130" ry="14" fill="url(#contactShadow)" opacity="0.8" />
  <g filter="url(#softGlow)">
    ${content}
  </g>
</svg>
`.trim();
}

export const realisticDrawings: Record<string, () => string> = {
  'impact-wrench': () => `
    <g transform="translate(110, 75)">
      <path d="M110 180 L140 330 C143 345 130 355 115 355 L90 355 C75 355 65 342 60 328 L50 180 Z" fill="#1e293b" stroke="#0f172a" stroke-width="3" />
      <rect x="75" y="220" width="45" height="12" rx="4" fill="#334155" />
      <rect x="79" y="245" width="45" height="12" rx="4" fill="#334155" />
      <rect x="83" y="270" width="45" height="12" rx="4" fill="#334155" />
      <rect x="87" y="295" width="45" height="12" rx="4" fill="#334155" />
      <rect x="80" y="355" width="22" height="25" rx="3" fill="url(#copperGrad)" stroke="#7c2d12" stroke-width="1.5" />
      <rect x="84" y="380" width="14" height="15" rx="2" fill="url(#chromeGrad)" />
      <rect x="30" y="70" width="180" height="120" rx="28" fill="url(#darkMetal)" stroke="#334155" stroke-width="4" />
      <rect x="35" y="78" width="170" height="15" rx="7" fill="url(#safetyOrange)" />
      <rect x="180" y="90" width="45" height="80" rx="16" fill="#334155" stroke="#0f172a" stroke-width="3" />
      <circle cx="202" cy="130" r="14" fill="#ef4444" stroke="#ffffff" stroke-width="2" />
      <path d="M40 85 L-20 100 L-20 160 L40 175 Z" fill="url(#chromeGrad)" stroke="#64748b" stroke-width="3" />
      <rect x="-60" y="115" width="40" height="30" rx="4" fill="url(#darkMetal)" stroke="#475569" stroke-width="2" />
      <circle cx="-40" cy="130" r="5" fill="#f8fafc" />
      <path d="M48 200 C48 185 30 185 30 200 L35 230 C35 240 48 240 48 230 Z" fill="#ef4444" stroke="#991b1b" stroke-width="2" />
      <rect x="65" y="115" width="90" height="35" rx="6" fill="#0f172a" stroke="#475569" stroke-width="1.5" />
      <text x="110" y="132" font-family="sans-serif" font-size="10" font-weight="900" fill="#f8fafc" text-anchor="middle">HEAVY DUTY 1"</text>
      <text x="110" y="144" font-family="sans-serif" font-size="8" font-weight="700" fill="#38bdf8" text-anchor="middle">2600 Nm TWIN HAMMER</text>
    </g>
  `,

  'carbide-inserts': () => `
    <g transform="translate(90, 80)">
      <rect x="30" y="40" width="260" height="280" rx="16" fill="#dc2626" stroke="#991b1b" stroke-width="4" />
      <rect x="45" y="55" width="230" height="210" rx="8" fill="#1e293b" />
      <g fill="url(#goldCarbide)" stroke="#78350f" stroke-width="1.5">
        <polygon points="75,70 100,110 50,110" />
        <polygon points="125,70 150,110 100,110" />
        <polygon points="175,70 200,110 150,110" />
        <polygon points="225,70 250,110 200,110" />
        <polygon points="75,130 95,145 75,160 55,145" />
        <polygon points="125,130 145,145 125,160 105,145" />
        <polygon points="175,130 195,145 175,160 155,145" />
        <polygon points="225,130 245,145 225,160 205,145" />
        <rect x="60" y="180" width="30" height="30" rx="3" />
        <rect x="110" y="180" width="30" height="30" rx="3" />
        <rect x="160" y="180" width="30" height="30" rx="3" />
        <rect x="210" y="180" width="30" height="30" rx="3" />
      </g>
      <g fill="#0f172a">
        <circle cx="75" cy="97" r="4" /><circle cx="125" cy="97" r="4" /><circle cx="175" cy="97" r="4" /><circle cx="225" cy="97" r="4" />
        <circle cx="75" cy="145" r="4" /><circle cx="125" cy="145" r="4" /><circle cx="175" cy="145" r="4" /><circle cx="225" cy="145" r="4" />
        <circle cx="75" cy="195" r="4" /><circle cx="125" cy="195" r="4" /><circle cx="175" cy="195" r="4" /><circle cx="225" cy="195" r="4" />
      </g>
      <rect x="45" y="275" width="230" height="35" rx="6" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1.5" />
      <text x="160" y="292" font-family="sans-serif" font-size="10" font-weight="900" fill="#dc2626" text-anchor="middle">CNMG 120408-PM • TiAlN</text>
      <text x="160" y="304" font-family="sans-serif" font-size="8" font-weight="700" fill="#1e293b" text-anchor="middle">TUNGSTEN CARBIDE INSERTS (10 PCS)</text>
    </g>
  `,

  'vernier-caliper': () => `
    <g transform="translate(60, 110)">
      <rect x="20" y="140" width="350" height="24" rx="3" fill="url(#chromeGrad)" stroke="#475569" stroke-width="2" />
      <path d="M20 140 L20 70 C20 60 40 85 45 140 Z" fill="url(#chromeGrad)" stroke="#475569" stroke-width="2" />
      <path d="M20 164 L20 250 C20 265 40 230 48 164 Z" fill="url(#chromeGrad)" stroke="#475569" stroke-width="2" />
      <rect x="130" y="115" width="100" height="74" rx="8" fill="#1e293b" stroke="#0f172a" stroke-width="3" />
      <path d="M130 115 L130 70 C130 60 115 85 110 115 Z" fill="url(#chromeGrad)" stroke="#475569" stroke-width="2" />
      <path d="M130 189 L130 250 C130 265 115 230 110 189 Z" fill="url(#chromeGrad)" stroke="#475569" stroke-width="2" />
      <rect x="145" y="125" width="70" height="30" rx="4" fill="#a3e635" stroke="#4d7c0f" stroke-width="1.5" />
      <text x="180" y="146" font-family="'Courier New', monospace" font-size="16" font-weight="900" fill="#14532d" text-anchor="middle">150.00</text>
      <text x="207" y="137" font-family="sans-serif" font-size="7" font-weight="800" fill="#14532d">mm</text>
      <circle cx="155" cy="170" r="6" fill="#ef4444" />
      <circle cx="180" cy="170" r="6" fill="#38bdf8" />
      <circle cx="205" cy="170" r="6" fill="#eab308" />
      <rect x="230" y="145" width="12" height="14" rx="2" fill="url(#darkMetal)" stroke="#64748b" stroke-width="1" />
      <rect x="370" y="149" width="40" height="6" fill="url(#chromeGrad)" stroke="#475569" stroke-width="1" />
    </g>
  `,

  'arc-welder': () => `
    <g transform="translate(90, 70)">
      <rect x="40" y="80" width="240" height="230" rx="24" fill="url(#safetyOrange)" stroke="#9a3412" stroke-width="4" />
      <path d="M90 80 L90 35 C90 20 230 20 230 35 L230 80" fill="none" stroke="#1e293b" stroke-width="16" stroke-linecap="round" />
      <rect x="60" y="100" width="200" height="190" rx="14" fill="#0f172a" stroke="#334155" stroke-width="2" />
      <rect x="80" y="120" width="80" height="42" rx="6" fill="#1e293b" stroke="#475569" stroke-width="2" />
      <text x="120" y="152" font-family="'Courier New', monospace" font-size="28" font-weight="900" fill="#22c55e" text-anchor="middle" letter-spacing="2">400</text>
      <text x="175" y="135" font-family="sans-serif" font-size="10" font-weight="800" fill="#94a3b8">AMPS</text>
      <circle cx="215" cy="142" r="18" fill="url(#darkMetal)" stroke="#94a3b8" stroke-width="2" />
      <line x1="215" y1="142" x2="225" y2="132" stroke="#ef4444" stroke-width="3" stroke-linecap="round" />
      <circle cx="100" cy="255" r="16" fill="url(#dangerRed)" stroke="#7f1d1d" stroke-width="2" />
      <circle cx="100" cy="255" r="8" fill="url(#copperGrad)" />
      <text x="100" y="248" font-family="sans-serif" font-size="10" font-weight="900" fill="#ffffff" text-anchor="middle">+</text>
      <circle cx="220" cy="255" r="16" fill="#1e293b" stroke="#475569" stroke-width="2" />
      <circle cx="220" cy="255" r="8" fill="url(#copperGrad)" />
      <text x="220" y="248" font-family="sans-serif" font-size="10" font-weight="900" fill="#ffffff" text-anchor="middle">-</text>
      <path d="M100 270 C100 350 -30 320 -10 370 C10 400 120 380 160 370" fill="none" stroke="#dc2626" stroke-width="12" stroke-linecap="round" />
      <rect x="150" y="345" width="80" height="25" rx="6" fill="#1e293b" transform="rotate(-15 150 345)" stroke="#ea580c" stroke-width="2" />
    </g>
  `,

  'welding-electrodes': () => `
    <g transform="translate(100, 70)">
      <polygon points="60,90 220,50 280,80 120,120" fill="#1e40af" stroke="#1d4ed8" stroke-width="2" />
      <polygon points="60,90 120,120 120,330 60,300" fill="#1e3a8a" stroke="#172554" stroke-width="2" />
      <polygon points="120,120 280,80 280,290 120,330" fill="#2563eb" stroke="#1d4ed8" stroke-width="2" />
      <text x="200" y="160" font-family="sans-serif" font-size="20" font-weight="900" fill="#ffffff" transform="rotate(-14 200 160)">E7018</text>
      <text x="195" y="185" font-family="sans-serif" font-size="11" font-weight="700" fill="#fbbf24" transform="rotate(-14 195 185)">LOW HYDROGEN</text>
      <text x="190" y="210" font-family="sans-serif" font-size="9" font-weight="600" fill="#93c5fd" transform="rotate(-14 190 210)">4.00mm x 450mm • 20 KG</text>
      <rect x="155" y="235" width="90" height="20" rx="4" fill="#dc2626" transform="rotate(-14 155 235)" />
      <text x="200" y="249" font-family="sans-serif" font-size="9" font-weight="900" fill="#ffffff" text-anchor="middle" transform="rotate(-14 200 249)">ISI CERTIFIED</text>
      <g stroke="#94a3b8" stroke-width="6" stroke-linecap="round">
        <line x1="20" y1="360" x2="200" y2="110" />
        <line x1="35" y1="365" x2="215" y2="115" />
        <line x1="50" y1="370" x2="230" y2="120" />
        <line x1="65" y1="375" x2="245" y2="125" />
      </g>
      <g stroke="#f59e0b" stroke-width="6" stroke-linecap="round">
        <line x1="195" y1="117" x2="200" y2="110" />
        <line x1="210" y1="122" x2="215" y2="115" />
        <line x1="225" y1="127" x2="230" y2="120" />
        <line x1="240" y1="132" x2="245" y2="125" />
      </g>
    </g>
  `,

  'cotton-mop': () => `
    <g transform="translate(130, 40)">
      <rect x="112" y="20" width="16" height="190" rx="3" fill="url(#chromeGrad)" stroke="#64748b" stroke-width="2" />
      <rect x="108" y="20" width="24" height="60" rx="6" fill="#0284c7" stroke="#0369a1" stroke-width="2" />
      <rect x="75" y="195" width="90" height="35" rx="8" fill="#0284c7" stroke="#0f172a" stroke-width="3" />
      <circle cx="120" cy="212" r="6" fill="#f8fafc" />
      <path d="M70 230 C50 280 20 340 10 380 C70 390 170 390 230 380 C220 340 190 280 170 230 Z" fill="#f8fafc" stroke="#cbd5e1" stroke-width="3" />
      <path d="M40 310 C80 320 160 320 200 310" stroke="#eab308" stroke-width="8" stroke-linecap="round" />
      <g stroke="#94a3b8" stroke-width="2" stroke-linecap="round" fill="none">
        <path d="M80 235 Q50 310 30 375" /><path d="M95 235 Q80 310 70 375" />
        <path d="M110 235 Q110 310 110 375" /><path d="M125 235 Q125 310 130 375" />
        <path d="M140 235 Q160 310 170 375" /><path d="M155 235 Q190 310 210 375" />
      </g>
      <text x="120" y="415" font-family="sans-serif" font-size="11" font-weight="900" fill="#0b2447" text-anchor="middle">COTTON WET MOP (SET OF 10)</text>
    </g>
  `,

  'coir-broom': () => `
    <g transform="translate(130, 40)">
      <rect x="110" y="20" width="20" height="200" rx="4" fill="#92400e" stroke="#451a03" stroke-width="3" />
      <rect x="80" y="200" width="80" height="35" rx="6" fill="url(#chromeGrad)" stroke="#334155" stroke-width="2" />
      <circle cx="100" cy="218" r="4" fill="#0f172a" /><circle cx="140" cy="218" r="4" fill="#0f172a" />
      <path d="M75 235 L40 375 L200 375 L165 235 Z" fill="url(#coirBrown)" stroke="#451a03" stroke-width="3" />
      <g stroke="#78350f" stroke-width="2" stroke-linecap="round">
        <line x1="90" y1="240" x2="60" y2="370" /><line x1="105" y1="240" x2="85" y2="370" />
        <line x1="120" y1="240" x2="120" y2="370" /><line x1="135" y1="240" x2="155" y2="370" />
        <line x1="150" y1="240" x2="180" y2="370" />
      </g>
      <line x1="60" y1="290" x2="180" y2="290" stroke="url(#copperGrad)" stroke-width="4" />
      <text x="120" y="415" font-family="sans-serif" font-size="11" font-weight="900" fill="#451a03" text-anchor="middle">COCONUT COIR HARD BROOM (BUNDLE OF 20)</text>
    </g>
  `,

  'hill-grass-broom': () => `
    <g transform="translate(130, 40)">
      <rect x="95" y="30" width="50" height="150" rx="8" fill="#dc2626" stroke="#991b1b" stroke-width="3" />
      <g stroke="#15803d" stroke-width="6">
        <line x1="95" y1="60" x2="145" y2="60" />
        <line x1="95" y1="90" x2="145" y2="90" />
        <line x1="95" y1="120" x2="145" y2="120" />
        <line x1="95" y1="150" x2="145" y2="150" />
      </g>
      <rect x="85" y="170" width="70" height="25" rx="4" fill="url(#chromeGrad)" stroke="#475569" stroke-width="2" />
      <path d="M85 190 C60 270 20 330 10 370 C60 380 180 380 230 370 C220 330 180 270 155 190 Z" fill="url(#hillGrassGrad)" stroke="#ca8a04" stroke-width="3" />
      <g stroke="#a16207" stroke-width="1.5" stroke-linecap="round">
        <line x1="120" y1="195" x2="30" y2="365" /><line x1="120" y1="195" x2="70" y2="370" />
        <line x1="120" y1="195" x2="110" y2="375" /><line x1="120" y1="195" x2="130" y2="375" />
        <line x1="120" y1="195" x2="170" y2="370" /><line x1="120" y1="195" x2="210" y2="365" />
      </g>
      <text x="120" y="415" font-family="sans-serif" font-size="11" font-weight="900" fill="#854d0e" text-anchor="middle">ODISHA HILL GRASS (BUNDLE OF 25)</text>
    </g>
  `,

  'trash-bags': () => `
    <g transform="translate(100, 75)">
      <g transform="translate(10, 30)">
        <ellipse cx="60" cy="140" rx="35" ry="85" fill="#0f172a" stroke="#475569" stroke-width="4" />
        <rect x="60" y="55" width="170" height="170" fill="#0f172a" stroke="#334155" stroke-width="3" />
        <ellipse cx="230" cy="140" rx="35" ry="85" fill="#1e293b" stroke="#475569" stroke-width="4" />
        <ellipse cx="230" cy="140" rx="14" ry="35" fill="#0f172a" />
        <rect x="130" y="55" width="28" height="170" fill="url(#cautionYellow)" stroke="#a16207" stroke-width="2" />
        <line x1="80" y1="80" x2="210" y2="80" stroke="#475569" stroke-width="4" stroke-linecap="round" />
        <line x1="80" y1="190" x2="210" y2="190" stroke="#334155" stroke-width="3" stroke-linecap="round" />
      </g>
      <rect x="50" y="255" width="200" height="42" rx="6" fill="#0f172a" stroke="#ca8a04" stroke-width="2" />
      <text x="150" y="274" font-family="sans-serif" font-size="11" font-weight="900" fill="#fde047" text-anchor="middle">36" x 48" TRASH BAGS</text>
      <text x="150" y="289" font-family="sans-serif" font-size="9" font-weight="700" fill="#ffffff" text-anchor="middle">PACK OF 100 • EXTRA HEAVY DUTY</text>
    </g>
  `,

  'handwash-carboy': () => `
    <g transform="translate(125, 60)">
      <rect x="40" y="80" width="170" height="250" rx="20" fill="#f8fafc" stroke="#94a3b8" stroke-width="3.5" />
      <rect x="44" y="140" width="162" height="186" rx="16" fill="url(#emeraldLiquid)" opacity="0.85" />
      <path d="M90 80 L90 45 C90 35 160 35 160 45 L160 80" fill="none" stroke="#e2e8f0" stroke-width="16" stroke-linecap="round" />
      <path d="M90 80 L90 45 C90 35 160 35 160 45 L160 80" fill="none" stroke="#94a3b8" stroke-width="2" stroke-linecap="round" />
      <rect x="160" y="60" width="28" height="24" rx="4" fill="#15803d" stroke="#166534" stroke-width="2" />
      <rect x="58" y="160" width="134" height="95" rx="8" fill="#ffffff" stroke="#a7f3d0" stroke-width="2" />
      <circle cx="125" cy="185" r="14" fill="#10b981" />
      <path d="M125 177 L125 193 M117 185 L133 185" stroke="#ffffff" stroke-width="4" stroke-linecap="round" />
      <text x="125" y="215" font-family="sans-serif" font-size="11" font-weight="900" fill="#065f46" text-anchor="middle">ANTIBACTERIAL</text>
      <text x="125" y="230" font-family="sans-serif" font-size="10" font-weight="900" fill="#0f172a" text-anchor="middle">HAND WASH 20L</text>
      <text x="125" y="244" font-family="sans-serif" font-size="8" font-weight="700" fill="#047857" text-anchor="middle">99.9% Germ Protection</text>
    </g>
  `,

  'floor-cleaner-drum': () => `
    <g transform="translate(120, 60)">
      <rect x="35" y="70" width="190" height="260" rx="28" fill="url(#royalBlue)" stroke="#1e3a8a" stroke-width="4" />
      <line x1="35" y1="130" x2="225" y2="130" stroke="#1e3a8a" stroke-width="5" />
      <line x1="35" y1="270" x2="225" y2="270" stroke="#1e3a8a" stroke-width="5" />
      <path d="M50 70 C50 45 90 45 90 70" fill="none" stroke="#1e3a8a" stroke-width="12" stroke-linecap="round" />
      <path d="M170 70 C170 45 210 45 210 70" fill="none" stroke="#1e3a8a" stroke-width="12" stroke-linecap="round" />
      <circle cx="70" cy="68" r="10" fill="#dc2626" stroke="#991b1b" stroke-width="2" />
      <circle cx="190" cy="68" r="10" fill="#ffffff" stroke="#cbd5e1" stroke-width="2" />
      <rect x="50" y="145" width="160" height="110" rx="8" fill="#ffffff" stroke="#cbd5e1" stroke-width="2" />
      <rect x="55" y="152" width="150" height="25" rx="4" fill="#ea580c" />
      <text x="130" y="169" font-family="sans-serif" font-size="12" font-weight="900" fill="#ffffff" text-anchor="middle">FLOOR CLEANER</text>
      <text x="130" y="195" font-family="sans-serif" font-size="16" font-weight="900" fill="#0b2447" text-anchor="middle">50 LITERS</text>
      <text x="130" y="215" font-family="sans-serif" font-size="9" font-weight="800" fill="#15803d" text-anchor="middle">HEAVY INDUSTRIAL DEGREASER</text>
      <text x="130" y="235" font-family="sans-serif" font-size="8" font-weight="700" fill="#64748b" text-anchor="middle">Alkaline • Oil Spill Formula</text>
    </g>
  `
};

export function getDrawingKeyForProduct(productName: string, categoryName: string): string {
  const p = productName.toLowerCase();
  const c = categoryName.toLowerCase();

  if (p.includes('mop') || p.includes('cotton wet')) return 'cotton-mop';
  if (p.includes('coir') || p.includes('coconut')) return 'coir-broom';
  if (p.includes('hill grass') || p.includes('grass broom') || (p.includes('grass') && p.includes('broom'))) return 'hill-grass-broom';
  if (p.includes('trash bag') || p.includes('garbage') || p.includes('bags')) return 'trash-bags';
  if (p.includes('hand wash') || p.includes('handwash') || p.includes('soap')) return 'handwash-carboy';
  if (p.includes('floor cleaner') || p.includes('degreaser (50')) return 'floor-cleaner-drum';

  if (p.includes('carbide') || p.includes('insert') || p.includes('milling')) return 'carbide-inserts';
  if (p.includes('caliper') || p.includes('vernier')) return 'vernier-caliper';
  if (p.includes('impact wrench') || p.includes('pneumatic')) return 'impact-wrench';
  if (p.includes('welding machine') || p.includes('arc welder') || p.includes('igbt') || p.includes('inverter arc')) return 'arc-welder';
  if (p.includes('electrode') || p.includes('e7018')) return 'welding-electrodes';

  return 'impact-wrench';
}

import { BUYERS_DATA, SELLERS_DATA } from './portal-seed-data.js';

export function generateAllRealisticProductImages() {
  ensureDirs();
  console.log('Generating realistic studio product images for buyers and sellers...');

  for (const seller of SELLERS_DATA) {
    for (let i = 0; i < seller.products.length; i++) {
      const prod = seller.products[i];
      const key = getDrawingKeyForProduct(prod.name, prod.category);
      const drawFn = realisticDrawings[key] || realisticDrawings['impact-wrench'];
      const svgContent = studioWrap(drawFn());
      saveAsset('products', `${seller.slug}-prod-${i + 1}.svg`, svgContent);
    }
  }

  console.log('Successfully generated all distinct product images!');
}

generateAllRealisticProductImages();
